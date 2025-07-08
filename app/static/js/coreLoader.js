Module.onRuntimeInitialized = () => {
    if (core.init() == -1) {
        alert("fail");
    }
    core.clearScreen(0, 0, 0, 0);
};

const core = {

    init: Module.cwrap("init", "number", []),
    clearScreen: Module.cwrap("clear_screen", "", ["number", "number", "number", "number"]),
    drawMarkers: Module.cwrap("draw_markers", "", ["number", "number", "number", "number", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float"]),
    createFloatBuffer: Module.cwrap("create_float_buffer", "number", ["number"]),
    createUintBuffer: Module.cwrap("create_uint_buffer", "number", ["number"]),
    destroyBuffer: Module.cwrap("destroy_buffer", "", ["number"]),
    stretch: Module.cwrap("stretch", "", []),
    loadMarkers: Module.cwrap("load_markers", "", ["number", "number", "number", "float"]),
    closestMarker: Module.cwrap("closest_marker", "number", ["float", "float", "float"]),
    isOnMarker: Module.cwrap("is_on_marker", "number", ["number", "number"])
    
};

