//add necessary aesthetic changes once page has fully loaded dom content
window.addEventListener("DOMContentLoaded", function(){
    let play_queue_butt = document.getElementById("start-queue-img");
    play_queue_butt.src = chrome.extension.getURL("assets/play.png");

    let next_vid_butt = document.getElementById("skip-vid-img");
    next_vid_butt.src = chrome.extension.getURL("assets/fast-forward-button.png");

    let reverse_vid_butt = document.getElementById("reverse-vid-img");
    reverse_vid_butt.src = chrome.extension.getURL("assets/fast-forward-button.png");

    let logo = document.getElementById("logo-img");
    logo.src = chrome.extension.getURL("assets/logo.svg");

    let cog_info = document.getElementById("info-img");
    cog_info.src = chrome.extension.getURL("assets/cog.png");

});

//draw out playlist of items
let playlist = $("#playlist");
let remove_butt = chrome.extension.getURL("assets/delete-button.png");
let queue_vid_container = "";
chrome.storage.local.get(["queue_list", "most_recent"], function(results){
    let videos = results.queue_list;

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //currently building list each time popup is open... could be more efficient by editing playlist DOM as vids r added n removed in real time! FUTURE FUTURE FUTURE stuff
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    if(videos === undefined || videos.length === 0){
        queue_vid_container = $([
                                   "<div id='empty_queue_container'>",
                                        "<h3>Your queue is empty! Start adding! :-)</h3>",
                                    "</div>" 
                                   ].join("\n"));

        $(playlist).append(queue_vid_container);
    }else{
        for(vid of videos){
            queue_vid_container = $([
                                    "<div class='queue_vid_container'>",
                                        "<a class='queue_vid_container_link' href='" + vid.link + "'>",
                                            "<div id='thumbnail_container'>",
                                                "<img id='thumbnail_content' src='" + vid.thumbnail + "'>",
                                            "</div>",
                                            "<div id='meta_content_container'>",
                                                "<h3>" + vid.title + "</h3>",
                                                "<h5>" + vid.author + "</h5>",
                                            "</div>",
                                        "</a>",
                                        "<div id='remove-butt-cont'>",
                                            "<img id='remove-butt-img' src='" + remove_butt + "'>",
                                        "</div>",
                                    "</div>"
                                    ].join("\n"));

            
            if(vid.link === results.most_recent){
                $(queue_vid_container).attr("id", "active");
            }
                                   
            $(playlist).append(queue_vid_container);
        }
    }
});

function realTimeHighlight(){
    chrome.storage.local.get("most_recent", function(results){
        let most_recent = results.most_recent;
        let container;
        $(".queue_vid_container_link").each(function(i){
            container=$(this).parent();
            if($(this).attr("href") !== most_recent){
                $(container).attr("id", "waiting");
            }else{
                $(container).attr("id", "active");
            }
        });
    });

}

function getCurrentQueue(reason){
    chrome.storage.local.get("queue_list", function(result){
        let current_queue = (result.queue_list) ? result.queue_list : [];
        
        if(current_queue.length === 0){
            createMessage("Your Queue is Empty!");
        }else{
            if(reason == "start"){
                startPlayingQueue(current_queue);
            }else if(reason == "next"){
                playVideo(current_queue, reason);
            }else if(reason == "previous"){
                playVideo(current_queue, reason);
            }
        }
    });
}

//begin queue by getting first vid in queue list and sending a request to background script to
//redirect to that page! after we find that the video has finished, we will remove the video from the queue
function startPlayingQueue(queue){
    let currVid;
    chrome.storage.local.get("most_recent", function(results){
        if(results.most_recent){
            currVid = results.most_recent;
        }else{
            currVid = queue[0].link;
        }

        chrome.storage.local.set({most_recent: currVid}, ()=>{realTimeHighlight();});
        chrome.runtime.sendMessage({curr_vid: currVid});
    });
}

function playVideo(queue, direction){
    clearMessageBox();
    
    chrome.storage.local.set({queue_list: queue});

    chrome.storage.local.get(["queue_list", "most_recent"], function(results){
        let most_recent = (results.most_recent) ? results.most_recent : queue[0].link; //or queue[1].link?
       
        let vid_link = getVid(results.queue_list, most_recent, direction);

        if(vid_link){
            chrome.storage.local.set({most_recent: vid_link}, ()=>{realTimeHighlight();});
            chrome.runtime.sendMessage({curr_vid: vid_link});
            
        }else{
            createMessage("No more videos in this direction!");
        }
        
    });
}

function getVid(queue, lastPlayed, direction){
    let lastPlayedIndex = findLastPlayedIndex(queue, lastPlayed);
    let isFound = checkIfExists(queue, lastPlayedIndex, direction);

    if(isFound !== -1){
        return isFound;
    }else{
        console.log("end of queue reached!");
        return;
    }
}

function findLastPlayedIndex(queue, lastPlayed){
    for(let i = 0; i < queue.length; i++){
        if(queue[i].link === lastPlayed){
            return i;
        }
    } 
}

function checkIfExists(queue, lastPlayedIndex, direction){
    let displacement = (direction === "previous") ? -1 : 1;
    if(queue[lastPlayedIndex + displacement]){
        return queue[lastPlayedIndex + displacement].link;
    }else{
        return -1;
    }
}

function spliceList(queue, i){
    //after using indices in queue list, splice the queue to finalize changes
    queue.splice(i, 1);
    chrome.storage.local.set({queue_list: queue});
}

function checkIfEmpty(queue){
    //handles if last vid was removed from queue
    if(queue.length === 0){
        // second time this appears
        let empty_message = $([
                              "<div id='empty_queue_container'>",
                                    "<h3>Your queues empty! Start adding! :-)</h3>",
                              "</div>" 
                            ].join("\n"));
    
        $(playlist).append(empty_message);
    }
}

function clearMessageBox(){
    let append_to_here = $("#message-holder");

    $(append_to_here).empty();
}

function createMessage(message_text){
    let message = message_text;
    let append_to_here = $("#message-holder");
    let message_DOM_ele = $(["<div class = 'info-message'>",
                                "<p>" + message + "</p>",
                            "</div>"].join("\n"));

    

    $(append_to_here).append(message_DOM_ele);

    $(message_DOM_ele).animate({opacity: 1}, 300);
}


/////////////////////////////////////////////////////
// POPUP EVENT HANDLERS ///////////////////////////
//////////////////////////////////////////////////
//handling play and skip button, as well as//////
//explicitly clicking a vid link////////////////
///////////////////////////////////////////////

$("#start-queue").on("click", function(){
    // console.log("start");
    getCurrentQueue("start");
    // activateSkipAndReverse();
});

$("#skip-vid").on("click", function(){
    // console.log("next");
    getCurrentQueue("next");
});

$("#reverse-vid").on("click", function(){
    // console.log("next");
    getCurrentQueue("previous");
});

$(document).on("click", ".queue_vid_container_link", function(e){
    let explicitly_clicked = $(this)[0].href;
    chrome.storage.local.set({most_recent: explicitly_clicked}, ()=>{realTimeHighlight();});

    // chrome.storage.local.get("most_recent", function(r){
    //     console.log(r.most_recent);
    // });

    chrome.runtime.sendMessage({curr_vid: explicitly_clicked});
});

$("#clear-queue").on("click", function(){
    chrome.storage.local.get("queue_list", function(res){
        while(res.queue_list.length > 0){
            spliceList(res.queue_list, 0);
        }

        checkIfEmpty(res.queue_list);
    });

    let nodes_to_remove = $(".queue_vid_container");

    for(let i = 0; i < nodes_to_remove.length; i++){
        $(nodes_to_remove[i]).remove();
    }
});

$(document).on("click", "#remove-butt-cont", function(){
    //every vid has a unique url... save the parents url n delete it from queue list in storage!
    console.log("remove");

    let node_to_remove = $(this).parent();
    let node_to_remove_parent = $(node_to_remove).parent();

    //remove from queue
    let link_ref = $(node_to_remove).find(".queue_vid_container_link")[0].href;

    //look... i know this pyramid may look nasty, but its truly needed as there is no other way to retrieve active tab in popup windows... and we NEED TO CHECK if the vid
    //we are removing from the queue is actually the most recent; so to know if we will skip to next vid in or queue or not
    chrome.storage.local.get(["queue_list", "most_recent"], function(results){
        let queue = results.queue_list;
        for(let i = 0; i < queue.length; i++){
            if(queue[i].link === link_ref){
                //good ol' JS... as we see here, we have the pyramid of DEATH forming...
                chrome.tabs.query({active:true, currentWindow: true}, function(res){
                    //for some reason i was check if the curr window had the url, but i cant remember why? if i do, heres the method i was using to get the url
                    //(res[0].url).replace(/&ab_channel=.*/, "") === queue[i].link
                    
                    //check if most recent vid played in queue is the one we are removing, check if queue has more than one vid(which would be the one we are removing),
                    //and check if the curr windows url is the same as the most recent/one we are removing
                    if(results.most_recent === queue[i].link && queue.length > 1){
                        //usually if the curr vid is removed from queue, we go to the next, but if the next is undefined, we will actually go back to the previous!... maybe 
                        //change this in the future tho truly...
                        if(queue[i+1] !== undefined){
                            let vid_after_curr = queue[i+1].link;

                            //send the next vid after the vid that was removed if curr vid playin was the one u removed... and update most recent and actual queue now!
                            chrome.extension.sendMessage({curr_vid: vid_after_curr});
                            chrome.storage.local.set({most_recent: vid_after_curr}, ()=>{realTimeHighlight();});
                        }else if(queue[i+1] === undefined){
                            let vid_before_curr = queue[i-1].link;

                            //send the next vid after the vid that was removed if curr vid playin was the one u removed... and update most recent and actual queue now!
                            chrome.extension.sendMessage({curr_vid: vid_before_curr});
                            chrome.storage.local.set({most_recent: vid_before_curr}, ()=>{realTimeHighlight();});
                        }
                    }

                    spliceList(queue, i);
                    checkIfEmpty(queue);
                });
                
                //break out of loop after removal/locating of ele needed to be removed
                break;
            }
        }

        // chrome.storage.local.set({queue_list: queue});
    });

    // remove from DOM
    $(node_to_remove).remove();

    // console.log(node_to_remove);
});
