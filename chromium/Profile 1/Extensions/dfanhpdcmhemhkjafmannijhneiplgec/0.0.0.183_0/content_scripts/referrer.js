/**
 * Created by sokolandia on 6/22/15.
 */
var page = new PageFactory();
var timeout = setTimeout(function () {
    window.removeEventListener("load", onLoad);
    onPageLoad();
}, 4500);
window.addEventListener("load", onLoad);
function onLoad() {
    clearTimeout(timeout);
    onPageLoad();
}
function onPageLoad() {
    var linksListener = new LinksListener(page);
    var referrer = document.referrer;
    page.isLoaded = true;
    page.lastLocation = canonicalUrl(document) || page.lastLocation;
    if (page.isFacebook || page.isVK) {
        page.sendDefaultMessage(referrer);
    }
    else if (page.isYoutube) {
        if (PageFactory.isYoutubeProfile()) {
            page.onWebNavigation();
        }
        else {
            page.sendDefaultMessage(referrer);
        }
        return;
    }
    else if (page.isNetflix) {
        page.onWebNavigation();
    }
    else if ("inbox.google.com" == location.hostname ||
        "mail.google.com" == location.hostname ||
        "drive.google.com" == location.hostname) {
        page.isLoaded = false;
        return;
    }
    else if ("https://www.amazon.com/" == location.href || "https://www.ebay.com/" == location.href) {
    }
    else {
        var doc = page.parseFromString(document.querySelector("html").innerHTML);
        FormsListener(page);
        page.sendMessage({
            html: PageFactory.getDocumentText(doc),
            data: page.getLinkData(location.href, referrer, "link:referrer"),
            type: "link:data"
        });
    }
    linksListener.listen();
}
