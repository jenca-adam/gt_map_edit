#include <GLES2/gl2.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
typedef struct marker {
  float x; // MARKER POSITIONS ARE PROJECTED AT ZOOM 1
  float y;
  unsigned int id;
} marker;

typedef struct marker_list {
  marker m;
  struct marker_list *next;
} marker_list;

typedef struct grid {
  int width;
  int height;
  float res;
  marker_list **g;
} grid;

typedef struct {
  double x;
  double y;
} vec2;

typedef struct {
  double x;
  double y;
  double z;
  double w;
} vec4;

#define DEG2RAD (0.017453292519943295)
#define EARTH_RADIUS 6378137.0

GLuint n_markers = 0;
GLuint program_object;
GLuint fbo = 0, fbo_tex = 0;
grid g;


// i have no idea what i'm doing
GLuint LoadShader(GLenum type, const char *shaderSrc) {
  GLuint shader;
  GLint compiled;

  // Create the shader object
  shader = glCreateShader(type);

  if (shader == 0)
    return 0;

  // Load the shader source
  glShaderSource(shader, 1, &shaderSrc, NULL);

  // Compile the shader
  glCompileShader(shader);

  // Check the compile status
  glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);

  if (!compiled) {
    GLint infoLen = 0;

    glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &infoLen);
    printf("COMPILATION FAILED\n");
    if (infoLen > 1) {
      char *infoLog = malloc(sizeof(char) * infoLen);

      glGetShaderInfoLog(shader, infoLen, NULL, infoLog);
      printf("info: %s\n", infoLog);
      free(infoLog);
    }

    glDeleteShader(shader);
    return 0;
  }

  return shader;
}
vec2 project(double la, double lo) {
  // Clamp latitude to Mercator projection limits
  double lat = fmax(fmin(85.0511287798, la), -85.0511287798);
  double s = sin(lat * DEG2RAD);
  double x = EARTH_RADIUS * lo * DEG2RAD;
  double y = EARTH_RADIUS * log((1.0 + s) / (1.0 - s)) / 2.0;
  return (vec2){x, y};
}

vec2 affine_transform(double tx, double ty, double tz, double tw, vec2 p,
                      double scale) {
  double x = scale * (tx * p.x + ty);
  double y = scale * (tz * p.y + tw);
  return (vec2){x, y};
}

void multi_project(float *xys, int num, double scale, double tx, double ty,
                   double tz, double tw, float *newbuf) {
  for (int i = 0; i < num; i += 2) {
    float lat = xys[i];
    float lon = xys[i + 1];
    vec2 projected = project(lat, lon);
    vec2 transformed = affine_transform(tx, ty, tz, tw, projected, scale);
    newbuf[i] = transformed.x;
    newbuf[i + 1] = transformed.y;
  }
}
void print_grid() {
  for (int i = 0; i < g.height * g.width; i++) {
    marker_list *ml = g.g[i];
    if (ml)
      printf("TILE %d:\n", i);
    while (ml) {
      printf("    %f %f\n", ml->m.x, ml->m.y);
      ml = ml->next;
    }
  }
}
void load_markers(float *xys, unsigned int *ids, int num,
                  float grid_square_size) {
  int square_index = 0;

  int width = 1.0 / grid_square_size;
  int height = 1.0 / grid_square_size;

  if (g.res != grid_square_size) {
    if (g.g) {
      free(g.g);
    }

    g.width = width;
    g.height = height;
    g.g = calloc(g.width * g.height, sizeof(marker_list *));
  }
  n_markers += num / 2;
  g.res = grid_square_size;
  for (int i = 0; i < num; i += 2) {
    float x = xys[i];
    float y = xys[i + 1];
    int x_tile = x / g.res;
    int y_tile = y / g.res;
    int grid_space = g.width * y_tile + x_tile;
    marker_list *new = malloc(sizeof(marker_list));

    new->m.x = x;
    new->m.y = y;
    new->m.id = ids[i / 2];
    new->next = g.g[grid_space];
    g.g[grid_space] = new;
  }
}
void unload_markers(float *xys, unsigned int *ids, int num){
    printf("UNLOAD\n");
    for (int i = 0; i < num; i += 2) {
        unsigned int id = ids[i/2];
        printf("TRY %d\n", id);
        float x = xys[i];
        float y = xys[i + 1];
        int x_tile = x / g.res;
        int y_tile = y / g.res;
        int grid_space = g.width * y_tile + x_tile;
        marker_list *ml = g.g[grid_space];
        marker_list *prev = NULL;
        while(ml){
            if (ml->m.id==id){
                printf("REMOVING %d\n", ml->m.id);
                //remove item
                if(prev){
                    prev->next= ml->next;
                }
                else{
                    g.g[grid_space]=ml->next;
                }
                free(ml);
                break;
            }
            prev=ml;
            ml=ml->next;
        }
    }
}
float earth_distance(float lat1, float lng1, float lat2, float lng2) {
  float r = 6378137.0;
  float phi1 = lat1 * M_PI / 180;
  float phi2 = lat2 * M_PI / 180;
  float phid = (lat2 - lat1) * M_PI / 180;
  float phil = (lng2 - lng1) * M_PI / 180;
  float a =
      pow(sin(phid / 2.0), 2) + cos(phi1) * cos(phi2) * pow(sin(phil / 2.0), 2);
  float c = 2.0 * atan2(sqrt(a), sqrt(1 - a));
  return r * c;
}
float distance(float x1, float y1, float x2, float y2) {
  return sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}
unsigned int is_on_marker(int x, int y) {
  GLubyte col[4];
  glFlush();
  glBindFramebuffer(GL_FRAMEBUFFER, fbo);
  glReadPixels(x, y, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, col);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  if(*(unsigned int*)col){
    printf("%d %d %d %d\n", col[0], col[1], col[2], col[3]);
  };
  return *(unsigned int *)col;
}
GLubyte *fbo_cap(){
  int width, height;
  emscripten_get_canvas_element_size("#overlay", &width, &height);

    glFlush();
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    GLubyte *col = malloc(4*width*height);
    glReadPixels(0,0,width, height, GL_RGBA, GL_UNSIGNED_BYTE, col);
    return col;
}
unsigned int closest_marker(float x, float y, float mindist) {
  int center_x = x / g.res;
  int center_y = y / g.res;
  float closest_distance = mindist;
  int closest_id = 0;
  marker *closest_marker = NULL;
  printf("%f %f TILE %d\n", x, y, g.width * center_y + center_x);
  for (int lx = center_x - 1; lx <= center_x + 1; lx++) {
    for (int ly = center_y - 1; ly <= center_y + 1; ly++) {
      if (lx < 0 || lx > g.width || ly < 0 || ly > g.height)
        continue;
      marker_list *ml = g.g[g.width * ly + lx];
      while (ml) {
        float d = distance(ml->m.x, ml->m.y, x, y);
        if (d <= closest_distance) {
          closest_distance = d;
          closest_id = ml->m.id;
          closest_marker = &ml->m;
        }
        ml = ml->next;
      }
    }
  }
  printf("DISTANCE %f\n", closest_distance);
  int width, height;
  emscripten_get_canvas_element_size("#overlay", &width, &height);

  return closest_id;
}
unsigned int box_select(float x1, float y1, float x2, float y2,
                        unsigned int *id_buffer) {
  // id_buffer MUST BE AT LEAST n_markers LONG !!
  int buffer_index = 0;
  int tile_x1 = x1 / g.res;
  int tile_y1 = y1 / g.res;
  int tile_x2 = x2 / g.res;
  int tile_y2 = y2 / g.res;

  for (int lx = tile_x1; lx <= tile_x2; lx++) {
    for (int ly = tile_y1; ly <= tile_y2; ly++) {
      if (lx < 0 || lx > g.width || ly < 0 || ly > g.height)
        continue;
      marker_list *ml = g.g[g.width * ly + lx];
      while (ml) {
        marker m = ml->m;
        if (m.x > x1 && m.x < x2 && m.y > y1 && m.y < y2) {
          id_buffer[buffer_index] = m.id;
          buffer_index++;
        }
        ml = ml->next;
      }
    }
  }
  return buffer_index;
}
void stretch() {
  int width, height;
  emscripten_get_canvas_element_size("#overlay", &width, &height);
  glViewport(0, 0, width, height);
  if (fbo) {
    glDeleteFramebuffers(1, &fbo);
  }
  if (fbo_tex) {
    glDeleteTextures(1, &fbo_tex);
  }
  glGenFramebuffers(1, &fbo);
  glGenTextures(1, &fbo_tex);
  glBindFramebuffer(GL_FRAMEBUFFER, fbo);
  glBindTexture(GL_TEXTURE_2D, fbo_tex);
  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA,
               GL_UNSIGNED_BYTE, NULL);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
  glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D,
                         fbo_tex, 0);
  GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
  if (status != GL_FRAMEBUFFER_COMPLETE) {
    printf("Framebuffer not complete. Status: 0x%x\n", status);
    return;
  }
  glBindTexture(GL_TEXTURE_2D, 0);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

EMSCRIPTEN_KEEPALIVE
int init() {
  GLint linked;
  EmscriptenWebGLContextAttributes attr;
  g.res = 0;
  emscripten_webgl_init_context_attributes(&attr);
  attr.alpha = true;
  attr.depth = true;
  attr.stencil = false;
  attr.antialias = true;
  attr.majorVersion = 2; // WebGL2
  EMSCRIPTEN_WEBGL_CONTEXT_HANDLE ctx =
      emscripten_webgl_create_context("#overlay", &attr);
  const char *point_vs_src =
      "#version 300 es\n"
      "in vec2 latlng;\n"
      "uniform vec4 transform;\n"
      "uniform vec2 origin;\n"
      "uniform float zoom;\n"
      "uniform float size;\n"
      "uniform float halfwidth;\n"
      "uniform float halfheight;\n"
      "out vec2 mcenter;\n"
      "out float msize;\n"
      "out float height;\n"
      "vec2 project(vec2 ll){\n"
      "float lat=max(min(85.0511287798, ll.x), -85.0511287798);\n"
      "float s=sin(lat*0.017453292519943295);\n"
      "return vec2(6378137.0 * ll.y * 0.017453292519943295, 6378137.0 * "
      "log((1.0+s)/(1.0-s))/2.0);\n" // i love magic
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
      "vec2 center=vec2((a.x-halfwidth)/halfwidth, "
      "-(a.y-halfheight)/halfheight);\n"
      "mcenter=a;\n"
      "msize=size;\n"
      "height=halfheight*2.0;\n"
      "gl_PointSize=size;\n"
      "gl_Position=vec4(center, 0.0, 1.0);\n"
      "}\n";
  const char *point_fs_src =
      "#version 300 es\n"
      "precision mediump float;\n"
      "uniform vec3 marker_color;\n"
      "in vec2 mcenter;\n"
      "in float msize;\n"
      "in float height;\n"
      "out vec4 color;\n"
      "void main(){\n"
      "vec2 position=vec2(gl_FragCoord.x, height-gl_FragCoord.y);\n"
      "float d =  distance(position, mcenter);\n"
      "if(d<=msize*0.5){\n" // circles
      "color=vec4(marker_color, 1.0);\n"
      "if(msize*0.5-d<=1.0){\n" //border
      "color=vec4(0.0, 0.0, 0.0, 1.0);"  
      "}}\n"
      "else {discard;}\n"
       "}\n";
  emscripten_webgl_make_context_current(ctx);
  stretch();
  GLuint point_vs = LoadShader(GL_VERTEX_SHADER, point_vs_src);
  GLuint point_fs = LoadShader(GL_FRAGMENT_SHADER, point_fs_src);
  program_object = glCreateProgram();
  printf("%d %d %d\n", point_vs, point_fs, program_object);
  if (!program_object | !point_vs | !point_fs) {
    return -1;
  }
  glAttachShader(program_object, point_vs);
  glAttachShader(program_object, point_fs);

  glBindAttribLocation(program_object, 0, "latlng");
  /*glBindAttribLocation(program_object, 1, "transform");
  glBindAttribLocation(program_object, 2, "origin");
  glBindAttribLocation(program_object, 3, "zoom");
  glBindAttribLocation(program_object, 4, "size");
  glBindAttribLocation(program_object, 5, "halfwidth");
  glBindAttribLocation(program_object, 6, "halfheight");*/
  glLinkProgram(program_object);
  glGetProgramiv(program_object, GL_LINK_STATUS, &linked);
  if (!linked) {
    GLint infoLen = 0;
    glGetProgramiv(program_object, GL_INFO_LOG_LENGTH, &infoLen);
    if (infoLen > 1) {
      char *infoLog = malloc(sizeof(char) * infoLen);

      glGetProgramInfoLog(program_object, infoLen, NULL, infoLog);
      printf("Error linking program:\n%s\n", infoLog);

      free(infoLog);
    }

    glDeleteProgram(program_object);
    return -1;
  }
  return 0;
}

void clear_screen(float r, float g, float b, float a) {
  glClearColor(r, g, b, a);
  glBindFramebuffer(GL_FRAMEBUFFER, fbo);
  glClear(GL_COLOR_BUFFER_BIT);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  glClear(GL_COLOR_BUFFER_BIT);
}

GLfloat *create_float_buffer(int num) {
  return (GLfloat *)malloc(num * sizeof(GLfloat));
}
unsigned int *create_uint_buffer(int num) {
  return (unsigned int *)malloc(num * sizeof(unsigned int));
}
void destroy_buffer(void *buf) { free(buf); }
void draw_markers(GLfloat *xys, int num, GLfloat *sxys, int snum, GLfloat *hxys, int hnum, GLfloat tx,
                  GLfloat ty, GLfloat tz, GLfloat tw, GLfloat ox, GLfloat oy,
                  GLfloat zoom, GLfloat size, GLfloat cr, GLfloat cg,
                  GLfloat cb, GLfloat scr, GLfloat scg, GLfloat scb, GLfloat hsize, GLfloat hcr, GLfloat hcg, GLfloat hcb) {
  GLuint posobj = 0, sposobj = 0, hposobj=0;
  int w, h;
  emscripten_get_canvas_element_size("#overlay", &w, &h);
  printf("%d %f\n", snum, sxys[0]);
  if (snum) {
    glGenBuffers(1, &sposobj);
    glBindBuffer(GL_ARRAY_BUFFER, sposobj);
    glBufferData(GL_ARRAY_BUFFER, snum * sizeof(GLfloat), sxys, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);
  }
    if (hnum) {
    glGenBuffers(1, &hposobj);
    glBindBuffer(GL_ARRAY_BUFFER, hposobj);
    glBufferData(GL_ARRAY_BUFFER, hnum * sizeof(GLfloat), hxys, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);
  }

  glGenBuffers(1, &posobj);
  glBindBuffer(GL_ARRAY_BUFFER, posobj);
  glBufferData(GL_ARRAY_BUFFER, num * sizeof(GLfloat), xys, GL_STATIC_DRAW);
  glUseProgram(program_object);
  // latlns are in xys
  glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
  glEnableVertexAttribArray(0);
  // everything else is uniform
  GLint u_transform = glGetUniformLocation(program_object, "transform");
  glUniform4f(u_transform, tx, ty, tz, tw); // transform
  GLint u_origin = glGetUniformLocation(program_object, "origin");
  glUniform2f(u_origin, ox, oy); // origin
  GLint u_zoom = glGetUniformLocation(program_object, "zoom");
  glUniform1f(u_zoom, zoom);
  GLint u_size = glGetUniformLocation(program_object, "size");
  glUniform1f(u_size, size);
  GLint u_halfwidth = glGetUniformLocation(program_object, "halfwidth");
  glUniform1f(u_halfwidth, w / 2.0);
  GLint u_halfheight = glGetUniformLocation(program_object, "halfheight");
  glUniform1f(u_halfheight, h / 2.0);
  GLint u_color = glGetUniformLocation(program_object, "marker_color");
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
  // FBO COPY
  glBindFramebuffer(GL_FRAMEBUFFER, fbo);
  glBindBuffer(GL_ARRAY_BUFFER, posobj);
  glDrawArrays(GL_POINTS, 0, num / 2);
  if (sposobj) {
    glBindBuffer(GL_ARRAY_BUFFER, sposobj);
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);
    glUniform3f(u_color, scr, scg, scb);
    glDrawArrays(GL_POINTS, 0, snum / 2);
    glBindBuffer(GL_ARRAY_BUFFER, posobj);
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);

    glUniform3f(u_color, cr, cg, cb);
  }

  // default
  glBindFramebuffer(GL_FRAMEBUFFER, 0);

  glDrawArrays(GL_POINTS, 0, num / 2);
  if (sposobj) {
    glBindBuffer(GL_ARRAY_BUFFER, sposobj);
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);

    glUniform3f(u_color, scr, scg, scb);
    glDrawArrays(GL_POINTS, 0, snum / 2);
    glDeleteBuffers(1, &sposobj);
  }
if (hposobj) {
    glBindBuffer(GL_ARRAY_BUFFER, hposobj);
    glVertexAttribPointer(0, 2, GL_FLOAT, 0, 0, 0);
    glEnableVertexAttribArray(0);

    glUniform3f(u_color, hcr, hcg, hcb);
    glUniform1f(u_size, hsize);
    glDrawArrays(GL_POINTS, 0, hnum / 2);
    glDeleteBuffers(1, &hposobj);
  }
  glBindBuffer(GL_ARRAY_BUFFER, 0);

  glDeleteBuffers(1, &posobj);
  glFlush();
}
