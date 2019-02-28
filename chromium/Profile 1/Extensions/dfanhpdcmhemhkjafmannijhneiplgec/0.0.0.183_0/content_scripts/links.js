/**
 * Created by sokolandia on 10/4/15.
 */
var LinksListener = /** @class */ (function () {
    function LinksListener(page) {
        var _this = this;
        this.page = page;
        this.type = "link:click";
        var handleMutations = function (mutations, observer) {
            mutations.forEach(function (mutation) { return _this.handleMutation(mutation); });
        };
        this.observer = new MutationObserver(handleMutations);
    }
    LinksListener.prototype.listen = function () {
        var _this = this;
        this.observer.observe(document.body, { childList: true, subtree: true });
        LinksListener
            .getDocumentLinks()
            .forEach(function (elem) { return _this.linkHandler(elem); });
    };
    LinksListener.prototype.disconnect = function () {
        this.observer.disconnect();
    };
    LinksListener.prototype.handleMutation = function (mutation) {
        var _this = this;
        if (mutation.type === "childList") {
            Array.prototype.slice
                .call(mutation.addedNodes)
                .forEach(function (elem) {
                var links = elem.querySelectorAll && elem.querySelectorAll("a");
                _this.linkHandler(elem);
                if (links) {
                    LinksListener
                        .getDocumentLinks(links)
                        .forEach(function (elem) { return _this.linkHandler(elem); });
                }
            });
        }
    };
    LinksListener.prototype.linkHandler = function (elem) {
        if (!elem || elem.tagName !== "A")
            return;
        var child = elem.href;
        if (child && child != "#" && child != "/") {
            elem.onclick = this.clickHandler();
        }
    };
    LinksListener.prototype.clickHandler = function () {
        var type = this.type;
        var self = this;
        return function () {
            var child = this.getAttribute("data-href") || this.href;
            var parent = location.href;
            var canonical = self.page && self.page.lastLocation;
            chrome.runtime.sendMessage({ child: child, parent: parent, type: type, canonical: canonical });
        };
    };
    LinksListener.getDocumentLinks = function (links) {
        return Array.prototype.slice.call(links || document.links);
    };
    return LinksListener;
}());
