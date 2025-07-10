const apiRequest = (async (url, method, args) => {

    const encodedParams = btoa(JSON.stringify(args.params));
    const urlParamsDict = {
        server: args.server || "api",
        enc: Boolean(args.enc),
    };
    if (args.token) urlParamsDict["token"] = args.token;
    if (args.params) urlParamsDict["params"] = encodeURI(btoa(JSON.stringify(args.params)));
    const urlParams = new URLSearchParams(urlParamsDict).toString();
    const proxyUrl = "/proxy" + url + "?" + urlParams;
    const fetchArgs = {
        method: method,
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    }
    if (args.data && method == "POST") fetchArgs["body"] = JSON.stringify(args.data);
    const response = await fetch(proxyUrl, fetchArgs);
    return await response.json();
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
            "id":groupId
        }
    });
};
