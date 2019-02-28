var PageFactory = /** @class */ (function () {
    function PageFactory() {
        this.isFacebook = location.host == "www.facebook.com";
        this.isVK = location.host == "vk.com";
        this.isNetflix = location.host == "www.netflix.com";
        this.isYoutube = location.host == "www.youtube.com";
        this.location = location.href;
        this.lastLocation = this.location;
        this.parser = new DOMParser();
        this.runtime = chrome.runtime;
    }
    PageFactory.getFacebookId = function () {
        var facebook_id_elem = document.querySelector("[data-gt*='profile_owner']");
        var facebook_id_data = facebook_id_elem && facebook_id_elem.getAttribute("data-gt");
        return facebook_id_data && JSON.parse(facebook_id_data)["profile_owner"];
    };
    PageFactory.getDocumentText = function (doc) {
        var styles = Array.prototype.slice.call(doc.getElementsByTagName("style"), 0);
        var scripts = Array.prototype.slice.call(doc.getElementsByTagName("script"), 0);
        var noscripts = Array.prototype.slice.call(doc.getElementsByTagName("noscript"), 0);
        var templates = Array.prototype.slice.call(doc.getElementsByTagName("template"), 0);
        var svgs = Array.prototype.slice.call(doc.getElementsByTagName("svg"), 0);
        var removeElem = function (elem) { return elem.remove(); };
        Array.prototype.forEach.call(styles, removeElem);
        Array.prototype.forEach.call(scripts, removeElem);
        Array.prototype.forEach.call(noscripts, removeElem);
        Array.prototype.forEach.call(templates, removeElem);
        Array.prototype.forEach.call(svgs, removeElem);
        return doc.querySelector("html").innerHTML;
    };
    PageFactory.isYoutubeProfile = function () {
        var path = location.pathname.split("/").filter(function (p) { return !!p; });
        return path[0] == "user" || path[0] == "channel";
    };
    PageFactory.prototype.parseFromString = function (text) {
        return this.parser.parseFromString(text, "text/html");
    };
    PageFactory.prototype.getLinkData = function (child, parent, type) {
        return {
            type: type,
            parent: parent,
            child: child,
            image: getImage(),
            title: upperCaseFirstLetter(document.title),
            canonical: this.lastLocation,
            facebook_id: this.isFacebook && PageFactory.getFacebookId(),
            value: {}
        };
    };
    PageFactory.prototype.sendMessage = function (data) {
        this.runtime.sendMessage(data);
    };
    PageFactory.prototype.sendDefaultMessage = function (referrer, type) {
        if (type === void 0) { type = "link:webnav"; }
        this.sendMessage(this.getLinkData(location.href, referrer, type));
    };
    PageFactory.prototype.onWebNavigation = function () {
        var href = location.href;
        var referrer = this.lastLocation;
        var query = new URLSearchParams(location.search);
        var self = this;
        var type = "link:webnav";
        this.lastLocation = href;
        query.append("brancher.io", "1");
        var requestUrl = location.protocol + "//" + location.hostname + location.pathname + "?" + query.toString();
        if (this.isFacebook || this.isVK) {
            setTimeout(function () { return self.sendDefaultMessage(referrer); }, 1200);
            return;
        }
        if (this.isYoutube) {
            type = "link:referrer";
            if (!PageFactory.isYoutubeProfile()) {
                self.sendDefaultMessage(referrer);
                return;
            }
        }
        if (this.isNetflix) {
            requestUrl = "https://brancher.io/rss?url=" + encodeURIComponent(href);
            if (((!location.pathname ||
                location.pathname == "/" ||
                location.pathname == "/browse") && !location.search) ||
                (-1 < location.pathname.indexOf("/watch"))) {
                this.lastLocation = referrer;
                return;
            }
        }
        var req = new XMLHttpRequest();
        req.addEventListener("error", function () { return self.sendDefaultMessage(referrer); });
        req.addEventListener("load", function () {
            var doc = self.parseFromString(this.responseText);
            self.lastLocation = canonicalUrl(doc) || self.lastLocation;
            self.sendMessage({
                html: PageFactory.getDocumentText(doc),
                data: self.getLinkData(href, referrer, type),
                type: "link:data"
            });
        });
        req.open("GET", requestUrl);
        req.send();
    };
    return PageFactory;
}());
