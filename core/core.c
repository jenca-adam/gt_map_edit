#include <emscripten.h>
#include <emscripten/html5.h>
#include <stdio.h>
#include <GLES2/gl2.h>
#include <math.h>

typedef struct marker{
    float lat;
    float lon;
    unsigned int id;
} marker;

typedef struct marker_list{
    marker m;
    struct marker_list *next;
} marker_list;

typedef struct grid{
    int width;
    int height;
    float res;
    marker_list **g;
} grid;

GLuint program_object;
grid g;
// i have no idea what i'm doing
GLuint LoadShader ( GLenum type, const char *shaderSrc )
{
   GLuint shader;
   GLint compiled;
   
   // Create the shader object
   shader = glCreateShader ( type );

   if ( shader == 0 )
   	return 0;

   // Load the shader source
   glShaderSource ( shader, 1, &shaderSrc, NULL );
   
   // Compile the shader
   glCompileShader ( shader );

   // Check the compile status
   glGetShaderiv ( shader, GL_COMPILE_STATUS, &compiled );

   if ( !compiled ) 
   {
      GLint infoLen = 0;

      glGetShaderiv ( shader, GL_INFO_LOG_LENGTH, &infoLen );
      
      if ( infoLen > 1 )
      {
         char* infoLog = malloc (sizeof(char) * infoLen );

         glGetShaderInfoLog ( shader, infoLen, NULL, infoLog );
         printf("info: %s\n", infoLog);
         free ( infoLog );
      }

      glDeleteShader ( shader );
      return 0;
   }

   return shader;

}
void print_grid(){
    for (int i=0; i<g.height*g.width; i++){
        marker_list *ml = g.g[i];
        if(ml) printf("TILE %d:\n", i);
            while(ml){
                printf("    %f %f\n", ml->m.lat, ml->m.lon);
                ml = ml->next;
            }

    }
}
void load_markers(float *xys, unsigned int *ids, int num, float grid_square_size){
    int square_index = 0;
    int width=360/grid_square_size;
    int height=180/grid_square_size;
    if(g.res!=grid_square_size){
        g.width=width;
        g.height=height;
        g.g=calloc(g.width*g.height, sizeof(marker_list*));
    }
    g.res = grid_square_size;
    for (int i=0; i<num; i+=2){
        float lat=fmin(fmax(xys[i], -90), 90);
        float lon=fmin(fmax(xys[i+1], -180), 180);
        int lat_tile = (90+lat)/g.res;
        int lon_tile = (180+lon)/g.res;
        int grid_space = g.width*lat_tile+lon_tile;
        printf("%f %f %d\n", lat, lon, grid_space);
        marker_list *new = malloc(sizeof(marker_list));

        new->m.lat = lat;
        new->m.lon = lon;
        new->m.id = ids[i/2];
        new->next = g.g[grid_space];
        g.g[grid_space] = new;
    }
    print_grid();
}
float distance(float lat1, float lng1, float lat2, float lng2){
    float r = 6378137.0;
    float phi1 = lat1*M_PI/180;
    float phi2 = lat2*M_PI/180;
    float phid = (lat2-lat1)*M_PI/180;
    float phil = (lng2-lng1)*M_PI/180;
    float a = pow(sin(phid/2.0),2)+cos(phi1)*cos(phi2)*pow(sin(phil/2.0),2);
    float c = 2.0 * atan2(sqrt(a), sqrt(1-a));
    return r*c;
}

unsigned int closest_marker(float lat, float lon, float mindist){
    int center_lat = (90+lat)/g.res;
    int center_lon = (180+lon)/g.res;
    float closest_distance = mindist;
    int closest_id = 0;
    marker *closest_marker =NULL;
    printf("TILE %d\n",g.width*center_lat+center_lon);
    for (int la = center_lat-1; la<=center_lat+1; la++){
        for (int lo = center_lon-1; lo<=center_lon+1; lo++){
            marker_list *ml = g.g[g.width*la+lo];
            while(ml){
                float d = distance(ml->m.lat, ml->m.lon, lat, lon);
                if(d<=closest_distance){
                    closest_distance = d;
                    closest_id = ml->m.id;
                    closest_marker = &ml->m;
                }
                ml = ml->next;
            }
        }
    }
    if(closest_marker){
        printf("%f %f", closest_marker->lat, closest_marker->lon);
    }
    return closest_id;
}
void stretch(){
    int width, height;
    emscripten_get_canvas_element_size("#overlay", &width, &height);
    glViewport(0, 0, width, height);
}

EMSCRIPTEN_KEEPALIVE
int init() {
    GLint linked;
    EmscriptenWebGLContextAttributes attr;
    g.res=0;
    emscripten_webgl_init_context_attributes(&attr);
    attr.alpha = true;
    attr.depth = true;
    attr.stencil = false;
    attr.antialias = true;
    attr.majorVersion = 2; // WebGL2
    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE ctx = emscripten_webgl_create_context("#overlay", &attr);
    const char *point_vs_src = 
        "attribute vec2 latlng;\n"
        "uniform vec4 transform;\n"
        "uniform vec2 origin;\n"
        "uniform float zoom;\n"
        "uniform float size;\n"
        "uniform float halfwidth;\n"
        "uniform float halfheight;\n"
        "vec2 project(vec2 ll){\n"
            "float lat=max(min(85.0511287798, ll.x), -85.0511287798);\n"
            "float s=sin(lat*0.017453292519943295);\n"
            "return vec2(6378137.0 * ll.y * 0.017453292519943295, 6378137.0 * log((1.0+s)/(1.0-s))/2.0);\n"// i love magic
        "}\n"
        "vec2 affine_transform(vec4 t, vec2 p, float scale){\n"
            "return vec2(scale*(t.x*p.x+t.y), scale*(t.z*p.y+t.w));\n"
        "}\n"
        "vec2 lat_lng_to_point(vec2 ll, vec4 t, vec2 o, float z){\n"
            "vec2 projected = project(ll);\n"
            "return affine_transform(t, projected, 256.0*pow(2.0,z))-o;\n"
        "}\n"
        "void main(){\n"
            "vec2 a=lat_lng_to_point(latlng, transform, origin, zoom);\n"
            "gl_PointSize=size;\n"
            "gl_Position=vec4((a.x-halfwidth)/halfwidth, -(a.y-halfheight)/halfheight, 0.0, 1.0);\n"
        "}\n";
    const char *point_fs_src = 
        "precision mediump float;\n"
        "uniform vec3 color;\n"
        "void main(){\n"
        "gl_FragColor=vec4(color, 1.0);\n" //no alpha
        "}\n";
    emscripten_webgl_make_context_current(ctx);
    stretch();
    GLuint point_vs = LoadShader(GL_VERTEX_SHADER, point_vs_src);
    GLuint point_fs = LoadShader(GL_FRAGMENT_SHADER, point_fs_src);
    program_object = glCreateProgram();
    printf("%d %d %d\n", point_vs, point_fs, program_object);
    if(!program_object){
        return -1;
    }
    glAttachShader(program_object, point_vs);
    glAttachShader(program_object, point_fs);

    glBindAttribLocation(program_object, 0, "latlng" );
    /*glBindAttribLocation(program_object, 1, "transform");
    glBindAttribLocation(program_object, 2, "origin");
    glBindAttribLocation(program_object, 3, "zoom");
    glBindAttribLocation(program_object, 4, "size");
    glBindAttribLocation(program_object, 5, "halfwidth");
    glBindAttribLocation(program_object, 6, "halfheight");*/
    glLinkProgram ( program_object);
    glGetProgramiv (program_object, GL_LINK_STATUS, &linked);
    if ( !linked )
   {
      GLint infoLen = 0;
      glGetProgramiv ( program_object, GL_INFO_LOG_LENGTH, &infoLen );
      if ( infoLen > 1 )
      {
         char* infoLog = malloc (sizeof(char) * infoLen );

         glGetProgramInfoLog ( program_object, infoLen, NULL, infoLog );
         printf( "Error linking program:\n%s\n", infoLog );

         free ( infoLog );
      }

      glDeleteProgram ( program_object );
      return -1;
   }
    
    return 0;
}

void clear_screen(float r, float g, float b, float a) {
    glClearColor(r, g, b, a);
    glClear(GL_COLOR_BUFFER_BIT);
}

GLfloat *create_float_buffer(int num){
    return (GLfloat*)malloc(num*sizeof(GLfloat));
}
unsigned int *create_uint_buffer(int num){
    return (unsigned int*)malloc(num*sizeof(unsigned int));
}
void destroy_buffer(void *buf){
    free(buf);
}
void draw_markers(GLfloat *xys, int num, GLfloat tx, GLfloat ty, GLfloat tz, GLfloat tw,  GLfloat ox, GLfloat oy, GLfloat zoom, GLfloat size, GLfloat cr, GLfloat cg, GLfloat cb){
    GLuint posobj;
    int w, h;
    emscripten_get_canvas_element_size("#overlay", &w, &h);
    glGenBuffers(1, &posobj);
    glBindBuffer(GL_ARRAY_BUFFER, posobj);
    glBufferData(GL_ARRAY_BUFFER, num*sizeof(GLfloat), xys, GL_STATIC_DRAW);
    glUseProgram(program_object);
    glBindBuffer(GL_ARRAY_BUFFER, posobj);
    // latlns are in xys
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);
    //everything else is uniform
    GLint u_transform     = glGetUniformLocation(program_object, "transform");
    glUniform4f(u_transform, tx, ty, tz, tw); // transform
    GLint u_origin        = glGetUniformLocation(program_object, "origin");
    glUniform2f(u_origin, ox, oy); //origin
    GLint u_zoom          = glGetUniformLocation(program_object, "zoom");
    glUniform1f(u_zoom, zoom);
    GLint u_size          = glGetUniformLocation(program_object, "size");
    glUniform1f(u_size, size);
    GLint u_halfwidth     = glGetUniformLocation(program_object, "halfwidth");
    glUniform1f(u_halfwidth, w/2.0);
    GLint u_halfheight    = glGetUniformLocation(program_object, "halfheight");
    glUniform1f(u_halfheight, h/2.0);
    GLint u_color = glGetUniformLocation(program_object, "color");
    glUniform3f(u_color, cr, cg, cb);
    /*
    glVertexAttrib4f(1, tx, ty, tz, tw); // transform
    glDisableVertexAttribArray(1);
    glVertexAttrib2f(2, ox, oy); //  origin
    glDisableVertexAttribArray(2);
    glVertexAttrib1f(3, zoom);
    glDisableVertexAttribArray(3);
    glVertexAttrib1f(4, size);
    glDisableVertexAttribArray(4);
    glVertexAttrib1f(5, w/2.0);
    glDisableVertexAttribArray(5);
    glVertexAttrib1f(6, h/2.0);
    glDisableVertexAttribArray(6);
    */
    glDrawArrays ( GL_POINTS, 0, num/2);
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDeleteBuffers(1, &posobj);

}


