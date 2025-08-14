const mapTemplate = document.querySelector("#map-template");
const ownMapList = $(".own>.map-list");
const otherMapList = $(".other>.map-list");
const mapThreshold = 250;
var otherLoaded = false;
var otherMaps;
var mapElements = {};

const showOwnMaps = () => {
    $(".tab.own .loading").show();
    getOwnMaps(localStorage.token).then((response) => {
        if (response.status != "ok") {
            console.error(response.message);
        } else {
            ownMapList.hide();
            for (map of response.response) {
                const clone = mapTemplate.content.cloneNode(true);
                $(clone).find(".map-title").text(map.name);
                $(clone).find(".map-owner-outer").hide();
                $(clone).find(".map-count-count").text(map.contentLength);
                $(clone).find(".map-count-what").text(map.dropType == "single" ? "drops" : "groups");
                if (map.thumbnail) {
                    $(clone).find(".map-image").attr("src", "https://static.geo.edutastic.de/map_images/" + map.thumbnail);
                }
                $(clone).find(".map").data("name", map.name.toLowerCase());
                $(clone).find(".map-num-plays").text(map.timesPlayed);
                $(clone).find(".map-select").data("id", map.id);
                $(clone).find(".map-select").text("Edit");
                $(clone).find(".map-select").click(function() {
                    location.href = ("/view/map/" + $(this).data("id"))
                });
                $(".tab.own .maps-search-input").keyup();
                ownMapList.append($(clone));
            }
            $(".tab.own .loading").hide();
            ownMapList.show();

        }

    });
}
$(".maps-search-input").keyup(function() {
    if (!otherMaps) return;
    var value = $(this).val().toLowerCase();
    console.log(value);
    otherMapList.empty();
    var count = 0;

    for (map of otherMaps) {
        if (count >= mapThreshold) break;

        if (map.name.toLowerCase().includes(value)) {
            console.log(map);
            otherMapList.append(mapElements[map.id]);
            count += 1
        }

    }
});
const showOtherMaps = () => {
    $(".tab.other .loading").show();
    $(".tab.other .maps-search").hide();
    otherLoaded = true;
    getPlayableMaps(localStorage.token).then((response) => {
        if (response.status != "ok") {
            otherLoaded = false;
            console.error(response.message);
        } else {
            otherMapList.hide();
            otherMaps = response.response;
            var count = 0;
            for (map of response.response) {
                const clone = mapTemplate.content.cloneNode(true);
                $(clone).find(".map-title").text(map.name);
                $(clone).find(".map-count-count").text(map.contentLength);
                $(clone).find(".map-count-what").text(map.dropType == "single" ? "drops" : "groups");
                $(clone).find(".map-owner").text(map.ownerData ? map.ownerData.nickname : "???");
                if (map.thumbnail) {
                    $(clone).find(".map-image").attr("src", "https://static.geo.edutastic.de/map_images/" + map.thumbnail);
                }
                $(clone).find(".map-num-plays").text(map.timesPlayed);
                $(clone).find(".map-select").attr("data-id", map.id);
                $(clone).find(".map").data("name", map.name.toLowerCase())
                $(clone).find(".map-select").text("View");
                mapElements[map.id] = $('<div>').append(clone).html();
                count += 1;

            }
            $(".tab.other .loading").hide();
            $(".tab.other .maps-search").show(100);
            $(".tab.other .maps-search-input").keyup();
            otherMapList.show();

        }

    });
}

$("#site").hide();
$(document).ready(() => {
    if (!localStorage.token) {
        logOut();
    } else {
        getUserInfoViaToken(localStorage.token).then((response) => {
            if (response.status != "ok") {
                logOut();
            }
            localStorage.userData = JSON.stringify(response.response);
            $("#loading").hide();
            $(".tabs").tabs();
            $(".tab-button:not(.active)").click(function() {

                if (!otherLoaded) {
                    showOtherMaps();
                };
            });
            showOwnMaps();
            $("#site").show();
        });
    }
});
$(document).on("click", ".map-select", function() {
    location.href = ("/view/map/" + $(this).data("id"))
});
