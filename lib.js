function retrieve_and_play_current_queue(){
    chrome.storage.local.get("queue_list", function(result){
        let current_queue = (result.queue_list) ? result.queue_list : [];
        
        if(current_queue.length === 0){
            createMessage("your queue is empty!", "empty-message");
        }else{
            playVideo(current_queue, "next");
        }
    });
}

function playVideo(queue, direction){
    chrome.storage.local.get(["most_recent", "queue_list"], function(results){
        let most_recent = (results.most_recent) ? results.most_recent : queue[0].link; //or queue[1].link?
        let vid_link;

        if(direction === "next"){
            vid_link = getNextVid(results.queue_list, most_recent);
        }else if(direction === "previous"){
            vid_link = getPrevVid(results.queue_list, most_recent);
        }

        if(vid_link){
            chrome.storage.local.set({most_recent: vid_link});
            chrome.runtime.sendMessage({curr_vid: vid_link});
        }else{
            createMessage("End of Queue Reached!", "end-message");
        }

        // document.documentElement.webkitRequestFullscreen();
    });
}

function getNextVid(queue, lastPlayed){
    for(let i = 0; i < queue.length; i++){
        if(queue[i].link === lastPlayed){
            if(queue[i + 1]){
                return queue[i+1].link;
            }else{
                console.log("End of Queue Reached!");
                return;
            }
        }
    }  
}

function initializeOrigin(){
    // console.log("establishing origin tab...");
    chrome.extension.sendMessage({type: "getCurrTab"}, function(result){
        // console.log(result.activeTab);
        let currTab = result.activeTab;
        chrome.storage.local.set({originTab: currTab});
    });
}

function observe_this(targetNode, type){
    // console.log("type: " + type);
    if(type === "browsing"){
        browsingObserver.observe(targetNode, {
            attributes: false,
            childList: true,
            subtree: false
        });
    }else if(type === "playlist"){
        playListObserver.observe($(targetNode).find("#contents.style-scope.ytd-playlist-video-list-renderer")[0], {
            attributes: false,
            childList: true,
            subtree: false
        });
    }else if(type === "related" || type === "channel"){
        columnObserver.observe($(targetNode).find("#items")[0], {
            attributes: false,
            childList: true,
            subtree: false
        });
    }else if(type === "history"){
        columnObserver.observe($(targetNode).find("#contents.style-scope.ytd-item-section-renderer")[0],{
            attributes: false,
            childList: true,
            subtree: false
        });
    }
}

function set_up_observer() {
    let currentPage = window.location.href;
    let targetNode;
    // console.log("Observing...");

    $("ytd-browse.style-scope.ytd-page-manager").each(function(i){
        if($(this).attr("role") === "main"){
            targetNode = $(this).find("#contents")[0];

            if($(this).attr("page-subtype") === "playlist"){
                observe_this(targetNode, "playlist");
                initializeButtons("playlist");
            }else if($(this).attr("page-subtype") === "channels"){
                observe_this(targetNode, "channel");   
                initializeButtons("channel");
            }else if($(this).attr("page-subtype") === "history"){
                observe_this(targetNode, "history");   
                initializeButtons("history");
            }else{
                //targetnode set to this page's contents
                observe_this(targetNode, "browsing");
                initializeButtons("browsing");
            }
            // console.log(targetNode);
            return;
        }
    });

    //if we never returned in the for loop, it must mean we never found a page layer
    //with a role of main, so we must be someone other than a ytd-browse DOM element...
    //most likely a youtube video which has a related section nested in a ytd-watch-flexy
    //element. So we will check if this is the case and act accordingly. There may be other
    //times that ytd-browse pages dont have anyone with role=main, and ytd-watch-flexy appears
    //even without a related-videos section... I've yet to see it, but I guess thats wot the futures for
    let related_page_layer = document.querySelector("ytd-watch-flexy");
 
    if(related_page_layer !== undefined && related_page_layer.getAttribute("role") === "main"){
        //set up targetnode with this in mind
        targetNode = $(related_page_layer).find("ytd-watch-next-secondary-results-renderer")[0];
        observe_this(targetNode, "related");
        initializeButtons("related");
        return;
    }

    if (!targetNode) {
        window.setTimeout(()=>{set_up_observer()}, 500);
        // return;
    }
}

function applyQueueButton(curr){
    // create a div to hold the queue button and an img element for a plus icon
    let textnode = document.createElement("div");  
    textnode.className = "queue-button-hold";
    textnode.innerHTML = "<img class='add-img' alt='add to queue' title='add to queue' src='" + imgURL + "'>";            
    
    // append that new content to the current "video" DOM element, making it look similar to time and watch later overlays on thumbnail
    curr.appendChild(textnode); 
}

// we must have a method for adding queue buttons to all thumbnails initially on the page... as the mutation observer
// cannot accomplish this, sadly... so here we just look for all thumbnails on the page, and loop through them, adding
// queue buttons in the meantime. Any future thumbnails will be handled dynamically with our mutation observer

//because youtube is awful and loves SAP, if we go back to a previous page where we had already loaded up
//queue buttons for thumbnails, they will still be there if we are to end up back on that page. Thing is,
//we "intialize buttons" each time content script is laoded on a page... so now we should check to see for the initial thumbnails,
//if they already have a DOM element with class queuebuttonhold within... if so, we skip em. If for some reason they dont, well, we add
//a queue button! not the best, probably... better solutions to come heh
function initializeButtons(location){
    // console.log("creating buttons on: ");
    // console.log(location);
    let target;

    if(location === "browsing" || location === "related" || location === "channel" || location === "history"){
        target = "ytd-thumbnail";
    }else if(location === "playlist"){
        target = "#content.style-scope.ytd-playlist-video-renderer";
    }else{

    }

    $(target).each(function(i){
        if($(this).find(".queue-button-hold").length === 0){
            // create a div to hold the queue button and an img element for a plus icon
            let textnode = document.createElement("div");  
            textnode.className = "queue-button-hold";
            textnode.innerHTML = "<img class='add-img' alt='add to queue' title='add to queue' src='" + imgURL + "'>";            

            // append that new content to the current "video" DOM element, making it look similar to time and watch later overlays on thumbnail
            $(this).append(textnode); 
        }
    });
}

//appears two times
function checkForInstance(queue, vidToAdd){
    // O(n) complex; wont be that good if someone, for some reason adds thousands or millions of vids to a queue...
    for(let i = 0; i < queue.length; i++){
        // as we are comparing JS objects, we need to compare their properties, as they will be implicitly compared by their reference!
        // this could probably be more efficient; will edit later on
        if(queue[i].title === vidToAdd.title && queue[i].author === vidToAdd.author && queue[i].thumbnail === vidToAdd.thumbnail && queue[i].link === vidToAdd.link){
            return true;
        }
    }
    return false;
    // return queue.includes(vidToAdd);
}

function createMessage(message_text, id){
    let message = message_text;

    let message_DOM_ele = $(["<div class = 'info-message' id='" + id + "'>",
                                "<p>" + message + "</p>",
                            "</div>"].join("\n"));

    $(document.body).append(message_DOM_ele);

    $(message_DOM_ele).animate({
        bottom: "30px"
    }, 350, () => {$(message_DOM_ele).animate({
        opacity : 0 
    }, 1300, () => {$(message_DOM_ele).hide()});}
    );
}