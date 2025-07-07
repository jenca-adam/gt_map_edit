Module.onRuntimeInitialized = () => {
    if (core.initWebgl() == -1) {
        alert("fail");
    }
    core.clearScreen(0, 0, 0, 0);
};

const core = {

    initWebgl: Module.cwrap("init_webgl", "number", []),
    clearScreen: Module.cwrap("clear_screen", "", ["number", "number", "number", "number"]),
    drawMarkers: Module.cwrap("draw_markers", "", ["number", "number", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float", "float"]),
    createFloatBuffer: Module.cwrap("create_float_buffer", "number", ["number"]),
    destroyBuffer: Module.cwrap("destroy_buffer", "", ["number"]),
    stretch: Module.cwrap("stretch", "", []),

};

