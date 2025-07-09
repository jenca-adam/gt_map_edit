const map = L.map('mapview-map', {
    boxZoom: false
}).setView([0, 0], 2);
const mapId = Number(new URL(document.location).pathname.split("/").at(-1));
const overlay = $("#overlay")[0];
var drops;
var bbox;
var markerPositions;
var markerPosBuffer = 0;
var selectedMarkers = [];
var selMarkerPositions;
var selMarkerPosBuffer = 0;
var dropsById = {};
var activeId = 0;
var dragStartPos;
var isDraggingBox = false;
var box;
var boxStart;
var boxEnd;
var projectedMarkersBuffer = 0;
var projectedMarkers;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 16,
    minZoom: 2,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const coverageLayer = L.tileLayer('https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*212b1!3m18!2sen!3sUS!5e0!12m4!1e68!2m2!1sset!2sRoadmap!12m4!1e37!2m2!1ssmartmaps!2s!12m4!1e26!2m2!1sstyles!2ss.e:g|p.c:#f03e3e|p.w:10,s.e:g.s|p.v:off!4i0!5m2!1e0!5f2', {
    maxZoom: 16,
    minZoom: 2,
    attribution: '&copy; Google'
});
// MARKER INTERACTION

$("#mapview-map").mousedown(function(ev) {
    dragStartPos = [ev.clientX, ev.clientY];
    //MULTI SELECT
    if (ev.shiftKey && ev.button === 0) { // Left-click + Shift
        isDraggingBox = true;
        var offset = $("#mapview-map").offset();

        boxStart = map.mouseEventToLayerPoint(ev);
        L.DomUtil.disableTextSelection();
        console.log(map._panes.overlayPane);
        box = L.DomUtil.create('div', 'zoom-box', map._panes.overlayPane);
        box.style.position = 'absolute';
        box.style.border = '2px dashed #38f';
        box.style.backgroundColor = 'rgba(0, 119, 255, 0.1)';

        map.dragging.disable();
    }

})
$("#mapview-map").mousemove(function(ev) {
    if (!isDraggingBox) return;

    var offset = $("#mapview-map").offset();
    boxEnd = map.mouseEventToLayerPoint(ev);


    const min = boxStart;
    const max = boxEnd;

    const left = Math.min(min.x, max.x);
    const top = Math.min(min.y, max.y);
    const width = Math.abs(max.x - min.x);
    const height = Math.abs(max.y - min.y);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
});
$("#mapview-map").mousemove(function(ev) {
    if (!drops) return;

    var color = hexToRgb($("#marker-color").val(), 1);
    var offset = $("#mapview-map").offset();
    var x = ev.clientX - offset.left;
    var y = ev.clientY - offset.top;

    var s = (core.isOnMarker(x, $("#mapview-map").height() - y) >>> 0);
    var screencolor = [((s >> 24) & 255), ((s >> 16) & 255), ((s >> 8) & 255)];
    if (compareColors(screencolor, color)) {
        $("#mapview-map").css({
            "cursor": "pointer"
        });
    } else {
        $("#mapview-map").css({
            "cursor": ""
        });
    }
});
$("#mapview-map").mouseup(function(ev) {
    map.dragging.enable();
    if (isDraggingBox) {
        isDraggingBox = false;
        if (box && box.parentNode) {
            box.parentNode.removeChild(box);
        }
        box = null;

        var offset = $("#mapview-map").offset();
        const minx = Math.min(boxStart.x, boxEnd.x);
        const miny = Math.min(boxStart.y, boxEnd.y) ;
        const maxx = Math.max(boxStart.x, boxEnd.x) ;
        const maxy = Math.max(boxStart.y, boxEnd.y);
        const topLeft = map.layerPointToLatLng(L.point(minx, miny), map.getZoom());

        const botRight = map.layerPointToLatLng(L.point(maxx, maxy), map.getZoom());
        const topLeftProjected = projectSingle(topLeft.lat, topLeft.lng, 1);
        const botRightProjected = projectSingle(botRight.lat, botRight.lng, 1);
        boxSelect(topLeftProjected[0], topLeftProjected[1], botRightProjected[0], botRightProjected[1]);
    }
    console.log(dragStartPos, ev.clientX, ev.clientY);
    if (dragStartPos[0] != ev.clientX || dragStartPos[1] != ev.clientY) {
        return;
    }
    var offset = $("#mapview-map").offset();
    var x = ev.clientX - offset.left;
    var y = ev.clientY - offset.top;
    var color = hexToRgb($("#marker-color").val(), 1);
    var s = core.isOnMarker(x, $("#mapview-map").height() - y) >>> 0;
    var screencolor = [((s >> 24) & 255), ((s >> 16) & 255), ((s >> 8) & 255)];
    console.log(screencolor);

var ll=map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom())
         
        var xy =projectSingle(ll.lat, ll.lng,1);
        console.log("M", ll.lat, ll.lng ,xy);

    if (compareColors(screencolor, color)) {
        var ll=map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom())
         
        var xy =projectSingle(ll.lat, ll.lng,1);
        console.log("M", ll.lat, ll.lng ,xy);
        var drop = core.closestMarker(xy[0], xy[1], Infinity);
        console.log(drop, xy);
        if (!ev.shiftKey) {
            selectedMarkers = [];
        }
        selectedMarkers.push(drop);
        if (drop) console.log(dropsById[drop]);
        activeId = drop;
        makeMarkerBuffer();
        drawMarkers();
    } else if (selectedMarkers && !ev.shiftKey) {
        selectedMarkers = [];
        makeMarkerBuffer();
        drawMarkers();
    }
})


// utils
function boxSelect(x1, y1, x2, y2) {
    console.log(x1,y1,x2,y2);
    const idBuffer = core.createUintBuffer(drops.length);
    const numDrops = core.boxSelect(x1, y1, x2, y2, idBuffer);
    const dropIds = Module.HEAPU32.slice(idBuffer / Uint32Array.BYTES_PER_ELEMENT, idBuffer / Uint32Array.BYTES_PER_ELEMENT + numDrops);
    console.log(dropIds);
    selectedMarkers.push(...dropIds);
    if (numDrops > 0) {
        makeMarkerBuffer();
        drawMarkers();
    }
}

function compareColors(rgb1, rgb2) {
    return rgb1[0] == rgb2[0] && rgb1[1] == rgb2[1] && rgb1[2] == rgb2[2]
}

function hexToRgb(hex, div = 255.0) {
    var bigint = hexToPack(hex);
    var r = ((bigint >> 16) & 255) / div;
    var g = ((bigint >> 8) & 255) / div;
    var b = (bigint & 255) / div;
    return [r, g, b]
}

function hexToPack(hex) {
    return parseInt(hex.substr(1), 16);
}

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

function makeMarkerBuffer() {
    // creates a buffer of marker positions
    // called every time markers update and when they load for the first time
    markerPositions = new Float32Array(
        drops.filter(
            (drop) => !selectedMarkers.includes(drop.id)
        ).map(
            (drop) => [drop.lat, drop.lng]
        ).flat()
    );
    if (markerPosBuffer) {
        core.destroyBuffer(markerPosBuffer);
    }
    markerPosBuffer = core.createFloatBuffer(markerPositions.length);
    Module.HEAPF32.set(markerPositions, markerPosBuffer / Float32Array.BYTES_PER_ELEMENT);
    if (selectedMarkers) {
        selMarkerPositions = new Float32Array(
            selectedMarkers.map(
                (dropId) => {
                    var drop = dropsById[dropId];
                    return [drop.lat, drop.lng]
                }
            ).flat()
        );

        if (selMarkerPosBuffer) {
            core.destroyBuffer(selMarkerPosBuffer);
        }
        selMarkerPosBuffer = core.createFloatBuffer(selMarkerPositions.length);
        Module.HEAPF32.set(selMarkerPositions, selMarkerPosBuffer / Float32Array.BYTES_PER_ELEMENT);
    } else if (selMarkerPosBuffer) {
        core.destroyBuffer(selMarkerPosBuffer);
    }
    var projectResult = projectMarkers(markerPosBuffer, markerPositions.length, 1.0);
    projectedMarkersBuffer = projectResult[0];
    projectedMarkers = projectResult[1];
}

function gridMarkers() {
    var markerIds = new Uint32Array(drops.map((drop) => drop.id));
    var markerIdBuffer = core.createUintBuffer(markerPositions.length);
     Module.HEAPU32.set(markerIds, markerIdBuffer / Uint32Array.BYTES_PER_ELEMENT);
    Module.HEAPF32.set(projectedMarkers, projectedMarkersBuffer / Float32Array.BYTES_PER_ELEMENT);
    core.loadMarkers(projectedMarkersBuffer, markerIdBuffer, markerPositions.length,0.01);
    core.destroyBuffer(markerIdBuffer);
    core.destroyBuffer(projectedMarkersBuffer);
}

function projectMarkers(markerBuffer, l, scale){
    const buf = core.createFloatBuffer(l);
    const transform = map.options.crs.transformation
    core.multiProject(markerBuffer, l, scale, transform._a, transform._b, transform._c, transform._d,buf)
    var m= Module.HEAPF32.slice(buf/Float32Array.BYTES_PER_ELEMENT, buf/Float32Array.BYTES_PER_ELEMENT+l);
    return [buf,m];
}

function projectSingle(lat, lon, scale){
    const buf = core.createFloatBuffer(2);
    Module.HEAPF32.set([lat,lon], buf/Float32Array.BYTES_PER_ELEMENT);
    const projected= projectMarkers(buf, 2, scale);
    core.destroyBuffer(buf);
    core.destroyBuffer(projected[0]);
    return projected[1];
}
function _drawMarkers(buf1, l1, buf2, l2, rgb) {
    var transform = map.options.crs.transformation;
    var origin = map.getPixelOrigin();
    var zoom = map.getZoom();
    var panpos = map._getMapPanePos();

    core.drawMarkers(buf1, l1, buf2, l2, transform._a, transform._b, transform._c, transform._d, origin.x - panpos.x, origin.y - panpos.y, zoom, 11.0, rgb[0], rgb[1], rgb[2], 1 - rgb[0], 1 - rgb[1], 1 - rgb[2]);
}

function drawMarkers() {
    if (!markerPositions) return;
    console.log(map.options.crs.transformation);
    core.clearScreen(0, 0, 0, 0);
    /*var markerPositions = new Float32Array(drops.map((drop) => {
        var pt = map.latLngToContainerPoint(L.latLng(drop.lat, drop.lng));
        return [(pt.x - overlay.offsetWidth / 2) / overlay.offsetWidth * 2, -(pt.y - overlay.offsetHeight / 2) / overlay.offsetHeight * 2]
    }).filter((loc) => loc[0] < 1 && loc[0] > -1 && loc[1] < 1 && loc[1] > -1).flat());*/
    var rgb = hexToRgb($("#marker-color").val());
    _drawMarkers(markerPosBuffer, markerPositions.length, selMarkerPosBuffer, selectedMarkers.length * 2, rgb);
}

function highlightActiveMarker() {
    if (activeId) {
        var drop = dropsById[activeId];

        var rgb = hexToRgb($("#marker-color").val());
        var singleMarkerPosition = new Float32Array([drop.lat, drop.lng]);
        var singlePositionBuffer = core.createFloatBuffer(2);
        Module.HEAPF32.set(singleMarkerPosition, singlePositionBuffer / Float32Array.BYTES_PER_ELEMENT);
        _drawMarkers(singlePositionBuffer, 2, [0, 1, 0]);

    }

};

function zoomToMarkers() {
    map.fitBounds(bbox);
};

function stretchOverlay() {
    overlay.width = overlay.parentElement.offsetWidth;
    overlay.height = overlay.parentElement.offsetHeight;
}

function mapChanged() {
    if (drops) {
        drawMarkers()
    }
}
map.on("move", mapChanged)

map.on("zoomstart", function() {
    requestAnimationFrame(mapChanged);
});
map.on("zoomend", function() {
    cancelAnimationFrame(mapChanged);
});
map.on("resize", function() {
    if (drops) {
        stretchOverlay();
        core.stretch();
        drawMarkers()
    }
});
$("#reset-map").click(function() {
    if (bbox) {
        map.fitBounds(bbox);
    }
    if (drops) {
        drawMarkers();
    }
});
$("#marker-color").change(mapChanged); //it didnt!
$("#show-coverage").change(function() {
    if ($(this).is(":checked")) {
        coverageLayer.addTo(map);
    } else {
        coverageLayer.removeFrom(map);
    }
});
$(document).ready(function() {
    if (!localStorage.token) {
        logOut();
    }
    if ($("#show-coverage").is(":checked")) {
        coverageLayer.addTo(map);
    }
    stretchOverlay();
    getMapDrops(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            console.error(response.message);
        } else {
            console.log(response.response);
            drops = response.response;
            bbox = getBbox(drops);
            if (bbox) {
                map.fitBounds(bbox);
            }
            core.waitInitted().then(() => {
                makeMarkerBuffer();
                for (var drop of drops) {
                    dropsById[drop.id] = drop;
                }
                gridMarkers();
                drawMarkers();
            });
        }
    });
});
//pmtiles.leafletRasterLayer(layer,{attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>'}).addTo(map)
