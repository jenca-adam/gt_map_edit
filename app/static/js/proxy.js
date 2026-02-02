const PROXY_ROOT_URL = "/proxy";
const gmRequest = (async (url, method, data) => {
    const proxyUrl = PROXY_ROOT_URL+"/gm/"+url;
    const fetchArgs = {
        method: method
    };
    if (data && method == "POST") fetchArgs.body = data;
    const response = await fetch(proxyUrl, fetchArgs);
    return response;
});
const apiRequest = (async (url, method, args) => {
    let extraHeaders = {};
    const encodedParams = btoa(JSON.stringify(args.params));
    if (args.token) extraHeaders["X-Auth-Token"] = args.token;
    const urlParams = new URLSearchParams(args.params||{}).toString();
    const proxyUrl = PROXY_ROOT_URL+ "/gt/"+(args.server||"backend01")+ url + "?" + urlParams;
    const fetchArgs = {
        method: method,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            ...extraHeaders
        }
    }
    let data = args.enc&&args.data?await encodeEncdata(args.data):args.data;
    if (data && method == "POST") fetchArgs["body"] = JSON.stringify(data);
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
    const resp = rjson.encData?await decodeEncdata(JSON.parse(rjson.encData)):rjson.data;
    return {"status":rjson.status, "message":rjson.message, "response":resp};
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

const getDropGroups = async(token, mapId) => {
    return await apiRequest("/v1/maps/getDropGroups.php", "GET", {
        "token": token,
        "params": {
            "mapId": mapId
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

