console.log("RUNNING");

chrome.runtime.onMessage.addListener(function(request, sender, senderResponse){
    console.log("New page loaded!");

    if(request.curr_vid !== undefined){
        let redirect_to_here = request.curr_vid;

        chrome.storage.local.get("originTab", function(result){
            chrome.tabs.update(result.originTab, {url: redirect_to_here}, function(){
                // if origin tab no longer exits, redirect to queue vid on whichever page url made the request
                // then update origin tab to this new page we are using! This is hard, as googles async APIs
                // lead to this nesting of callbacks... therefore, we have no real access to sender.tab.id at the time
                // of update below. we needed to do a lil hack to fix this... kinda nasty. 
                //NVM... just gonna call tabs query to get active tab to update origin tab easily and update curr window easily... the nesting of asyn isn't pretty smh
                if(chrome.runtime.lastError){
                    console.log("origin tab closed... creating new one");
                    chrome.tabs.create({url: redirect_to_here}, function(newTab){
                        console.log("new tab opened");
                        console.log(newTab.id);
                        chrome.storage.local.set({originTab: newTab.id});
                    });
                }
            });
        });
    }

    if(request.type === "getOriginTab"){
        senderResponse({activeTab: sender.tab.id});
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
    if(details.frameId === 0) {
        // Fires only when details.url === currentTab.url
        chrome.tabs.get(details.tabId, function(tab) {
            if(tab.url === details.url) {
                chrome.tabs.executeScript(details.tabId, {file:"content.js"});
            }
        });
    }
});

// chrome.webNavigation.onHistoryStateUpdated.addListener(function (details) {
//     console.log(details);
//     console.log("updating...");
//     chrome.tabs.executeScript(details.tabId, {file:"content.js"});
    
// });

// chrome.webNavigation.onCompleted.addListener(function(details) {
//     if(details.frameId === 0) {
//         chrome.tabs.executeScript(details.tabId, {"file": "content.js"}); 
//     }
// });