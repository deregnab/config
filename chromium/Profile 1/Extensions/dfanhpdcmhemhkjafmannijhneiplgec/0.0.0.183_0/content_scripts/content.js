/**
 * Created with PyCharm.
 * User: sokolandia
 * Date: 6/9/15
 * Time: 9:06 PM
 * To change this template use File | Settings | File Templates.
 */
var PageMetaFacory = /** @class */ (function () {
    function PageMetaFacory(doc) {
        if (doc === void 0) { doc = document; }
        this.doc = doc;
    }
    PageMetaFacory.prototype.isPdf = function () {
        return !!(this.doc.querySelector("body").children.length == 1 &&
            this.doc.querySelector("embed[type='application/pdf']"));
    };
    PageMetaFacory.prototype.extract = function (child, parent, type, image, favicon) {
        var canonical = this.getLink();
        var result = { type: type, parent: parent, child: child, canonical: canonical, image: image };
        if (this.isPdf()) {
            result.value = { type: "PDF" };
            return result;
        }
        var loc = this.doc.location;
        var uri = {
            spec: loc.href,
            host: loc.host,
            prePath: loc.protocol + "//" + loc.host,
            scheme: loc.protocol.substr(0, loc.protocol.indexOf(":")),
            pathBase: loc.protocol + "//" + loc.host + loc.pathname.substr(0, loc.pathname.lastIndexOf("/") + 1)
        };
        var value = result.value = {
            title: this.getPageTitle(),
            image: this.getMetaProp("image") || image,
            rss: this.getRSS(),
            tags: this.getKeywords(),
            favicon: this.getFavicon() || favicon
        };
        var metaType = this.getMetaProp("type");
        var coords = this.getGeo();
        var description = this.getMetaProp("description");
        var address, article, geocodeAddress, textFragment;
        if (loc.host != "www.youtube.com") {
            try {
                address = ziprip.extract(this.doc, loc.href)[0];
                article = new Readability(uri, this.doc).parse();
            }
            catch (err) { }
        }
        if (article) {
            textFragment = PageMetaFacory.cleanTextFragment(article.textContent);
        }
        if (address) {
            geocodeAddress = address.formatForGeocode();
            if (address.isGeocoded()) {
                coords = address.lat + "," + address.lon;
            }
        }
        value.isArticle = (textFragment && textFragment.length > 2000);
        value.address = geocodeAddress;
        value.geo = coords;
        if (metaType != "website" && metaType != "object") {
            value.type = metaType;
        }
        value.description = PageMetaFacory.cleanTextFragment(description) || textFragment;
        if (value.description) {
            value.description = value.description.slice(0, 500);
        }
        return result;
    };
    PageMetaFacory.prototype.getPageTitle = function () {
        var title = this.doc.title;
        if (!title) {
            var meta = this.doc.querySelector("meta[property='og:title']");
            title = meta && meta.getAttribute("content");
        }
        return upperCaseFirstLetter(title);
    };
    PageMetaFacory.prototype.getLink = function () {
        return canonicalUrl(this.doc);
    };
    PageMetaFacory.prototype.getContent = function (prop) {
        var elem = this.doc.querySelector("meta[name='" + prop + "']");
        if (elem) {
            return elem.getAttribute("content");
        }
    };
    PageMetaFacory.prototype.getAttrContent = function (prop) {
        var elem = this.doc.querySelector("meta[property='" + prop + "']");
        if (elem) {
            return elem.getAttribute("content");
        }
    };
    PageMetaFacory.prototype.getMetaProp = function (prop) {
        return this.getAttrContent("og:" + prop) || this.getContent(prop);
    };
    PageMetaFacory.prototype.getFavicon = function () {
        var icon = this.doc.querySelector("link[rel='icon']") || this.doc.querySelector("link[rel='shortcut icon']");
        if (icon) {
            return icon.getAttribute("href");
        }
    };
    PageMetaFacory.prototype.getKeywords = function () {
        var keywords = this.getContent("news_keywords") || this.getContent("keywords");
        if (keywords) {
            return keywords.split(",")
                .map(function (tag) { return tag.trim().toLocaleLowerCase(); })
                .filter(function (tag, ind, array) { return tag && tag.length < 25 && array.indexOf(tag) == ind; })
                .slice(0, 10);
        }
    };
    PageMetaFacory.prototype.getRSS = function () {
        var rss = (this.doc.querySelector("link[type='application/rss+xml']") ||
            this.doc.querySelector("link[type='application/atom+xml']"));
        if (rss) {
            return rss.href;
        }
    };
    PageMetaFacory.prototype.getGeo = function () {
        var maps = this.doc.querySelector("a[href*='www.google.com/maps/place']");
        if (maps) {
            var coords = maps.href.split("@")[1].split("/")[0].split(",");
            if (coords.length == 2) {
                return parseFloat(coords[0]) + "," + parseFloat(coords[1]);
            }
        }
        var ICBM = this.doc.querySelector("meta[name='ICBM']");
        var geo = this.doc.querySelector("meta[name='geo.position']");
        var position;
        if (geo) {
            position = geo.getAttribute("content");
        }
        if (ICBM) {
            position = ICBM.getAttribute("content") || position;
        }
        if (position) {
            var coords = position.split(/[\s,;|]+/);
            if (coords.length == 2) {
                return coords.join(",");
            }
        }
    };
    PageMetaFacory.cleanTextFragment = function (textFragment) {
        return textFragment && textFragment.replace(/(\r\n|\n|\r|\s+)/gm, " ").trim();
    };
    return PageMetaFacory;
}());
