const map = L.map('mapview-map').setView([0, 0], 1);
const mapId = Number(new URL(document.location).pathname.split("/").at(-1));
const overlay = $("#overlay")[0];
var drops;
var bbox;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
L.tileLayer('https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*212b1!3m18!2sen!3sUS!5e0!12m4!1e68!2m2!1sset!2sRoadmap!12m4!1e37!2m2!1ssmartmaps!2s!12m4!1e26!2m2!1sstyles!2ss.e:g|p.c:#f03e3e|p.w:10,s.e:g.s|p.v:off!4i0!5m2!1e0!5f2', {
    maxZoom: 19,
    attribution: '&copy; Google'
}).addTo(map);
$("#mapview-map").click(function(ev) {
    console.log(ev);
    var offset = $("#mapview-map").offset();
    console.log(map.layerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom()));
})

function getBbox() {
    var bbox = [
        [Infinity, Infinity],
        [-Infinity, -Infinity]
    ];
    for (var drop of drops) {
        bbox[0][0] = Math.min(bbox[0][0], drop.lat);
        bbox[0][1] = Math.min(bbox[0][1], drop.lng);
        bbox[1][0] = Math.max(bbox[1][0], drop.lat);
        bbox[1][1] = Math.max(bbox[1][1], drop.lng);
    }
    console.log(bbox);
    return bbox;
}

function drawMarkers() {
    console.log(map.options.crs.transformation);
    overlayApi.clearScreen(0, 0, 0, 0);
    /*var markerPositions = new Float32Array(drops.map((drop) => {
        var pt = map.latLngToContainerPoint(L.latLng(drop.lat, drop.lng));
        return [(pt.x - overlay.offsetWidth / 2) / overlay.offsetWidth * 2, -(pt.y - overlay.offsetHeight / 2) / overlay.offsetHeight * 2]
    }).filter((loc) => loc[0] < 1 && loc[0] > -1 && loc[1] < 1 && loc[1] > -1).flat());*/
    var markerPositions = new Float32Array(drops.map((drop)=>[drop.lat, drop.lng]).flat());
    var transform = map.options.crs.transformation;
    var origin = map.getPixelOrigin();
    var zoom = map.getZoom();
    var panpos = map._getMapPanePos();
    console.log(markerPositions);
    var buffer = overlayApi.createFloatBuffer(markerPositions.length);
    console.log(buffer);
    Module.HEAPF32.set(markerPositions, buffer / Float32Array.BYTES_PER_ELEMENT);
    overlayApi.drawMarkers(buffer, markerPositions.length, transform._a, transform._b, transform._c, transform._d, origin.x-panpos.x, origin.y-panpos.y, zoom, 10.0);
    overlayApi.destroyBuffer(buffer);

}

function zoomToMarkers() {
    map.fitBounds(bbox);
};

function stretchOverlay() {
    overlay.width = overlay.parentElement.offsetWidth;
    overlay.height = overlay.parentElement.offsetHeight;
}
function mapChanged(){
    if (drops) {
        drawMarkers()
    }
}
map.on("move", mapChanged)

map.on("zoomstart", function() {
    requestAnimationFrame(mapChanged);
});
map.on("zoomend", function(){
    cancelAnimationFrame(mapChanged);
});
$(window).resize(function() {
    stretchOverlay();
    if (drops) {
        overlayApi.stretch();
        drawMarkers()
    }
});

$(document).ready(function() {
    if (!localStorage.token) {
        logOut();
    }
    stretchOverlay();
    getMapDrops(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            console.error(response.message);
        } else {
            console.log(response.response);
            drops = response.response;
            bbox = getBbox(drops);
            map.fitBounds(bbox);
            drawMarkers();
        }
    });
});
Module.onRuntimeInitialized = () => {
    if (overlayApi.initWebgl() == -1) {
        alert("fail");
    }
    overlayApi.clearScreen(0, 0, 0, 0);
};

const overlayApi = {

    initWebgl: Module.cwrap("init_webgl", "number", []),
    clearScreen: Module.cwrap("clear_screen", "", ["number", "number", "number", "number"]),
    drawMarkers: Module.cwrap("draw_markers", "", ["number", "number", "float", "float", "float", "float", "float", "float", "float", "float"]),
    createFloatBuffer: Module.cwrap("create_float_buffer", "number", ["number"]),
    destroyBuffer: Module.cwrap("destroy_buffer", "", ["number"]),
    stretch: Module.cwrap("stretch", "", []),
};

//pmtiles.leafletRasterLayer(layer,{attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>'}).addTo(map)
