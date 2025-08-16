core:
	emcc core/core.c -s WASM=1 -s USE_WEBGL2=1 -s INITIAL_MEMORY=64MB -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_FUNCTIONS='["_init", "_closest_marker", "_clear_screen", "_draw_markers", "_load_markers", "_create_float_buffer", "_create_uint_buffer", "_destroy_buffer", "_stretch", "_is_on_marker", "_box_select", "_project", "_affine_transform", "_multi_project", "_fbo_cap", "_print_grid", "_unload_markers"]'   -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "HEAPF32", "HEAPU32", "HEAPU8"]'   -o app/static/js/core/core.js
run:
	python app/server.py
minify:
	terser -o app/static/js/core/core.min.js -mc -- app/static/js/core/core.js
.PHONY: core run minify

