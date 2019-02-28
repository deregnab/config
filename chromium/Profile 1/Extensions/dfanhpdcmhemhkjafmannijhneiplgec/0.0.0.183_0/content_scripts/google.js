/**
 * Created by sokolandia on 4/12/16.
 */
window.addEventListener("load", listen);
function listen() {
    new LinksListener().listen();
    chrome.runtime.sendMessage({
        child: location.href,
        value: getValue(),
        type: "link:google"
    });
    function getValue() {
        return { image: getImage(true), description: getDescription() };
    }
    function getDescription() {
        var descriptionElem = document.getElementsByClassName("kno-rdesc")[0];
        if (descriptionElem) {
            var descriptionChildElem = descriptionElem.childNodes[0];
            return descriptionChildElem && descriptionChildElem.textContent;
        }
    }
}
