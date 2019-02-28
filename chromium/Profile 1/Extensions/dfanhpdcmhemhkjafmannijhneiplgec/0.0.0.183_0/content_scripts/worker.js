/**
 * Created by sokolandia on 7/13/17.
 */
var _this = this;
importScripts("../components/jsdom.js", "../components/Readability.js", "../components/ziprip.0.0.3.min.js", "canonical.js", "content.js");
var JSDOMWindow = new jsdom.JSDOM("").window;
var ignoreProps = ['self', 'postMessage', 'location', 'navigator', 'onmessage'];
Object.getOwnPropertyNames(JSDOMWindow)
    .filter(function (prop) { return !ignoreProps.some(function (p) { return p == prop; }); })
    .forEach(function (prop) { return _this[prop] = JSDOMWindow[prop]; });
onmessage = function (event) {
    var linkHTML = event.data;
    var _a = linkHTML.data, child = _a.child, parent = _a.parent, type = _a.type, image = _a.image, favicon = _a.favicon;
    var dom = new jsdom.JSDOM(linkHTML.html, {
        url: child,
        contentType: "text/html"
    });
    var pageMeta = new PageMetaFacory(dom.window.document);
    var linkData = pageMeta.extract(child, parent, type, image, favicon);
    postMessage(linkData);
};
