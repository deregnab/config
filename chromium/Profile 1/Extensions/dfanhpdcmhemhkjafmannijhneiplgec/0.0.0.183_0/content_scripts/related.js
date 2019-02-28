/**
 * Created by sokolandia on 3/12/17.
 */
var iframe = document.createElement("iframe");
iframe.src = chrome.extension.getURL("/related.html");
iframe.id = "brancher-related";
document.body.appendChild(iframe);
function removeRelated() {
    var related = document.getElementById("brancher-related");
    related && document.body.removeChild(related);
}
