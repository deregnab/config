/**
 * Created by sokolandia on 5/19/17.
 */
var iframe = document.createElement("iframe");
var mostVisited = document.getElementById("most-visited");
var treeHideClass = "brancher--tree-hidden";
iframe.src = chrome.extension.getURL("/newtab.html");
iframe.id = "brancher";
iframe.className = treeHideClass;
if (!mostVisited) {
    document.body.appendChild(iframe);
}
else {
    document.body.insertBefore(iframe, mostVisited);
}
function showLastTreeChange() {
    if (iframe.className == treeHideClass) {
        iframe.className = "";
    }
    else {
        iframe.className = treeHideClass;
    }
}
