/**
 * Created by sokolandia on 3/7/17.
 */
function canonicalUrl(doc) {
    if (doc === void 0) { doc = document; }
    var link = doc.querySelector("link[rel='canonical']");
    return link && link.href;
}
function canonicalUrlGoogle() {
    if (0 === location.host.indexOf("www.google")) {
        return location.href;
    }
    if (typeof page !== "undefined" && page.isLoaded) {
        return page.lastLocation;
    }
    if (typeof document === "undefined")
        return;
    return canonicalUrl();
}
function upperCaseFirstLetter(str) {
    str = str || "";
    return str.charAt(0).toUpperCase() + str.substring(1);
}
canonicalUrlGoogle();
