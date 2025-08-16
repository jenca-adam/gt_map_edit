/*
 * hi. welcome to the jankiest 1000 lines of code this earth has ever seen
 *
 */

// SETUP
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
var filteredDrops;
var remoteDrops;
var hoveredMarker = null;
var hoveredMarkerBuffer = 0;
var importing = {};
var isOwnMap;
var minUsedId = 0x7FFFFFF; // avoid signed/unsigned problems

const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    minZoom: 1,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

const gStreetsLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    minZoom: 1,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});
const gHybridLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    minZoom: 1,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});
const gSatelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    minZoom: 1,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});
const gTerrainLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    minZoom: 1,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
});
const coverageLayer = L.tileLayer('https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*212b1!3m18!2sen!3sUS!5e0!12m4!1e68!2m2!1sset!2sRoadmap!12m4!1e37!2m2!1ssmartmaps!2s!12m4!1e26!2m2!1sstyles!2ss.e:g|p.c:#f03e3e|p.w:10,s.e:g.s|p.v:off!4i0!5m2!1e0!5f2', {
    maxZoom: 18,
    minZoom: 1,
    attribution: '&copy; <a href="http://http.cat/418">Google</a>'
});
const unofficialLayer = L.tileLayer('https://maps.googleapis.com/maps/vt?pb=!1m4!1m3!1i{z}!2i{x}!3i{y}!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e3*212b1*213e2*211m3*211e10*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*212b1!3m16!2sen!3sUS!12m4!1e68!2m2!1sset!2sRoadmap!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1sstyles!2ss.e%3Ag.f|p.c%3A%23bd5f1b%2Cs.e%3Ag.s|p.c%3A%23f7ca9e!5m1!5f1', {
    maxZoom: 18,
    minZoom: 1,
});
const mapLayers = {
    "osm": osmLayer,
    "gm-street": gStreetsLayer,
    "gm-hybrid": gHybridLayer,
    "gm-satellite": gSatelliteLayer,
    "gm-terrain": gTerrainLayer
};
var currentMapLayer;

function makeBatched(arr, chunkSize) {
    var chunks = []
    while (arr.length) {
        chunks.push(arr.slice(0, chunkSize));
        arr = arr.slice(chunkSize);
    }
    return chunks;
}
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
    if (ev.shiftKey && ev.button === 0 && ($("#map-mode-view").is(":checked") || $("#map-mode-edit").is(":checked"))) { // Left-click + Ctrl
        isDraggingBox = true;
        var offset = $("#mapview-map").offset();

        boxStart = map.mouseEventToLayerPoint(ev);
        L.DomUtil.disableTextSelection();
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
    var alpha = (s >> 24) & 255;

    if ((compareColors(screencolor, color) || compareColors(screencolor, invcolor)) && alpha) {
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
    if (dragStartPos[0] != ev.clientX || dragStartPos[1] != ev.clientY) {
        return;
    }

    if (dgOrMap == "map" && mapData.dropType == "group") {
        var layerPoint = map.mouseEventToLayerPoint(ev);
        var latlng = map.layerPointToLatLng(layerPoint);
        if (latlng.lng > 180 || latlng.lng < -180) {
            return;
        }
        $("#new-drop-group-lat").val(latlng.lat);
        $("#new-drop-group-lng").val(latlng.lng);
        $("#new-drop-group-lat").change();
        $("#new-drop-group").show();
        return;
    }
    if ($("#map-mode-create").is(":checked") && drops) {
        var layerPoint = map.mouseEventToLayerPoint(ev);
        var latlng = map.layerPointToLatLng(layerPoint);
        requestPanorama(latlng.lat, latlng.lng, 1000, false).then(
            (drop) => {
                if (drop) {
                    drop.id = --minUsedId; // big ids to avoid collision with existing drops, ids get ignored(?) when importing with merge 
                    drops.push(drop);
                    bbox = getBbox(drops);
                    dropsById[drop.id] = drop;
                    dropEls[drop.id] = createDropElement(drop);
                    selectedMarkers.add(drop.id);
                    loadMarkers([drop]);
                    makeMarkerBuffers();
                    drawMarkers();
                    $("#drop-filter-select").change();
                }

            }
        );
    } else {
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
        var offset = $("#mapview-map").offset();
        var x = ev.clientX - offset.left;
        var y = ev.clientY - offset.top;
        var color = hexToRgb($("#marker-color").val(), 1);
        var invcolor = [255 - color[0], 255 - color[1], 255 - color[2]];
        var s = core.isOnMarker(x, $("#mapview-map").height() - y) >>> 0;
        var screencolor = [(s & 255), ((s >> 8) & 255), ((s >> 16) & 255)];

        var alpha = (s >> 24) & 255;

        var ll = map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom())

        var xy = projectSingle(ll.lat, ll.lng, 1);

        if ((compareColors(screencolor, color) || compareColors(screencolor, invcolor)) && alpha) {
            var ll = map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom())

            var xy = projectSingle(ll.lat, ll.lng, 1);
            var drop = core.closestMarker(xy[0], xy[1], Infinity);
            if (!ev.shiftKey) {
                selectedMarkers.clear();
            }
            if (selectedMarkers.has(drop)) {
                selectedMarkers.delete(drop);
            } else {
                selectedMarkers.add(drop);
            }
            makeMarkerBuffers();
            drawMarkers();
            $("#drop-filter-select").change();
        } else if (selectedMarkers && !ev.shiftKey) {
            selectedMarkers.clear();
            $("#drop-filter-select").change();
            makeMarkerBuffers();
            drawMarkers();
        }
    }
})


// utils
function boxSelect(x1, y1, x2, y2) {
    const idBuffer = core.createUintBuffer(drops.length);
    const numDrops = core.boxSelect(x1, y1, x2, y2, idBuffer);
    const dropIds = Module.HEAPU32.slice(idBuffer / Uint32Array.BYTES_PER_ELEMENT, idBuffer / Uint32Array.BYTES_PER_ELEMENT + numDrops);
    dropIds.forEach((d) => {
        selectedMarkers.add(d)
    });

    $("#drop-filter-select").change();
    if (numDrops > 0) {

        makeMarkerBuffers();
        drawMarkers();
    }
    core.destroyBuffer(idBuffer);
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
    return bbox;
}


function makeMarkerBuffers() {
    // creates a buffer of marker positions
    // called every time markers update and when they load for the first time
    markerPositions = new Float32Array(
        drops.filter(
            (drop) => !(selectedMarkers.has(drop.id) || drop.id == hoveredMarker)
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
            selectedMarkers.values().toArray().filter((id) => (id != hoveredMarker)).map(
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
    if (hoveredMarker) {
        if (hoveredMarkerBuffer) {
            core.destroyBuffer(hoveredMarkerBuffer);
        }
        hoveredMarkerBuffer = core.createFloatBuffer(2);
        Module.HEAPF32.set(new Float32Array([dropsById[hoveredMarker].lat, dropsById[hoveredMarker].lng]), hoveredMarkerBuffer / Float32Array.BYTES_PER_ELEMENT)
    }
    var projectResult = projectMarkers(markerPosBuffer, markerPositions.length, 1.0);
    projectedMarkersBuffer = projectResult[0];
    projectedMarkers = projectResult[1];
}

function loadMarkers(updated = drops) {
    var markerIds = new Uint32Array(updated.map((drop) => drop.id));
    var markerIdBuffer = core.createUintBuffer(updated.length);
    var updatedPositions = new Float32Array(updated.map((drop) => [drop.lat, drop.lng]).flat());
    var updatedBuffer = core.createFloatBuffer(updatedPositions.length);
    Module.HEAPF32.set(updatedPositions, updatedBuffer / Float32Array.BYTES_PER_ELEMENT);
    var projectResult = projectMarkers(updatedBuffer, updatedPositions.length, 1.0);
    var projectedUpdatedBuffer = projectResult[0];
    Module.HEAPU32.set(markerIds, markerIdBuffer / Uint32Array.BYTES_PER_ELEMENT);
    core.loadMarkers(projectedUpdatedBuffer, markerIdBuffer, updatedPositions.length, 0.01);
    core.destroyBuffer(markerIdBuffer);
    core.destroyBuffer(projectedUpdatedBuffer);
    core.destroyBuffer(updatedBuffer);
}

function unloadMarkers(markers) {
    //dry can go f itself
    var markerIds = new Uint32Array(markers.map((drop) => drop.id));
    var markerIdBuffer = core.createUintBuffer(markers.length);
    var positions = new Float32Array(markers.map((drop) => [drop.lat, drop.lng]).flat());
    var markersBuffer = core.createFloatBuffer(positions.length);
    Module.HEAPF32.set(positions, markersBuffer / Float32Array.BYTES_PER_ELEMENT);
    var projectResult = projectMarkers(markersBuffer, positions.length, 1.0);
    var projectedUpdatedBuffer = projectResult[0];
    Module.HEAPU32.set(markerIds, markerIdBuffer / Uint32Array.BYTES_PER_ELEMENT);
    core.unloadMarkers(projectedUpdatedBuffer, markerIdBuffer, positions.length);
    core.destroyBuffer(markerIdBuffer);
    core.destroyBuffer(projectedUpdatedBuffer);
    core.destroyBuffer(markersBuffer);
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

function _drawMarkers(buf1, l1, buf2, l2, buf3, l3, rgb) {
    var transform = map.options.crs.transformation;
    var origin = map.getPixelOrigin();
    var zoom = map.getZoom();
    var panpos = map._getMapPanePos();
    var markerSize = $("#marker-size").val();
    core.drawMarkers(buf1, l1, buf2, l2, buf3, l3, transform._a, transform._b, transform._c, transform._d, origin.x - panpos.x, origin.y - panpos.y, zoom, markerSize, rgb[0], rgb[1], rgb[2], 1 - rgb[0], 1 - rgb[1], 1 - rgb[2], markerSize * 1.5, 0, 1, 0);
}

function drawMarkers() {
    if (!markerPositions) return;
    core.clearScreen(0, 0, 0, 0);
    /*var markerPositions = new Float32Array(drops.map((drop) => {
        var pt = map.latLngToContainerPoint(L.latLng(drop.lat, drop.lng));
        return [(pt.x - overlay.offsetWidth / 2) / overlay.offsetWidth * 2, -(pt.y - overlay.offsetHeight / 2) / overlay.offsetHeight * 2]
    }).filter((loc) => loc[0] < 1 && loc[0] > -1 && loc[1] < 1 && loc[1] > -1).flat());*/
    var rgb = hexToRgb($("#marker-color").val());
    _drawMarkers(markerPosBuffer, markerPositions.length, selMarkerPosBuffer, selectedMarkers.size * 2, hoveredMarkerBuffer, (!!hoveredMarker) * 2, rgb);
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

function mapSettingsChanged() {
    window.localStorage['mapSettings'] = JSON.stringify({
        "showCoverage": $("#show-coverage").is(":checked"),
        "coverageOpacity": $("#coverage-opacity").val(),
        "markerColor": $("#marker-color").val(),
        "markerSize": $("#marker-size").val(),
        "mapLayer": $("#map-layer").val()
    });
    mapChanged();
}

function loadMapSettings() {
    var ms = window.localStorage['mapSettings'];
    if (!ms) {
        return;
    }
    var mapSettings = JSON.parse(ms);
    $("#show-coverage").prop("checked", mapSettings.showCoverage);
    $("#show-coverage").change();
    $("#coverage-opacity").val(mapSettings.coverageOpacity);
    $("#coverage-opacity").trigger("input");
    $("#marker-color").val(mapSettings.markerColor);

    $("#map-layer").val(mapSettings.mapLayer);
    $("#marker-size").val(mapSettings.markerSize);
}

function resetMapSettings() {
    $("#show-coverage").prop("checked", $("#show-coverage").attr("checked"));
    $("#show-coverage").change();
    $("#coverage-opacity").val($("#coverage-opacity").attr("value"));
    $("#coverage-opacity").trigger("input");
    $("#marker-color").val($("#marker-color").attr("value"));
    $("#marker-size").val($("#marker-size").attr("value"));
    $("#map-layer").val($("#map-layer").attr("value"));
    mapSettingsChanged();
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

function getMapUpdateData() {
    var remoteDropsSet = new Set(remoteDrops);
    var dropsSet = new Set(drops);
    var removed = remoteDropsSet.difference(dropsSet).values().map(drop => drop.id).toArray();
    var added = dropsSet.difference(remoteDropsSet).values().toArray();
    return {
        add: added,
        remove: removed
    };
}

async function importDropsBatched(drops, method) {
    var targetId = dgOrMap == "map" ? mapId : groupId;
    const dropsBatched = makeBatched(drops, 200);
    const futuresBatched = dropsBatched.map((batch) => importDrops(localStorage.token, batch, targetId, dgOrMap, method));
    return await Promise.all(futuresBatched);
}

async function deleteDropsBatched(drops) {
    var targetId = dgOrMap == "map" ? mapId : groupId;
    const dropsBatched = makeBatched(drops, 100);
    const futuresBatched = dropsBatched.map((batch) => deleteDrops(localStorage.token, batch));
    return await Promise.all(futuresBatched);
}

function saveMap() {
    const mapUpdateData = getMapUpdateData();
    if (!mapUpdateData.remove.length && !mapUpdateData.add.length) return;
    $("#loading").show();
    $("#loading-flavor").text("Saving");
    var removeFinished = 1;
    if (mapUpdateData.remove.length) {
        removeFinished = 0
        deleteDropsBatched(mapUpdateData.remove).then((response) => {
            for (const batchResponse of response) {
                if (batchResponse.status != "ok") {
                    showError(batchResponse.message, () => {
                        location.reload()
                    });
                    removeFinished = 2;
                    break;
                }
            }
            if (!removeFinished) {
                removeFinished = 1;
                if (!mapUpdateData.add.length) {
                    location.reload();
                }
            }
        });

    }
    if (mapUpdateData.add.length) {
        importDropsBatched(mapUpdateData.add, "merge").then((response) => {
            let quitEarly = false;

            for (const batchResponse of response) {

                if (batchResponse.status != "ok") {
                    showError(batchResponse.message, () => {
                        location.reload()
                    });
                    quitEarly = true;
                    break;
                }
            }
            if (!quitEarly) {
                (async () => {
                    while (!removeFinished) {
                        await new Promise(r => setTimeout(r, 10));
                    }
                    return true;
                })().then(() => {
                    if (removeFinished == 1) {
                        location.reload();
                    }
                });
            }
        });
    }
}

function validateDrops(json) {
    var dropsToImport;
    try {
        dropsToImport = JSON.parse(json);
    } catch {
        showError("invalid json", () => {});
        return;
    }
    console.log(dropsToImport);
    if (!Array.isArray(dropsToImport)) {
        if (dropsToImport.customCoordinates) {
            dropsToImport = dropsToImport.customCoordinates.map((drop) => ({
                style: "streetview",
                lat: drop.lat,
                lng: drop.lng,
                panoId: drop.panoId || drop.extra.panoId,
                heading: drop.heading,
                pitch: drop.pitch,
                zoom: drop.zoom,
                code: drop.countryCode,
                subCode: drop.stateCode
            }));
        } else {
            showError("bad format: only geotastic and map-making.app formats supported", () => {});
            return;
        }
    }
    if (!dropsToImport.every((drop) => "lat" in drop && "lng" in drop)) {
        showError("bad format: need lat and lng attributes in every drop", () => {});
        return;
    }
    return dropsToImport;

}

function importDropsJson(json) {
    const dropsToImport = validateDrops(json);
    if (!dropsToImport) {
        return
    }
    var dropIndex = 0;
    const dropsToFix = dropsToImport.filter(drop => !(drop.code));
    let processed = dropsToFix.map(drop => ({
        dropIndex: dropIndex++,
        fileIndex: 0,
        lat: drop.lat,
        lng: drop.lng,
        skipPanoCheck: !!drop.panoId
    }));

    const batched = makeBatched(processed, 150);
    const batchedFutures = batched.map((batch) =>
        getDropInfoForBaseDropImport(localStorage.token, batch)
    );
    if (batched) {
        $("#import-form").hide();
        $("#importer-loading").show();
    } else {
        $("#importer-import").prop('disabled', false);
        importing = dropsToImport;
    }
    Promise.all(batchedFutures).then((results) => {
        console.log(results);
        for (const batchResults of results) {
            if (batchResults.status == "ok") {
                for (const result of batchResults.response) {
                    if (result.geocodingResult.status == "ok") {
                        dropsToFix[result.dropIndex].code = result.geocodingResult.iso2;
                        dropsToFix[result.dropIndex].subCode = result.geocodingResult.childIso2;
                    }
                    if (result.panoramaResult.status == "ok") {
                        dropsToFix[result.dropIndex].panoId = result.panoId;
                    }
                }
            }
        }
        $("#import-form").show();
        $("#importer-loading").hide();
        $("#importer-import").prop('disabled', false);
        importing = dropsToImport;
    });
}

// UI
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
$("#delete-selected").click(function() {
    var selectedDrops = selectedMarkers.values().toArray().map((id) => dropsById[id]);
    unloadMarkers(selectedDrops);
    drops = drops.filter((drop) => (!selectedMarkers.has(drop.id)));
    bbox = getBbox(drops);
    selectedMarkers.clear();
    makeMarkerBuffers();
    drawMarkers();
    $("#drop-filter-select").change();
});
$("#reset-map").click(function() {
    if (bbox) {
        map.fitBounds(bbox);
    }
    if (drops) {
        drawMarkers();
    }
});
$("#select-all").click(function() {
    selectedMarkers = new Set(drops.map((d) => d.id));
    makeMarkerBuffers();
    drawMarkers();
    $("#drop-filter-select").change();
});
$("#marker-color").change(mapSettingsChanged);
$("#marker-size").on('input', mapSettingsChanged);
$("#map-layer").change(function() {
    if (currentMapLayer) {
        currentMapLayer.removeFrom(map);
    }
    currentMapLayer = mapLayers[$(this).val()];
    currentMapLayer.addTo(map);
    coverageLayer.bringToFront();
    mapSettingsChanged();
});
$("#save-map").click(saveMap);
$("#map-settings-button").click(function() {
    $("#map-settings").show();
});
$("#map-settings-hide").click(function() {
    $("#map-settings").hide();
});
$("#map-settings-reset").click(function() {
    resetMapSettings();
});
$("#show-coverage").change(function() {
    if ($(this).is(":checked")) {
        coverageLayer.addTo(map);
    } else {
        coverageLayer.removeFrom(map);
    }
    mapSettingsChanged();
});
$("#coverage-opacity").on('input', function() {
    coverageLayer.setOpacity($(this).val());
    mapSettingsChanged();
});
$(".maps-search-input").keyup(function() {
    var v = $(this).val().toLowerCase();
    $("#drop-list").children(".dl-item").each(function() {
        if ($(this).data("name").includes(v)) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
});
$("#dp-input").on("keyup change", function() {
    dropPage = $(this).val() - 1;
    $("#drop-list").empty();
    for (drop of filteredDrops.slice(dropPage * pageSize, (dropPage + 1) * pageSize)) {
        $("#drop-list").append(dropEls[drop.id]);
    }
});
$("#drop-filter-select").on("change", function() {
    if ($(this).val() == "Selected") {
        filteredDrops = drops.filter((d) => selectedMarkers.has(d.id));
    } else {
        filteredDrops = drops;
    }
    numPages = Math.max(1, Math.ceil(filteredDrops.length / pageSize));
    $("#dp-total").text(numPages);
    $("#dp-input").attr("max", numPages);
    $("#dp-input").val(Math.max(1, Math.min($("#dp-input").val(), numPages)));
    $("#dp-input").change();
});
$("#dp-minus").click(function() {
    var val = Number($("#dp-input").val());
    if (val > 1) {
        $("#dp-input").val(val - 1);
        $("#dp-input").change();
    }
});
$("#dp-plus").click(function() {
    var val = Number($("#dp-input").val());
    if (val < numPages) {
        $("#dp-input").val(val + 1);
        $("#dp-input").change();
    }
});
$("#back-to-map").click(function() {
    location.href = `/view/map/${mapId}`;
});
$("#map-modes").on("change", function() {
    if ($("#map-mode-edit").is(":checked")) {
        $(".edit-mode").show()
    } else {
        $(".edit-mode").hide()
    }

});
$("#import").click(function() {
    $("#importer").show();
});
$("#importer-hide").click(function() {
    $("#importer").hide();
});
$("#import-file").change(function() {
    $(this).prop("files")[0].text().then((text) => importDropsJson(text));
});
$("#import-form").submit(function(ev) {
    ev.preventDefault();
    return false;
});
$("#importer-import").click(function() {
    $(this).prop("disabled", true);
    $("#importer").hide();
    $("#import-file").val(null);
    if (importing) {
        for (var drop of importing) {
            drop.id = --minUsedId;
            drops.push(drop);
            dropsById[drop.id] = drop;
            dropEls[drop.id] = createDropElement(drop);
            selectedMarkers.add(drop.id);
        }
        loadMarkers(importing);
        makeMarkerBuffers();
        drawMarkers();
        $("#drop-filter-select").change();
    }
});
$("#edit-help-open").click(function() {
    $("#edit-help").show();
});
$("#edit-help-hide").click(function() {
    $("#edit-help").hide();
});
$("#new-drop-group-hide").click(function() {
    $("#new-drop-group").hide();
});
$("#new-drop-group-submit").click(function() {
    $("#new-drop-group").hide();
    createDropGroup(localStorage.token, mapId, $("#new-drop-group-lat").val(), $("#new-drop-group-lng").val(), $("#new-drop-group-code").val(), $("#new-drop-group-name").val(), true, $("#new-drop-group-bias").val()).then(response => {
        if (response.status == "ok") {
            location.reload(); // lazy as fuck
        } else {
            showError(response.message, () => {
                location.reload()
            });
        }
    });

});
$("#new-drop-group-lat, #new-drop-group-lng").change(function() {
    const lat = $("#new-drop-group-lat").val();

    const lng = $("#new-drop-group-lng").val();
    reverseBatch([{
        "lat": lat,
        "lng": lng
    }]).then(response => {
        if (response.status != "ok" || response.response[0].status == "unknown") {
            $("#new-drop-group-country").attr("src", "/static/images/flags/svg/invalid.svg")
            $("#new-drop-group-code").val(null);
        } else {
            $("#new-drop-group-code").val(response.response[0].iso2);
            $("#new-drop-group-country").attr("src", `/static/images/flags/svg/${response.response[0].iso2}.svg`);
        }
    });
});

// LOADING
function createDropElement(drop) {
    const clone = dTemplate.content.cloneNode(true);
    $(clone).find(".drop-image").attr("src", "/static/images/flags/svg/" + drop.code + ".svg");
    $(clone).find(".drop-name").text(drop.id);
    if (drop.title) {
        $(clone).find(".drop-desc").text(`(${drop.title})`);
    }
    $(clone).find(".drop").attr("data-id", drop.id);
    return $(clone).find(".dl-item").prop('outerHTML');

}

function loadDrops(d) {
    numPages = Math.max(1, Math.ceil(d.length / pageSize));
    $("#dp-total").text(numPages);
    $("#dp-input").attr("max", numPages);
    drops = d;
    remoteDrops = d.slice();
    bbox = getBbox(drops);
    if (bbox && drops.length) {
        map.fitBounds(bbox);
    }

    $("#loading-flavor").text("Initializing");
    core.waitInitted().then(() => {
        makeMarkerBuffers();

        $("#loading-flavor").text("Loading drops");
        for (var drop of drops) {
            dropsById[drop.id] = drop;
            dropEls[drop.id] = createDropElement(drop);
        }
        $("#drop-filter-select").change();
        loadMarkers();
        stretchOverlay();

        $("#loading-flavor").text("Drawing drops");
        drawMarkers();
        $("#loading").hide()
    });


}

function loadDropGroups(g) {
    dropGroups = g;

    $("#loading-flavor").text("Loading drop groups");
    for (var dg of dropGroups) {
        const clone = dgTemplate.content.cloneNode(true);
        $(clone).find(".drop-group-image").attr("src", "/static/images/flags/svg/" + dg.code + ".svg");
        $(clone).find(".drop-group-name").text(dg.publicName||dg.title);
        $(clone).find(".drop-count").text(dg.numberOfDrops);
        $(clone).find(".dl-item").data("id", dg.id);
        $(clone).find(".dl-item").data("name", (dg.publicName||dg.title).toLowerCase());
        $(clone).find(".dl-item").click(function() {
            location.href = "/view/group/" + mapId + "/" + $(this).data("id")
        });
        $("#drop-list").append(clone);
    }
    $(".maps-search-input").keyup();
}

function loadSingleMap() {

    $("#loading-flavor").text("Fetching drops");
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
    $("#save-map").hide();
    $("#delete-selected").hide();
    $("#map-modes").hide();
    $("#import").hide();
    $("#loading-flavor").text("Fetching drop groups");
    $("#group-search").show();
    
    (isOwnMap?getDropGroups:getPublicDropGroups)(localStorage.token, mapId).then((response) => {
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

    $("#loading-flavor").text("Fetching map info");
    getPlayableMap(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            showError("Error while loading map data: " + response.message, function() {
                location.href = "/"
            });
        } else {
            mapData = response.response;
            $("#map-title").text(response.response.name);
            if (mapData.dropType == "single") {
                $(".drops-only").show();
                loadSingleMap();
            } else if (mapData.dropType == "group") {
                loadGroupedMap();
            }
        }
    });
}
function loadGroupFromGroupData(){
    if (!groupData) {
                showError("No group id " + groupId + " in map id " + mapId, function() {
                    history.back()
                });
            } else {
                $("#map-title").text(groupData.publicName||groupData.title);
                $("#loading-flavor").text("Fetching drops");
                getGroupDrops(localStorage.token, groupId).then((response) => {
                    if (response.status != "ok") {
                        showError("Error while loading group drops: " + response.message, function() {
                            history.back()
                        });
                    } else {
                        loadDrops(response.response);
                    }
                });
            }

}
function loadGroup() {
    $(".drops-only").show();
    $("#loading-flavor").text("Fetching group info");
    groupId = Number(urlComponents[4]);
    getPlayableMap(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            showError("Error while loading map data: " + response.message, function() {
                location.href = "/"
            });
        } else {
            mapData = response.response;
        }
    });
    if(isOwnMap){
        getDropGroup(localStorage.token, groupId).then((response)=>{
            if (response.status != "ok"){
                showError("Error while loading group: " + response.message, function (){
                    history.back()
                });
            } else{
                groupData = response.response;
                loadGroupFromGroupData();
            }
        });
    }
    else{
    getPublicDropGroups(localStorage.token, mapId).then((response) => {
        if (response.status != "ok") {
            showError("Error while loading group: " + response.message, function() {
                history.back()
            });
        } else {
            for (var dg of response.response) {
                if (dg.id == groupId)
                    groupData = dg
            }
            loadGroupFromGroupData();
        }
    });
    }


}

$(document).on("click", ".dl-item:has(.drop)",
    function(ev) {
        const id = $(this).find(".drop").data("id");
        const drop = dropsById[id];
        const url = `https://www.google.com/maps/@?api=1&map_action=pano&pano=${drop.panoId}&heading=${drop.heading}&pitch=${drop.pitch}&fov=90`;
        window.open(url);

    }
);
$(document).on("auxclick", ".dl-item:has(.drop)",
    function(ev) {
        if (ev.button != 1) return;
        clearTimeout(this.timeout);
        const id = $(this).find(".drop").data("id");
        const drop = dropsById[id];

        map.setView([drop.lat, drop.lng], Math.max(map.getZoom(), 12));
    });
$(document).on("mouseenter", ".dl-item:has(.drop)", function(ev) {
    hoveredMarker = $(this).find(".drop").data("id");
    makeMarkerBuffers();
    drawMarkers();
});
$(document).on("mouseleave", ".dl-item:has(.drop)", function(ev) {
    hoveredMarker = null;
    makeMarkerBuffers();
    drawMarkers();
});
$(document).ready(function() {
    $("#import-file").val(null);
    $("#map-settings, #importer, #importer-loading, #edit-help, #new-drop-group, .drops-only").hide();
    if (!$("#map-mode-edit").is(":checked"))
        $(".edit-mode").hide();
    isOwnMap = JSON.parse(localStorage.ownMaps).includes(mapId); 
    loadMapSettings();
    dropPage = Number($("#dp-input").val()) - 1;

    if (dropPage == -1) {
        dropPage = 0;
        $("#dp-input").val(1);
    }
    $("#group-search").hide();
    if (!localStorage.token) {
        logOut();
    }
    if ($("#show-coverage").is(":checked")) {
        coverageLayer.addTo(map);
    }
    $("#map-layer").change();
    stretchOverlay();
    if (dgOrMap == "map") {
        loadMap();
    } else {
        loadGroup();
    }
});
