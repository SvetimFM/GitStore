/* ═══════════════════════════════════════════════════════════
   PHYSARUM SIMULATION — Full WebGL2 port (shared across pages)
   ═══════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  var canvas = document.getElementById('physarum-canvas');
  if (!canvas) return;

  var gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    canvas.style.display = 'none';
    return;
  }

  var extColorFloat = gl.getExtension('EXT_color_buffer_float');
  if (!extColorFloat) {
    canvas.style.display = 'none';
    return;
  }

  // ─── Configuration ───
  var AGENT_COUNT = 40000;
  var SENSOR_ANGLE = 0.45;
  var SENSOR_DIST = 14.0;
  var TURN_SPEED = 0.35;
  var MOVE_SPEED = 1.2;
  var DEPOSIT_AMOUNT = 0.4;
  var DECAY_RATE = 0.03;
  var DIFFUSE_RADIUS = 1;
  var EXPLORER_RATIO = 0.3;
  var EXPLORER_SENSOR_ANGLE = 0.9;
  var EXPLORER_SENSOR_DIST = 20.0;
  var EXPLORER_TURN_SPEED = 0.5;
  var EXPLORER_MOVE_SPEED = 0.8;
  var EXPLORER_DEPOSIT = 0.15;
  var FOOD_STRENGTH = 3.0;
  var FOOD_RADIUS = 60.0;
  var MOUSE_STRENGTH = 4.0;
  var MOUSE_RADIUS = 100.0;
  var MAX_FOOD_SOURCES = 32;

  var simWidth, simHeight, trailWidth, trailHeight;
  var mouseX = -1000, mouseY = -1000;
  var foodSources = [];
  var animId = null;
  var foodData = new Float32Array(MAX_FOOD_SOURCES * 4);

  // ─── WebGL Helpers ───
  function compileShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function linkProgram(vsSrc, fsSrc) {
    var vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    var fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    gl.detachShader(prog, vs);
    gl.detachShader(prog, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  function createFBO(tex) {
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fbo;
  }

  function createFloatTex(w, h, data) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function createTrailTex(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  // ─── Shaders ───
  var FULLSCREEN_VS = '#version 300 es\nin vec2 a_pos;out vec2 v_uv;void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0,1);}';

  var AGENT_UPDATE_VS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D u_agents;',
    'uniform sampler2D u_trail;',
    'uniform vec2 u_resolution;',
    'uniform float u_time;',
    'uniform float u_dt;',
    'uniform int u_agentCount;',
    'uniform vec4 u_foodSources[' + MAX_FOOD_SOURCES + '];',
    'uniform int u_foodCount;',
    'uniform vec2 u_mouse;',
    'uniform float u_mouseStrength;',
    'uniform float u_mouseRadius;',
    '',
    'in vec2 a_pos;',
    'out vec4 v_newState;',
    '',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    '',
    'void main(){',
    '  int id=gl_VertexID;',
    '  int texW=textureSize(u_agents,0).x;',
    '  ivec2 coord=ivec2(id%texW,id/texW);',
    '  vec4 state=texelFetch(u_agents,coord,0);',
    '  vec2 pos=state.xy;',
    '  float angle=state.z;',
    '  float type=state.w;',
    '  bool isExplorer=type>0.5;',
    '',
    '  float sAngle=isExplorer?' + EXPLORER_SENSOR_ANGLE.toFixed(4) + ':' + SENSOR_ANGLE.toFixed(4) + ';',
    '  float sDist=isExplorer?' + EXPLORER_SENSOR_DIST.toFixed(4) + ':' + SENSOR_DIST.toFixed(4) + ';',
    '  float tSpeed=isExplorer?' + EXPLORER_TURN_SPEED.toFixed(4) + ':' + TURN_SPEED.toFixed(4) + ';',
    '  float mSpeed=isExplorer?' + EXPLORER_MOVE_SPEED.toFixed(4) + ':' + MOVE_SPEED.toFixed(4) + ';',
    '',
    '  vec2 trailRes=vec2(textureSize(u_trail,0));',
    '  vec2 uvC=pos/u_resolution;',
    '  vec2 dirF=vec2(cos(angle),sin(angle));',
    '  vec2 dirL=vec2(cos(angle+sAngle),sin(angle+sAngle));',
    '  vec2 dirR=vec2(cos(angle-sAngle),sin(angle-sAngle));',
    '',
    '  float sF=texture(u_trail,(pos+dirF*sDist)/u_resolution).r;',
    '  float sL=texture(u_trail,(pos+dirL*sDist)/u_resolution).r;',
    '  float sR=texture(u_trail,(pos+dirR*sDist)/u_resolution).r;',
    '',
    '  if(!isExplorer){',
    '    for(int i=0;i<' + MAX_FOOD_SOURCES + ';i++){',
    '      if(i>=u_foodCount)break;',
    '      vec2 fp=u_foodSources[i].xy;',
    '      float fr=u_foodSources[i].z;',
    '      float fs=u_foodSources[i].w;',
    '      float d=distance(pos,fp);',
    '      if(d<fr){',
    '        float influence=fs*(1.0-d/fr);',
    '        vec2 toFood=normalize(fp-pos);',
    '        sF+=influence*max(0.0,dot(dirF,toFood));',
    '        sL+=influence*max(0.0,dot(dirL,toFood));',
    '        sR+=influence*max(0.0,dot(dirR,toFood));',
    '      }',
    '    }',
    '  }',
    '',
    '  if(u_mouseStrength>0.0){',
    '    float md=distance(pos,u_mouse);',
    '    if(md<u_mouseRadius){',
    '      float mi=u_mouseStrength*(1.0-md/u_mouseRadius);',
    '      vec2 toM=normalize(u_mouse-pos);',
    '      sF+=mi*max(0.0,dot(dirF,toM));',
    '      sL+=mi*max(0.0,dot(dirL,toM));',
    '      sR+=mi*max(0.0,dot(dirR,toM));',
    '    }',
    '  }',
    '',
    '  float rnd=hash(pos+vec2(u_time));',
    '  if(sF>=sL&&sF>=sR){',
    '  }else if(sL>sR){',
    '    angle+=tSpeed*u_dt;',
    '  }else if(sR>sL){',
    '    angle-=tSpeed*u_dt;',
    '  }else{',
    '    angle+=(rnd-0.5)*tSpeed*2.0*u_dt;',
    '  }',
    '',
    '  pos+=vec2(cos(angle),sin(angle))*mSpeed*u_dt;',
    '',
    '  if(pos.x<0.0)pos.x+=u_resolution.x;',
    '  if(pos.x>=u_resolution.x)pos.x-=u_resolution.x;',
    '  if(pos.y<0.0)pos.y+=u_resolution.y;',
    '  if(pos.y>=u_resolution.y)pos.y-=u_resolution.y;',
    '',
    '  v_newState=vec4(pos,angle,type);',
    '  vec2 ndc=((vec2(coord)+0.5)/vec2(textureSize(u_agents,0)))*2.0-1.0;',
    '  gl_Position=vec4(ndc,0,1);',
    '  gl_PointSize=1.0;',
    '}'
  ].join('\n');

  var AGENT_UPDATE_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec4 v_newState;',
    'out vec4 fragColor;',
    'void main(){fragColor=v_newState;}'
  ].join('\n');

  var DEPOSIT_POINT_VS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D u_agents;',
    'uniform vec2 u_trailRes;',
    'uniform vec2 u_simRes;',
    'flat out float v_deposit;',
    'void main(){',
    '  int id=gl_VertexID;',
    '  int texW=textureSize(u_agents,0).x;',
    '  ivec2 coord=ivec2(id%texW,id/texW);',
    '  vec4 state=texelFetch(u_agents,coord,0);',
    '  vec2 pos=state.xy;',
    '  float type=state.w;',
    '  bool isExplorer=type>0.5;',
    '  v_deposit=isExplorer?' + EXPLORER_DEPOSIT.toFixed(4) + ':' + DEPOSIT_AMOUNT.toFixed(4) + ';',
    '  vec2 ndc=(pos/u_simRes)*2.0-1.0;',
    '  gl_Position=vec4(ndc,0,1);',
    '  gl_PointSize=1.0;',
    '}'
  ].join('\n');

  var DEPOSIT_POINT_FS = [
    '#version 300 es',
    'precision highp float;',
    'flat in float v_deposit;',
    'out vec4 fragColor;',
    'void main(){fragColor=vec4(v_deposit,v_deposit*0.5,0,1);}'
  ].join('\n');

  var DIFFUSE_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D u_trail;',
    'uniform vec2 u_texelSize;',
    'uniform float u_decay;',
    'in vec2 v_uv;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec4 sum=vec4(0);',
    '  for(int y=-' + DIFFUSE_RADIUS + ';y<=' + DIFFUSE_RADIUS + ';y++){',
    '    for(int x=-' + DIFFUSE_RADIUS + ';x<=' + DIFFUSE_RADIUS + ';x++){',
    '      sum+=texture(u_trail,v_uv+vec2(x,y)*u_texelSize);',
    '    }',
    '  }',
    '  float count=float((' + (DIFFUSE_RADIUS*2+1) + ')*(' + (DIFFUSE_RADIUS*2+1) + '));',
    '  vec4 blurred=sum/count;',
    '  fragColor=max(vec4(0),blurred-u_decay);',
    '}'
  ].join('\n');

  var DISPLAY_FS = [
    '#version 300 es',
    'precision highp float;',
    'uniform sampler2D u_trail;',
    'uniform vec2 u_mouse;',
    'uniform vec2 u_resolution;',
    'uniform float u_mouseRadius;',
    'in vec2 v_uv;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec4 t=texture(u_trail,v_uv);',
    '  float primary=t.r;',
    '  float explorer=t.g;',
    '',
    '  vec3 blue=vec3(0.231,0.510,0.965);',
    '  vec3 cyan=vec3(0.133,0.827,0.933);',
    '  vec3 indigo=vec3(0.263,0.302,0.549);',
    '  vec3 fogColor=vec3(0.20,0.22,0.33);',
    '  vec3 bgColor=vec3(0.020,0.020,0.039);',
    '',
    '  vec3 primaryColor=mix(blue,cyan,smoothstep(0.0,1.5,primary));',
    '  vec3 explorerColor=mix(indigo,fogColor,smoothstep(0.0,0.8,explorer));',
    '',
    '  float pI=smoothstep(0.0,0.3,primary)*0.85;',
    '  float eI=smoothstep(0.0,0.2,explorer)*0.15;',
    '',
    '  vec3 color=bgColor;',
    '  color=mix(color,explorerColor,eI);',
    '  color=mix(color,primaryColor,pI);',
    '',
    '  vec2 fragPos=v_uv*u_resolution;',
    '  float md=distance(fragPos,u_mouse);',
    '  if(md<u_mouseRadius){',
    '    float glow=(1.0-md/u_mouseRadius)*0.08;',
    '    color+=blue*glow;',
    '  }',
    '',
    '  fragColor=vec4(color,1.0);',
    '}'
  ].join('\n');

  // ─── State ───
  var agentProgram, depositPointProgram, diffuseProgram, displayProgram;
  var agentTexA, agentTexB, agentFboA, agentFboB;
  var trailTexA, trailTexB, trailFboA, trailFboB;
  var quadVAO, quadVBO, agentVAO;
  var agentTexWidth, agentTexHeight;
  var currentAgentRead = 'A';
  var currentTrailRead = 'A';
  var frameTime = 0;

  function init() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    simWidth = canvas.width;
    simHeight = canvas.height;
    trailWidth = Math.floor(simWidth / 2);
    trailHeight = Math.floor(simHeight / 2);

    agentProgram = linkProgram(AGENT_UPDATE_VS, AGENT_UPDATE_FS);
    depositPointProgram = linkProgram(DEPOSIT_POINT_VS, DEPOSIT_POINT_FS);
    diffuseProgram = linkProgram(FULLSCREEN_VS, DIFFUSE_FS);
    displayProgram = linkProgram(FULLSCREEN_VS, DISPLAY_FS);

    if (!agentProgram || !depositPointProgram || !diffuseProgram || !displayProgram) {
      console.error('Physarum: Failed to compile shaders');
      canvas.style.display = 'none';
      return false;
    }

    quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    quadVAO = gl.createVertexArray();
    gl.bindVertexArray(quadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    agentVAO = gl.createVertexArray();

    agentTexWidth = Math.ceil(Math.sqrt(AGENT_COUNT));
    agentTexHeight = Math.ceil(AGENT_COUNT / agentTexWidth);
    var totalPixels = agentTexWidth * agentTexHeight;
    var agentData = new Float32Array(totalPixels * 4);
    var explorerCount = Math.floor(AGENT_COUNT * EXPLORER_RATIO);

    for (var i = 0; i < AGENT_COUNT; i++) {
      var idx = i * 4;
      agentData[idx] = Math.random() * simWidth;
      agentData[idx + 1] = Math.random() * simHeight;
      agentData[idx + 2] = Math.random() * Math.PI * 2;
      agentData[idx + 3] = i < explorerCount ? 1.0 : 0.0;
    }

    agentTexA = createFloatTex(agentTexWidth, agentTexHeight, agentData);
    agentTexB = createFloatTex(agentTexWidth, agentTexHeight, null);
    agentFboA = createFBO(agentTexA);
    agentFboB = createFBO(agentTexB);

    trailTexA = createTrailTex(trailWidth, trailHeight);
    trailTexB = createTrailTex(trailWidth, trailHeight);
    trailFboA = createFBO(trailTexA);
    trailFboB = createFBO(trailTexB);

    currentAgentRead = 'A';
    currentTrailRead = 'A';

    return true;
  }

  function scanFoodSources() {
    foodSources = [];
    var selectors = '.glass, h1, h2, h3, .hero-cta, nav a, .feat-card, .auto-btn, .platform-card, .pkg-card, .release-ver, .tab.active';
    var elements = document.querySelectorAll(selectors);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    elements.forEach(function(el) {
      if (foodSources.length >= MAX_FOOD_SOURCES) return;
      var rect = el.getBoundingClientRect();
      var cx = (rect.left + rect.width / 2) * dpr;
      var cy = (rect.top + rect.height / 2) * dpr;
      var radius = Math.max(rect.width, rect.height) * 0.5 * dpr;
      if (radius < 10) radius = FOOD_RADIUS * dpr * 0.5;
      foodSources.push({ x: cx, y: cy, radius: Math.min(radius, FOOD_RADIUS * dpr), strength: FOOD_STRENGTH });
    });
  }

  function render(time) {
    var dt = Math.min((time - frameTime) / 16.67, 3.0);
    if (dt <= 0 || isNaN(dt)) dt = 1.0;
    frameTime = time;

    var readAgentTex = currentAgentRead === 'A' ? agentTexA : agentTexB;
    var writeAgentFbo = currentAgentRead === 'A' ? agentFboB : agentFboA;
    var readTrailTex = currentTrailRead === 'A' ? trailTexA : trailTexB;
    var writeTrailFbo = currentTrailRead === 'A' ? trailFboB : trailFboA;

    // Pass 1: Update agents
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeAgentFbo);
    gl.viewport(0, 0, agentTexWidth, agentTexHeight);
    gl.useProgram(agentProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readAgentTex);
    gl.uniform1i(gl.getUniformLocation(agentProgram, 'u_agents'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readTrailTex);
    gl.uniform1i(gl.getUniformLocation(agentProgram, 'u_trail'), 1);

    gl.uniform2f(gl.getUniformLocation(agentProgram, 'u_resolution'), simWidth, simHeight);
    gl.uniform1f(gl.getUniformLocation(agentProgram, 'u_time'), time * 0.001);
    gl.uniform1f(gl.getUniformLocation(agentProgram, 'u_dt'), dt);
    gl.uniform1i(gl.getUniformLocation(agentProgram, 'u_agentCount'), AGENT_COUNT);

    foodData.fill(0);
    for (var i = 0; i < foodSources.length && i < MAX_FOOD_SOURCES; i++) {
      foodData[i * 4] = foodSources[i].x;
      foodData[i * 4 + 1] = foodSources[i].y;
      foodData[i * 4 + 2] = foodSources[i].radius;
      foodData[i * 4 + 3] = foodSources[i].strength;
    }
    gl.uniform4fv(gl.getUniformLocation(agentProgram, 'u_foodSources[0]'), foodData);
    gl.uniform1i(gl.getUniformLocation(agentProgram, 'u_foodCount'), Math.min(foodSources.length, MAX_FOOD_SOURCES));

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    gl.uniform2f(gl.getUniformLocation(agentProgram, 'u_mouse'), mouseX * dpr, (canvas.height / dpr - mouseY) * dpr);
    gl.uniform1f(gl.getUniformLocation(agentProgram, 'u_mouseStrength'), mouseX >= 0 ? MOUSE_STRENGTH : 0.0);
    gl.uniform1f(gl.getUniformLocation(agentProgram, 'u_mouseRadius'), MOUSE_RADIUS * dpr);

    gl.bindVertexArray(agentVAO);
    gl.drawArrays(gl.POINTS, 0, AGENT_COUNT);

    currentAgentRead = currentAgentRead === 'A' ? 'B' : 'A';

    // Pass 2: Deposit trails
    gl.bindFramebuffer(gl.FRAMEBUFFER, currentTrailRead === 'A' ? trailFboA : trailFboB);
    gl.viewport(0, 0, trailWidth, trailHeight);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(depositPointProgram);
    var newAgentTex = currentAgentRead === 'A' ? agentTexA : agentTexB;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, newAgentTex);
    gl.uniform1i(gl.getUniformLocation(depositPointProgram, 'u_agents'), 0);
    gl.uniform2f(gl.getUniformLocation(depositPointProgram, 'u_trailRes'), trailWidth, trailHeight);
    gl.uniform2f(gl.getUniformLocation(depositPointProgram, 'u_simRes'), simWidth, simHeight);

    gl.bindVertexArray(agentVAO);
    gl.drawArrays(gl.POINTS, 0, AGENT_COUNT);
    gl.disable(gl.BLEND);

    // Pass 3: Diffuse + Decay
    var readTrailForDiffuse = currentTrailRead === 'A' ? trailTexA : trailTexB;
    var writeTrailForDiffuse = currentTrailRead === 'A' ? trailFboB : trailFboA;

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeTrailForDiffuse);
    gl.viewport(0, 0, trailWidth, trailHeight);
    gl.useProgram(diffuseProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTrailForDiffuse);
    gl.uniform1i(gl.getUniformLocation(diffuseProgram, 'u_trail'), 0);
    gl.uniform2f(gl.getUniformLocation(diffuseProgram, 'u_texelSize'), 1.0 / trailWidth, 1.0 / trailHeight);
    gl.uniform1f(gl.getUniformLocation(diffuseProgram, 'u_decay'), DECAY_RATE * dt);

    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    currentTrailRead = currentTrailRead === 'A' ? 'B' : 'A';

    // Pass 4: Display
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(displayProgram);

    var finalTrailTex = currentTrailRead === 'A' ? trailTexA : trailTexB;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTrailTex);
    gl.uniform1i(gl.getUniformLocation(displayProgram, 'u_trail'), 0);
    gl.uniform2f(gl.getUniformLocation(displayProgram, 'u_mouse'), mouseX * dpr, (canvas.height / dpr - mouseY) * dpr);
    gl.uniform2f(gl.getUniformLocation(displayProgram, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(displayProgram, 'u_mouseRadius'), MOUSE_RADIUS * dpr);

    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animId = requestAnimationFrame(render);
  }

  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  document.addEventListener('mouseleave', function() {
    mouseX = -1000;
    mouseY = -1000;
  });

  var resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      if (animId) cancelAnimationFrame(animId);
      // Clean up all GPU resources before reinitializing
      gl.deleteTexture(agentTexA);
      gl.deleteTexture(agentTexB);
      gl.deleteTexture(trailTexA);
      gl.deleteTexture(trailTexB);
      gl.deleteFramebuffer(agentFboA);
      gl.deleteFramebuffer(agentFboB);
      gl.deleteFramebuffer(trailFboA);
      gl.deleteFramebuffer(trailFboB);
      gl.deleteProgram(agentProgram);
      gl.deleteProgram(depositPointProgram);
      gl.deleteProgram(diffuseProgram);
      gl.deleteProgram(displayProgram);
      gl.deleteBuffer(quadVBO);
      gl.deleteVertexArray(quadVAO);
      gl.deleteVertexArray(agentVAO);
      if (init()) {
        scanFoodSources();
        frameTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    }, 250);
  });

  setInterval(scanFoodSources, 2000);

  if (init()) {
    scanFoodSources();
    frameTime = performance.now();
    animId = requestAnimationFrame(render);
  }

})();
