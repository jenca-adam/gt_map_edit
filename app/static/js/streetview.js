const buildRequestUrl = ((lat, lng, radius, thirdParty) => {
    const imageType = thirdParty ? 10 : 2;
    return `https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d${lat}!4d${lng}!2d${radius}!3m10!2m2!1sen_US!2sen_US!9m1!1e2!11m4!1m3!1e${imageType}!2b1!3e2!4m5!1e4!1e8!1e12!5m0!6m0&callback=callback`
});

const requestPanorama = (async (lat, lng, radius, thirdParty) => {
    const url = buildRequestUrl(lat, lng, radius, thirdParty);
    const response = await gmRequest(url);
    const responseText = await response.text();
    console.log(responseText);
    const parsed = JSON.parse(responseText.substr(0, responseText.length - 1).split("(")[1]);
    const panoOk = parsed[0][0] == 0;
    const panoMsg = panoOk ? "" : parsed[0][1];
    const panoInfo = parsed[1];
    let dropData = {};
    if (panoOk) {
        dropData.panoId = panoInfo[1][1];
        dropData.lat = panoInfo[5][0][1][0][2];
        dropData.lng = panoInfo[5][0][1][0][3];
        dropData.heading = panoInfo[5][0][1][2][0];
        dropData.pitch = 0;
        dropData.zoom = 0;
        dropData.id = 0;
        dropData.style = "streetview";
        const reverseResult = await reverseBatch([{
            "lat": dropData.lat,
            "lng": dropData.lng,
        }]);
        if (reverseResult.status == "ok") {
            dropData.code = reverseResult.response[0].iso2 || "";
            dropData.subCode = reverseResult.response[0].childIso2 || "";
        }
        return dropData;
    } else {
        return null;
    }
});
