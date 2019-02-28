/**
 * Created by sokolandia on 5/21/16.
 */
function getImage(isGoogle, doc) {
    if (doc === void 0) { doc = document; }
    var images = doc.images;
    var imagesSize = {};
    var minArea = 10000;
    Array.prototype.slice.call(images).forEach(function (elem) {
        if (!elem)
            return;
        var src = elem.getAttribute("src");
        if (!src || (isGoogle && (0 === src.indexOf("/images/nav_logo") || 0 === src.indexOf("/logos/doodles"))))
            return;
        var clientWidth = elem.clientWidth, clientHeight = elem.clientHeight, width = elem.width, height = elem.height, naturalHeight = elem.naturalHeight, naturalWidth = elem.naturalWidth;
        var imgWidth = clientWidth || width;
        var imgHeight = clientHeight || height;
        var area = imgWidth * imgHeight;
        naturalWidth = naturalWidth || imgWidth;
        naturalHeight = naturalHeight || imgHeight;
        if (!(area < minArea
            || (naturalHeight * naturalWidth < minArea)
            || (imgWidth / imgHeight > 5)
            || (imgHeight / imgWidth > 5))) {
            imagesSize[src] = area;
        }
    });
    var imageSrc = Object.keys(imagesSize);
    if (imageSrc.length > 0) {
        return imageSrc.reduce(function (a, b) { return (imagesSize[a] > imagesSize[b]) ? a : b; });
    }
}
