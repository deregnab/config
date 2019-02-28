/**
 * Created by sokolandia on 3/5/17.
 */
var iframe = document.createElement("iframe");
iframe.src = chrome.extension.getURL("/page.html");
iframe.id = "brancher";
removeTree();
document.body.appendChild(iframe);
document.body.style.overflow = "hidden";
