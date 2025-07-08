const map = L.map('mapview-map').setView([0, 0], 1);
const mapId = Number(new URL(document.location).pathname.split("/").at(-1));
const overlay = $("#overlay")[0];
var drops;
var bbox;
var markerPositions;
var markerPosBuffer;
var dropsById = {};
var activeId=0;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
const coverageLayer=L.tileLayer('https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*212b1!3m18!2sen!3sUS!5e0!12m4!1e68!2m2!1sset!2sRoadmap!12m4!1e37!2m2!1ssmartmaps!2s!12m4!1e26!2m2!1sstyles!2ss.e:g|p.c:#f03e3e|p.w:10,s.e:g.s|p.v:off!4i0!5m2!1e0!5f2', {
    maxZoom: 19,
    attribution: '&copy; Google'
});
$("#mapview-map").click(function(ev) {
    var offset = $("#mapview-map").offset();
    var x = ev.clientX-offset.left;
    var y = ev.clientY-offset.top;
    var color = hexToRgb($("#marker-color").val(), 1);
    if(core.isOnMarker(x,$("#mapview-map").height()-y, color[0], color[1], color[2])){
    
        var latLon = map.containerPointToLatLng(L.point(ev.clientX - offset.left, ev.clientY - offset.top), map.getZoom());
        var drop = core.closestMarker(latLon.lat, latLon.lng, Infinity);
        console.log(drop, latLon);
        if(drop)    console.log(dropsById[drop]);
        activeId=drop;
        highlightActiveMarker();
    }
})
function hexToRgb(hex, div=255.0) {
    var bigint = parseInt(hex.substr(1), 16);
    var r = ((bigint >> 16) & 255)/div;
    var g = ((bigint >> 8) & 255)/div;
    var b = (bigint & 255)/div;
    return [r,g,b]
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
    markerPositions = new Float32Array(drops.map((drop)=>[drop.lat, drop.lng]).flat());
    if(markerPosBuffer){
        core.destroyBuffer(markerPosBuffer);
    }
    markerPosBuffer= core.createFloatBuffer(markerPositions.length);
    Module.HEAPF32.set(markerPositions, markerPosBuffer / Float32Array.BYTES_PER_ELEMENT);
}
function gridMarkers(){
    var markerIds = new Uint32Array(drops.map((drop)=>drop.id));
    var markerIdBuffer = core.createUintBuffer(markerPositions.length);
    Module.HEAPU32.set(markerIds, markerIdBuffer / Uint32Array.BYTES_PER_ELEMENT);
    core.loadMarkers(markerPosBuffer, markerIdBuffer, markerPositions.length, 1.0);
    core.destroyBuffer(markerIdBuffer);
}
 
function _drawMarkers(buffer, l, rgb){
    var transform = map.options.crs.transformation;
    var origin = map.getPixelOrigin();
    var zoom = map.getZoom();
    var panpos = map._getMapPanePos();

    core.drawMarkers(buffer, l, transform._a, transform._b, transform._c, transform._d, origin.x-panpos.x, origin.y-panpos.y, zoom, 10.0, rgb[0], rgb[1], rgb[2]);
}
function drawMarkers() {
    if(!markerPositions) return;
    console.log(map.options.crs.transformation);
    core.clearScreen(0, 0, 0, 0);
    /*var markerPositions = new Float32Array(drops.map((drop) => {
        var pt = map.latLngToContainerPoint(L.latLng(drop.lat, drop.lng));
        return [(pt.x - overlay.offsetWidth / 2) / overlay.offsetWidth * 2, -(pt.y - overlay.offsetHeight / 2) / overlay.offsetHeight * 2]
    }).filter((loc) => loc[0] < 1 && loc[0] > -1 && loc[1] < 1 && loc[1] > -1).flat());*/
    var rgb = hexToRgb($("#marker-color").val());
    _drawMarkers(markerPosBuffer, markerPositions.length, rgb);
}
function highlightActiveMarker(){
    if(activeId){
        var drop=dropsById[activeId];

        var rgb = hexToRgb($("#marker-color").val());
        var singleMarkerPosition = new Float32Array([drop.lat, drop.lng]);
        var singlePositionBuffer = core.createFloatBuffer(2);
        Module.HEAPF32.set(singleMarkerPosition, singlePositionBuffer/Float32Array.BYTES_PER_ELEMENT);
        _drawMarkers(singlePositionBuffer, 2, [0,1,0]);

    }
        
};
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
map.on("resize", function(){
    if(drops)
    {    
        stretchOverlay();
        core.stretch();
        drawMarkers()
    }
});
$("#reset-map").click(function (){
    if(bbox){
        map.fitBounds(bbox);
    }
    if(drops){
        drawMarkers();
    }
});
$("#marker-color").change(mapChanged);//it didnt!
$("#show-coverage").change(function(){
    if($(this).is(":checked")){
        coverageLayer.addTo(map);
    }
    else{
        coverageLayer.removeFrom(map);
    }
});
$(document).ready(function() {
    if (!localStorage.token) {
        logOut();
    }
    if ($("#show-coverage").is(":checked")){
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
            if(bbox){
                map.fitBounds(bbox);
            }
            makeMarkerBuffer();
            for(var drop of drops){
                dropsById[drop.id]=drop;
            }
            gridMarkers();
            drawMarkers();
        }
    });
});
//pmtiles.leafletRasterLayer(layer,{attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>'}).addTo(map)
