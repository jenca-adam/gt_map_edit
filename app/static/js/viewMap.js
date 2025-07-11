const map = L.map('mapview-map', {
    boxZoom: false,
    maxBounds: [
        [-90, -Infinity],
        [90, Infinity]
    ],
    maxBoundsViscosity: 1.0
}).setView([0, 0], 1);
const url = new URL(document.location);
const urlComponents = url.pathname.split("/");
const mapId = Number(urlComponents[3]);
var groupId;
const pageSize = 50;
const dgOrMap = urlComponents[2];
const dgTemplate = document.querySelector("#dg-template");
const dTemplate = document.querySelector("#drop-template");
const overlay = $("#overlay")[0];
var drops;
var bbox;
var markerPositions;
var markerPosBuffer = 0;
var selectedMarkers = new Set();
var selMarkerPositions;
var selMarkerPosBuffer = 0;
var dropsById = {};
var dropEls = {};
var dragStartPos;
var dropGroups;
var isDraggingBox = false;
var box;
var boxStart;
var boxEnd;
var projectedMarkersBuffer = 0;
var projectedMarkers;
var mapData;
var groupData;
var dropPage;
var numPages;

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    minZoom: 1,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const coverageLayer = L.tileLayer('https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*212b1!3m18!2sen!3sUS!5e0!12m4!1e68!2m2!1sset!2sRoadmap!12m4!1e37!2m2!1ssmartmaps!2s!12m4!1e26!2m2!1sstyles!2ss.e:g|p.c:#f03e3e|p.w:10,s.e:g.s|p.v:off!4i0!5m2!1e0!5f2', {
    maxZoom: 18,
    minZoom: 1,
    attribution: '&copy; Google'
});
// MARKER INTERACTION
function cancelBoxDrag() {
    isDraggingBox = false;
    if (box && box.parentNode) {
        box.parentNode.removeChild(box);
    }
    box = null;

    L.DomUtil.enableTextSelection();

}
$("#mapview-map").mousedown(function(ev) {
    dragStartPos = [ev.clientX, ev.clientY];
    //MULTI SELECT
    if (ev.shiftKey && ev.button === 0) { // Left-click + Ctrl
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
    if (!ev.shiftKey) {
        cancelBoxDrag();
        boxStart = null;
        boxEnd = null;
        return;
    }
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
    if (!drops || !core._INITTED) return;

    var color = hexToRgb($("#marker-color").val(), 1);

    var invcolor = [255 - color[0], 255 - color[1], 255 - color[2]];
    var offset = $("#mapview-map").offset();
    var x = ev.clientX - offset.left;
    var y = ev.clientY - offset.top;
    var s = (core.isOnMarker(x, $("#mapview-map").height() - y) >>> 0);
    var screencolor = [(s & 255), ((s >> 8) & 255), ((s >> 16) & 255)];
    var alpha = (s>>24) & 255;
    
    if ((compareColors(screencolor, color) || compareColors(screencolor, invcolor))&&alpha) {
        console.log(x, $("#mapview-map").height() - y)
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
    if (ev.button != 0) return;
    map.dragging.enable();
    if (isDraggingBox) {
        cancelBoxDrag();
        if (boxEnd) {
            var offset = $("#mapview-map").offset();
            const minx = Math.min(boxStart.x, boxEnd.x);
            const miny = Math.min(boxStart.y, boxEnd.y);
            const maxx = Math.max(boxStart.x, boxEnd.x);
            const maxy = Math.max(boxStart.y, boxEnd.y);
            const topLeft = map.layerPointToLatLng(L.point(minx, miny), map.getZoom());

            const botRight = map.layerPointToLatLng(L.point(maxx, maxy), map.getZoom());
            const topLeftProjected = projectSingle(topLeft.lat, topLeft.lng, 1);
            const botRightProjected = projectSingle(botRight.lat, botRight.lng, 1);
            boxSelect(topLeftProjected[0], topLeftProjected[1], botRightProjected[0], botRightProjected[1]);
            boxStart = null;
            boxEnd = null;
        }
    }
    console.log(dragStartPos, ev.clientX, ev.clientY);
    if (dragStartPos[0] != ev.clientX || dragStartPos[1] != ev.clientY) {
        return;
    }
    var offset = $("#mapview-map").offset();
    var x = ev.clientX - offset.left;
    var y = ev.clientY - offset.top;
    var color = hexToRgb($("#marker-color").val(), 1);
    var invcolor = [255 - color[0], 255 - color[1], 255 - color[2]];
    var s = core.isOnMarker(x, $("#mapview-map").height() - y) >>> 0;
    var screencolor = [(s & 255), ((s >> 8) & 255), ((s >> 16) & 255)];

    var alpha = (s>>24) & 255;
    console.log(screencolor);

    var ll = map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom())

    var xy = projectSingle(ll.lat, ll.lng, 1);
    console.log("M", ll.lat, ll.lng, xy);

    if ((compareColors(screencolor, color) || compareColors(screencolor, invcolor))&&alpha) {
        var ll = map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom())

        var xy = projectSingle(ll.lat, ll.lng, 1);
        console.log("M", ll.lat, ll.lng, xy);
        var drop = core.closestMarker(xy[0], xy[1], Infinity);
        console.log(drop, xy);
        if (!ev.shiftKey) {
            selectedMarkers.clear();
        }
        if (selectedMarkers.has(drop)) {
            selectedMarkers.delete(drop);
        } else {
            selectedMarkers.add(drop);
        }
        makeMarkerBuffer();
        drawMarkers();
    } else if (selectedMarkers && !ev.shiftKey) {
        selectedMarkers.clear();
        makeMarkerBuffer();
        drawMarkers();
    }
})


// utils
function boxSelect(x1, y1, x2, y2) {
    console.log(x1, y1, x2, y2);
    const idBuffer = core.createUintBuffer(drops.length);
    const numDrops = core.boxSelect(x1, y1, x2, y2, idBuffer);
    const dropIds = Module.HEAPU32.slice(idBuffer / Uint32Array.BYTES_PER_ELEMENT, idBuffer / Uint32Array.BYTES_PER_ELEMENT + numDrops);
    console.log(dropIds);
    dropIds.forEach((d) => {
        selectedMarkers.add(d)
    });
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
            (drop) => !selectedMarkers.has(drop.id)
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
            selectedMarkers.values().toArray().map(
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
    core.loadMarkers(projectedMarkersBuffer, markerIdBuffer, markerPositions.length, 0.01);
    core.destroyBuffer(markerIdBuffer);
    core.destroyBuffer(projectedMarkersBuffer);
}

function projectMarkers(markerBuffer, l, scale) {
    const buf = core.createFloatBuffer(l);
    const transform = map.options.crs.transformation
    core.multiProject(markerBuffer, l, scale, transform._a, transform._b, transform._c, transform._d, buf)
    var m = Module.HEAPF32.slice(buf / Float32Array.BYTES_PER_ELEMENT, buf / Float32Array.BYTES_PER_ELEMENT + l);
    return [buf, m];
}

function projectSingle(lat, lon, scale) {
    const buf = core.createFloatBuffer(2);
    Module.HEAPF32.set([lat, lon], buf / Float32Array.BYTES_PER_ELEMENT);
    const projected = projectMarkers(buf, 2, scale);
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
    _drawMarkers(markerPosBuffer, markerPositions.length, selMarkerPosBuffer, selectedMarkers.size * 2, rgb);
}



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

function fboCap() {
    const buf = core.fboCap();
    const width = Math.floor($("#mapview-map").width());
    const height = Math.floor($("#mapview-map").height());
    const pixels = Module.HEAPU8.slice(buf, buf + width * height * 4);
    const flipped = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; ++row) {
        const src = row * width * 4;
        const dst = (height - row - 1) * width * 4;
        flipped.set(pixels.subarray(src, src + width * 4), dst);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    console.log(pixels, imageData.data);
    imageData.data.set(flipped);
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob(function(blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'fbo_output.png';
        a.click();
    });
}

function getSelectedMarkersJson() {
    var arr = selectedMarkers.values().map(val => dropsById[val]).toArray();
    var blob = new Blob([JSON.stringify(arr)]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'drops.json';
    a.click();

}

$("#export-selected").click(getSelectedMarkersJson);
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
$(".maps-search-input").keyup(function() {
    var v=$(this).val().toLowerCase();
    $("#drop-list").children(".dl-item").each(function(){
        if($(this).data("name").includes(v)){
            $(this).show();
        }
        else{
            $(this).hide();
        }
    }
    );
});
$("#dp-input").on("keyup change",function(){
    dropPage=$(this).val()-1;
    $("#drop-list").empty();
    for(drop of drops.slice(dropPage*pageSize, (dropPage+1)*pageSize)){
        $("#drop-list").append(dropEls[drop.id]);
    }
});
function loadDrops(d) {
    var numPages = Math.ceil(d.length/pageSize);
    $("#dp-total").text(numPages);
    $("#dp-input").attr("max", numPages);
    drops = d;
    bbox = getBbox(drops);
    if (bbox && drops.length) {
        map.fitBounds(bbox);
    }
    core.waitInitted().then(() => {
        makeMarkerBuffer();

        $("#loading").hide();
        for (var drop of drops) {
            dropsById[drop.id] = drop;
            const clone = dTemplate.content.cloneNode(true);
            $(clone).find(".drop-image").attr("src", "/static/images/flags/svg/" + drop.code + ".svg");
            $(clone).find(".drop-name").text(drop.id);
            $(clone).find(".drop").attr("data-id", drop.id);
            dropEls[drop.id]=$(clone).find(".dl-item").prop('outerHTML');
        }
        $("#dp-input").change();
        gridMarkers();
        drawMarkers();
        stretchOverlay();
    });


}

function loadDropGroups(g) {
    dropGroups = g;
    for (var dg of dropGroups) {
        const clone = dgTemplate.content.cloneNode(true);
        $(clone).find(".drop-group-image").attr("src", "/static/images/flags/svg/" + dg.code + ".svg");
        $(clone).find(".drop-group-name").text(dg.publicName);
        $(clone).find(".drop-count").text(dg.numberOfDrops);
        $(clone).find(".dl-item").data("id", dg.id);
        $(clone).find(".dl-item").data("name", dg.publicName.toLowerCase());
        $(clone).find(".drop-group").click(function() {
            location.href = "/view/group/" + mapId + "/" + $(this).parent().data("id")
        });
        $("#drop-list").append(clone);
    }
    $(".maps-search-input").keyup();
}

function loadSingleMap() {
    getMapDrops(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            showError("Error while loading map drops: " + response.message, function() {
                location.href = "/"
            });
        } else {
            loadDrops(response.response);
        }
    });
}

function loadGroupedMap() {
    $("#group-search").show();
    getPublicDropGroups(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            showError("Error while loading drop groups: " + response.message, function() {
                location.href = "/"
            });
        } else {
            loadDropGroups(response.response);
            $("#loading").hide();
        }
    });
}

function loadMap() {
    getPlayableMap(localStorage.token, mapId).then((response) => {
        console.log(response);
        if (response.status != "ok") {
            showError("Error while loading map data: " + response.message, function() {
                location.href = "/"
            });
        } else {
            mapData = response.response;
            $("#map-title").text(response.response.name);
            if (mapData.dropType == "single") {
                $("#drop-paginator").show();
                loadSingleMap();
            } else if (mapData.dropType == "group") {
                loadGroupedMap();
            }
        }
    });
}

function loadGroup() {
    $("#drop-paginator").show();
    groupId = Number(urlComponents[4]);
    getPublicDropGroups(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            showError("Error while loading group: " + response.message, function(){history.back()});
        } else {
            for (var dg of response.response) {
                if (dg.id == groupId)
                    groupData = dg
            }
            if (!groupData) {
                showError("No group id " + groupId + " in map id " + mapId, function(){history.back()});
            } else {
                $("#map-title").text(groupData.publicName);
                getGroupDrops(localStorage.token, groupId).then((response) => {
                    if (response.status != "ok") {
                        showError("Error while loading group drops: " + response.message, function(){history.back()});
                    } else {
                        loadDrops(response.response);
                    }
                });
            }
        }
    });

}

$(document).ready(function() {
    $("#drop-paginator").hide();
    dropPage=Number($("#dp-input").val())-1;
    if (dropPage==-1){
        dropPage=0;
        $("#dp-input").val(1);
    }
    $("#group-search").hide();
    if (!localStorage.token) {
        logOut();
    }
    if ($("#show-coverage").is(":checked")) {
        coverageLayer.addTo(map);
    }
    stretchOverlay();
    if (dgOrMap == "map") {
        loadMap();
    } else {
        loadGroup();
    }
});

