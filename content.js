
//because youtube is SPA... this is hard to detect when each page has loaded hmmm...
// may just have to default to a timeout of some certain amount to load function
// var SAPObsAttrs = {attributes: true, childList: true, subtree: false};
// var SAPObserver = new MutationObserver(function(mutations){
//     executeAll();
//     console.log("BAH");
// });

// SAPObserver.observe(document, SAPObsAttrs);

setTimeout(()=>{executeAll()}, 250);

var imgURL = chrome.extension.getURL("assets/plus.png");
// let currTab = results.currTab.url.replace(/&ab_channel=.*/, "");

    
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

// this method watches for any newly added thumbnails, and handles them in real time! no nast overhead of data structs etc
var browsingObserver = new MutationObserver(function(mutations) {
    console.log("mutation occured!");
    let mutation = mutations[0].addedNodes;

    //doesnt work for related section vids... as a row... would be just one bideo rather than a... ROW of them... hmmm
    for (var i=0; i < mutation.length; i++) {
        let currRow = mutation[i];
        let rowItems = (($(currRow).find("#items")[0]) !== undefined) ? ($(currRow).find("#items")[0]).children : ($(currRow).find("#grid-container")[0]).children; //good ol' obfuscation

        
        // currently no proper way to confirm these youtube items have rendered completely,
        // so we can opt with a quick timeout to allow the elements to render and then we can continue on...
        let give_it_some_time = setTimeout(()=>{
            for(let j = 0; j < rowItems.length; j++){
                let curr_single_vid_instance = rowItems[j];
                let curr_thumb = $(curr_single_vid_instance).find("ytd-thumbnail")[0];

                // console.log(curr_thumb);
                applyQueueButton(curr_thumb);
            }
        }, 500);
    }
});

//~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~
        //~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~
//these two could end up being merged as they only pose a slight difference in where they are searching for thumbnails!
//~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~
        //~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~
//~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~***********************~~~~~~~~~~~~~~~~~~~~~~
var columnObserver = new MutationObserver(function(mutations){
    let mutation = mutations[0].addedNodes;

    for(thumb_holder of mutation){
        let curr_col_vid_thumb = $(thumb_holder).find("ytd-thumbnail")[0];

        //cant append to thumbnail for watch later vids, as the "thumbnails" here include an anchor... which we didnt have wit normal browsing
        applyQueueButton(curr_col_vid_thumb);
    }
}, 500);

var playListObserver = new MutationObserver(function(mutations){
    let mutation = mutations[0].addedNodes;

    for(thumb_holder of mutation){
        let curr_col_vid_thumb = $(thumb_holder).find("#content.style-scope.ytd-playlist-video-renderer")[0];

        //cant append to thumbnail for watch later vids, as the "thumbnails" here include an anchor... which we didnt have wit normal browsing
        applyQueueButton(curr_col_vid_thumb);
    }
}, 500);

/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////


function executeAll(){
    console.log("Your extension is working!");

    // this is what I had in the beginning; returns all thumbnails on page! But... as page reloads, 
    // content script cant handle dynamically laoded elements. Youtube uses PJAX, so we must handle this
    // accordingly in our background script! As this comes to be the simplest way to do so.
    // $(document).ready(function(){
    console.log("page loaded");
    
    //set up origin tab to active page if origintab hasnt been established yet!
    //if origin tab has been established as well as closed then background script
    //will handle the redirect requests we make when playing thru queue
    chrome.storage.local.get("originTab", function(res){
        if(res.originTab === undefined){
            initializeOrigin();
        }
    });

    //I tried abstracting this process away into lib.js, but ofc because JS likes to make things hard, there was something
    //weird happening due to the async nature of chromes API calls. So I just put it all in one block to be called sequentially
    //this works now, but adds unneeded lines... sad
    chrome.runtime.sendMessage({type: "getCurrTab"}, function(results){
        let currTab = results.currTab.id;
        chrome.storage.local.get("originTab", function(results){
            if(currTab === results.originTab){
                setUpListener();
            }
        });
    });
    
    //currently setting timeout to allow time for youtube to load thumbnails, so we can add stuff to em
    //tried adding event listener for when all elements on page loaded, but it just never works 100%... setting a timeout
    //of about 500ms to 1.5s comes provide for good means to wait for content to load bfore we start initializing things. But,
    //this is not predictable... some peoples pages take more than that timespan to fully load, so we need a more dependable method in future
    // setTimeout(()=>{initializeButtons()}, 3000);
    
    // initializeButtons();
    
    setTimeout(()=>{set_up_observer()}, 2700);

    /////////////////////////////////////////////////////////////
    //////// EVENT HANDLERS ////////////////////////////////////
    //////////////////////////////////////////////////////////
    
    $("body").off().on("click", ".queue-button-hold", function(e){
        e.preventDefault();
        e.stopPropagation();
    
        let thumbnail_container = $(this).parent();
        let literal_thumbnail = $(thumbnail_container).find("a#thumbnail.yt-simple-endpoint.inline-block.style-scope.ytd-thumbnail")[0];
    
        //jesus hell... this was going SOOOOO BAD... I was using Jquery object to go up to parent and find the videos title and publisher,
        //but I came to explicitly use the DOM reference by using subscript [0] after find followed by innertext. Which kept returning UNDEFINED
        //for pages other than the homepage. I thankfully found a great answer online for utilizing .eq() and .html() to get the found
        //elements innerHtml/text! sheesh...
        let vid_thumbnail = $(literal_thumbnail).find("#img")[0].src;
        let vid_title = $(thumbnail_container).parent().find("#video-title").eq(0).html(); //or innerHTML?
        let vid_author = $(thumbnail_container).parent().find("a.yt-simple-endpoint.style-scope.yt-formatted-string").eq(0).html();
        let vid_link = literal_thumbnail.href;
    
        let queue_vid_instance = {
            thumbnail: vid_thumbnail,
            title: vid_title,
            author: vid_author,
            link: vid_link
        };
    
        chrome.storage.local.get("queue_list", function(result){
            let current_queue = (result.queue_list) ? result.queue_list : [];
        
            if(!checkForInstance(current_queue, queue_vid_instance)){
                current_queue.push(queue_vid_instance);
    
                chrome.storage.local.set({queue_list: current_queue}, createMessage("successfully added!", "success"));
            }else{
                createMessage("video already in queue", "failure");
            }
        });
    
        return false;
    });
}

function setUpListener(){
    console.log("setting up listener");
    // content script testing video ending detection... doesnt work fully
    // as if i skip to end of video, it doesnt register... frip
    var actual_video = $('video').get(0);
    var vid_container = $('#movie_player').get(0);
    
    // fullscreen:      html5-video-player ytp-transparent ytp-large-width-mode ad-created ytp-iv-drawer-enabled iv-module-loaded paused-mode ytp-fullscreen ytp-big-mode
    // nonfullscreen:   html5-video-player ytp-transparent ytp-large-width-mode ad-created ytp-iv-drawer-enabled iv-module-loaded paused-mode ytp-hide-info-bar

    if(actual_video !== undefined){
        chrome.storage.local.get("fullscreenSet", function(result){
            // if(vid_container !== undefined && result.fullscreenSet === true){
            //     console.log("requesting fullscreen...");
            //     vid_container.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            // }

            actual_video.addEventListener('ended', function(state){
                let FS_indicator = $(vid_container).hasClass("ytp-fullscreen");
                
                chrome.storage.local.set({fullscreenSet: FS_indicator});
              
                //currently we will get active tabs ID, and see if is the same as the one which started the queue; if not, we do NOT
                //go to next vid in queue on that page... we only go to next 
                retrieve_and_play_current_queue();
            });
        });

        
        //currently waiting 4.5s before initializing and setting up observers on pages. this is NOT good.
        //we will need to make this time much lower or get rid of it entirely in future as ppl can begin scrolling thru page
        //way before we set up anything! try lower times for certain conditions or wait for certain items to load only... usually 1s to 2s 
        //is good. But on channel pages, there can come to be A LOT of uploads being shown that arent rendered bfore we start our extension,
        //so that needs to be handled too!
    }
}