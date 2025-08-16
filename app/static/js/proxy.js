const gmRequest = (async (url, method, data) => {
    const encodedUrl = btoa(url);
    const proxyUrl = "/proxy/gm?" + (new URLSearchParams({
        "url": encodedUrl
    })).toString();
    const fetchArgs = {
        method: method
    };
    if (data && method == "POST") fetchArgs.body = data;
    const response = await fetch(proxyUrl, fetchArgs);
    return response;
});
const apiRequest = (async (url, method, args) => {

    const encodedParams = btoa(JSON.stringify(args.params));
    const urlParamsDict = {
        server: args.server || "backend01",
        enc: Boolean(args.enc),
    };
    if (args.token) urlParamsDict["token"] = args.token;
    if (args.params) urlParamsDict["params"] = encodeURI(btoa(JSON.stringify(args.params)));
    const urlParams = new URLSearchParams(urlParamsDict).toString();
    const proxyUrl = "/proxy/gt" + url + "?" + urlParams;
    const fetchArgs = {
        method: method,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    }
    if (args.data && method == "POST") fetchArgs["body"] = JSON.stringify(args.data);
    const response = await fetch(proxyUrl, fetchArgs);
    var rjson = {};
    try {
        rjson = await response.json();
    } catch {
        rjson = {
            message: ""
        }
    }
    if (!response.ok) {
        return {
            "status": "error",
            "message": `geotastic connection failed: ${response.status} ${rjson.message}`,
            "response": null
        };
    }
    return rjson;
});
const logIn = async (mail, password, fingerprint) => {
    const response = await apiRequest("/v1/user/login.php", "POST", {
        "data": {
            "credentials": {
                "fingerprint": fingerprint,
                "mail": mail,
                "password": password
            }
        }
    });
    return response;
};
const getUserInfoViaToken = async (token) => {
    return await apiRequest("/v1/user/getUserInfoViaToken.php", "GET", {
        "token": token
    });
};
const getOwnMaps = async (token) => {
    return await apiRequest("/v1/maps/getMaps.php", "GET", {
        "token": token
    });
};
const getPlayableMaps = async (token) => {
    return await apiRequest("/v1/maps/getPlayableMaps.php", "GET", {
        "token": token
    });
};
const getMapDrops = async (token, mapId) => {
    return await apiRequest("/v1/maps/getDrops.php", "GET", {
        "token": token,
        "params": {
            "mapId": mapId
        }
    });
};
const getGroupDrops = async (token, groupId) => {
    return await apiRequest("/v1/maps/getDrops.php", "GET", {
        "token": token,
        "params": {
            "groupId": groupId
        }
    });
};

const getPlayableMap = async (token, mapId) => {
    return await apiRequest("/v1/maps/getPlayableMap.php", "GET", {
        "token": token,
        "params": {
            "id": mapId
        },
    });
};

const getPublicDropGroups = async (token, mapId) => {
    return await apiRequest("/v1/maps/getPublicDropGroups.php", "GET", {
        "token": token,
        "params": {
            "mapId": mapId,
            "withTags": true
        },
    });
};
const getDropGroup = async (token, groupId) => {
    return await apiRequest("/v1/maps/getDropGroup.php", "GET", {
        "token": token,
        "params": {
            "id": groupId
        }
    });
};
const reverseBatch = async (latlngs) => {
    return await apiRequest("/reverseBatch", "POST", {
        "server": "api01",
        "data": {
            "latLng": latlngs
        }
    });
};
const deleteDrops = async (token, dropIds) => {
    return await apiRequest("/v1/maps/deleteDrops.php", "POST", {
        "token": token,
        "data": dropIds,
    });
};

const importDrops = async (token, drops, targetId, targetType, importType) => {
    return await apiRequest("/v1/drops/importDrops.php", "POST", {
        "token": token,
        "data": {
            "drops": drops,
            "params": {
                "targetId": targetId,
                "targetType": targetType,
                "importType": importType
            }
        }
    });
};

const getDropInfoForBaseDropImport = async (token, drops) => {
    return await apiRequest("/v1/drops/getDropInfoForBaseDropImport.php", "POST", {
        "token": token,
        "data": {
            "data": drops
        }
    });
};

const createDropGroup = async(token, mapId, lat, lng, code, title, active, bias, other)=>{
    return await apiRequest("/v1/maps/updateDropGroup.php", "POST", {
        "token": token,
        "data": {
            "mapId": mapId,
            "lat": lat,
            "lng": lng,
            "code": code,
            "title": title,
            "active": active,
            "bias": bias,
            ...other
        }
    });
};
