/**
 * IDSS EGE — first-paint splash screen (static module, no dependencies).
 *
 * Why a static file in /public: the splash must be the first UI the user sees,
 * before the React app hydrates (INSTRUCTION §7A.8). The markup is server-rendered
 * by the root layout (or by public/splash/index.html for the standalone preview);
 * this script only enhances it:
 *   1. an animated WebGL "flow" field in the IDSS palette — an IDSS-native
 *      re-implementation of the principles of the Director's "Untitled blend"
 *      reference (FLOW recipe: stops #E8262C #08ABE6 #035EA1 #FFCB29, scale 56,
 *      distortion 18, swirl 13, speed 30, grain 9);
 *   2. a rotating, non-repeating pool of motivational messages in the user's language;
 *   3. dismissal once the app signals readiness (never blocks longer than needed).
 *
 * Contract with the app:
 *   window.IDSSSplash.ready()          — app is interactive; splash leaves after the minimum time
 *   window.IDSSSplash.setLocale("de")  — live language switch (AMB-11)
 *   window.IDSSSplash.dismiss()        — leave immediately
 * State is exposed as <html data-splash="active|leaving|done"> so CSS drives visibility.
 *
 * Accessibility / performance:
 *   - prefers-reduced-motion: one static frame, no field animation, no crossfades;
 *   - the render loop pauses while the tab is hidden and stops after dismissal;
 *   - the field renders at reduced resolution (it is a soft gradient) and upscales;
 *   - without WebGL the server-rendered CSS gradient remains the background.
 */
(function () {
  "use strict";

  var ROOT_ID = "idss-splash";
  var MESSAGES_ELEMENT_ID = "idss-splash-messages";
  var MESSAGES_URL = "/splash/messages.json";
  var LAST_MESSAGE_STORAGE_KEY = "idss-ege:splash:last-message";

  // Visual recipe (derived from the reference file's FLOW recipe; see DECISION_LOG PDL-007).
  var RECIPE = {
    // Reference stops #E8262C #08ABE6 #035EA1 #FFCB29, ordered for the cyclic palette.
    stops: ["#E8262C", "#035EA1", "#08ABE6", "#FFCB29"],
    // Director 27.09.2026 (PDL-019): yellow, blue and sky prevail; red only in traces.
    // Blue and yellow alternate in the main field; sky and red are layers from their own
    // noise fields, drawn where that field exceeds its threshold (lower = more area).
    // Thresholds measured on rendered frames: sky about a third, red about 2 %.
    skyThreshold: 0.435,
    // Where yellow starts in the blue/yellow cycle (lower = more yellow).
    yellowFrom: 0.12,
    redThreshold: 0.7,
    // Half-width of every colour edge (field units).
    blend: 0.03,
    scale: 56,
    distortion: 18,
    swirl: 13,
    speed: 30,
    startTime: 116.03,
    grain: 9
  };
  var MAX_DEVICE_PIXEL_RATIO = 1.5;
  var RENDER_RESOLUTION_FACTOR = 0.5;
  var GRAIN_TILE_PX = 128;
  var LEAVE_TRANSITION_MS = 650;
  var LEAVE_TRANSITION_REDUCED_MS = 150;
  var MESSAGE_FADE_MS = 420;

  var state = {
    root: null,
    readyRequested: false,
    startedAt: now(),
    leaving: false,
    reducedMotion: false,
    messages: null,
    locale: "bs",
    order: [],
    orderPosition: 0,
    rotateTimer: null,
    gl: null,
    animationFrame: 0,
    running: false
  };

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  function numberAttribute(name, fallback) {
    var value = state.root && Number(state.root.getAttribute(name));
    return value && isFinite(value) ? value : fallback;
  }

  function setPhase(phase) {
    document.documentElement.setAttribute("data-splash", phase);
  }

  // ---------------------------------------------------------------- messages
  function readMessages(callback) {
    var inline = document.getElementById(MESSAGES_ELEMENT_ID);
    if (inline && inline.textContent) {
      try {
        callback(JSON.parse(inline.textContent));
        return;
      } catch {
        /* fall through to fetch */
      }
    }
    if (typeof fetch !== "function") return callback(null);
    fetch(MESSAGES_URL, { cache: "force-cache" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(callback)
      .catch(function () { callback(null); });
  }

  function pool() {
    if (!state.messages) return [];
    return state.messages[state.locale] || state.messages.bs || [];
  }

  function storedLastIndex() {
    try {
      var value = window.localStorage.getItem(LAST_MESSAGE_STORAGE_KEY);
      return value === null ? -1 : Number(value);
    } catch {
      return -1;
    }
  }

  function storeLastIndex(index) {
    try { window.localStorage.setItem(LAST_MESSAGE_STORAGE_KEY, String(index)); } catch { /* private mode */ }
  }

  /** Fisher–Yates shuffle that never starts with `avoid` (no immediate repeat across loads). */
  function shuffledOrder(length, avoid) {
    var order = [];
    for (var i = 0; i < length; i += 1) order.push(i);
    for (var j = length - 1; j > 0; j -= 1) {
      var k = Math.floor(Math.random() * (j + 1));
      var swap = order[j]; order[j] = order[k]; order[k] = swap;
    }
    if (length > 1 && order[0] === avoid) {
      var tmp = order[0]; order[0] = order[1]; order[1] = tmp;
    }
    return order;
  }

  function messageElement() {
    return state.root && state.root.querySelector("[data-splash-message]");
  }

  function showMessage(index, animate) {
    var element = messageElement();
    var messages = pool();
    if (!element || !messages.length) return;
    var text = messages[index % messages.length];
    storeLastIndex(index);
    if (!animate || state.reducedMotion) {
      element.textContent = text;
      element.setAttribute("data-index", String(index));
      return;
    }
    element.classList.add("is-changing");
    window.setTimeout(function () {
      element.textContent = text;
      element.setAttribute("data-index", String(index));
      element.classList.remove("is-changing");
    }, MESSAGE_FADE_MS);
  }

  function startRotation() {
    var messages = pool();
    if (!messages.length) return;
    var element = messageElement();
    var serverIndex = element ? Number(element.getAttribute("data-index")) : NaN;
    var avoid = storedLastIndex();
    state.order = shuffledOrder(messages.length, avoid);
    if (isFinite(serverIndex) && serverIndex >= 0 && serverIndex !== avoid) {
      // Keep the server-rendered first message (no flash of different text).
      state.order.splice(state.order.indexOf(serverIndex), 1);
      state.order.unshift(serverIndex);
      storeLastIndex(serverIndex);
    } else {
      showMessage(state.order[0], false);
    }
    state.orderPosition = 0;
    var interval = numberAttribute("data-rotate-ms", 3200);
    state.rotateTimer = window.setInterval(function () {
      state.orderPosition = (state.orderPosition + 1) % state.order.length;
      if (state.orderPosition === 0) {
        state.order = shuffledOrder(state.order.length, state.order[state.order.length - 1]);
      }
      showMessage(state.order[state.orderPosition], true);
    }, interval);
  }

  // ---------------------------------------------------------------- flow field (WebGL)
  var VERTEX_SHADER = "attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}";
  var FRAGMENT_SHADER = [
    "precision highp float;",
    "uniform vec2 u_res;uniform float u_time;",
    "uniform vec3 u_c0;uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_c3;",
    "uniform float u_scale;uniform float u_distortion;uniform float u_swirl;",
    "uniform float u_blend;uniform float u_sky;uniform float u_red;uniform float u_yellow;",
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);",
    " return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.0;float a=0.5;mat2 r=mat2(0.8,0.6,-0.6,0.8);",
    " for(int i=0;i<4;i++){v+=a*noise(p);p=r*p*2.02+17.0;a*=0.5;}return v;}",
    // Main field alternates blue (u_c1) and yellow (u_c3) with short edges; sky (u_c2) and
    // red (u_c0) are laid on top in main() from their own noise fields, so red never forms
    // a band between the other colours.
    "vec3 palette(float t){float x=fract(t);",
    " vec3 c=mix(u_c1,u_c3,smoothstep(u_yellow-u_blend,u_yellow+u_blend,x));",
    " return mix(c,u_c1,smoothstep(1.0-u_blend,1.0,x));}",
    "void main(){",
    " vec2 uv=gl_FragCoord.xy/u_res;",
    " vec2 p=(uv-0.5)*vec2(u_res.x/u_res.y,1.0)*u_scale;",
    " float t=u_time;",
    " float r=length(p);float ang=u_swirl*0.12*sin(r*1.3-t*0.35);",
    " p=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*p;",
    " vec2 q=vec2(fbm(p+vec2(0.0,t*0.12)),fbm(p+vec2(5.2,1.3)-t*0.10));",
    " vec2 w=vec2(fbm(p+u_distortion*q+vec2(1.7,9.2)+t*0.08),fbm(p+u_distortion*q+vec2(8.3,2.8)-t*0.07));",
    " float f=fbm(p+u_distortion*w);",
    " float v=f*2.4+0.9*w.y+t*0.015;",
    " vec3 col=palette(v);",
    " float sky=fbm(p*0.7+q*1.1+vec2(11.3,4.1)+t*0.05);",
    " col=mix(col,u_c2,smoothstep(u_sky-0.3*u_blend,u_sky+0.3*u_blend,sky));",
    " float traces=fbm(p*0.9+w*1.3+vec2(3.1,7.7)-t*0.04);",
    " col=mix(col,u_c0,smoothstep(u_red,u_red+u_blend,traces));",
    " col+=0.07*smoothstep(0.55,1.0,fbm(p*1.7+w*2.0-t*0.05));",
    " gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  function hexToRgb(hex) {
    var value = parseInt(hex.slice(1), 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initField() {
    var canvas = state.root.querySelector("[data-splash-canvas]");
    if (!canvas) return false;
    var gl = null;
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    } catch {
      gl = null;
    }
    if (!gl) return false;
    var vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return false;
    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    var uniforms = {};
    ["u_res", "u_time", "u_c0", "u_c1", "u_c2", "u_c3", "u_scale", "u_distortion", "u_swirl", "u_blend", "u_sky", "u_red", "u_yellow"].forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    });
    RECIPE.stops.forEach(function (hex, index) {
      var rgb = hexToRgb(hex);
      gl.uniform3f(uniforms["u_c" + index], rgb[0], rgb[1], rgb[2]);
    });
    // Map the reference's 0–100 dials onto shader space.
    gl.uniform1f(uniforms.u_scale, 0.6 + (RECIPE.scale / 100) * 1.2);
    gl.uniform1f(uniforms.u_distortion, 1.0 + (RECIPE.distortion / 100) * 3.0);
    gl.uniform1f(uniforms.u_swirl, RECIPE.swirl / 10);
    gl.uniform1f(uniforms.u_blend, RECIPE.blend);
    gl.uniform1f(uniforms.u_sky, RECIPE.skyThreshold);
    gl.uniform1f(uniforms.u_red, RECIPE.redThreshold);
    gl.uniform1f(uniforms.u_yellow, RECIPE.yellowFrom);

    state.gl = { context: gl, canvas: canvas, uniforms: uniforms };
    resizeField();
    window.addEventListener("resize", resizeField);
    state.root.setAttribute("data-field", "webgl");
    return true;
  }

  function resizeField() {
    if (!state.gl) return;
    var canvas = state.gl.canvas;
    var ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO) * RENDER_RESOLUTION_FACTOR;
    var width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    var height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      state.gl.context.viewport(0, 0, width, height);
    }
    if (!state.running) drawFrame(fieldTime());
  }

  function fieldTime() {
    var elapsedSeconds = state.reducedMotion ? 0 : (now() - state.startedAt) / 1000;
    return RECIPE.startTime + elapsedSeconds * (RECIPE.speed / 100);
  }

  function drawFrame(time) {
    var gl = state.gl.context;
    gl.uniform2f(state.gl.uniforms.u_res, state.gl.canvas.width, state.gl.canvas.height);
    gl.uniform1f(state.gl.uniforms.u_time, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function loop() {
    if (!state.running) return;
    drawFrame(fieldTime());
    state.animationFrame = window.requestAnimationFrame(loop);
  }

  function startLoop() {
    if (!state.gl || state.reducedMotion || state.running || document.hidden) return;
    state.running = true;
    state.animationFrame = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    state.running = false;
    if (state.animationFrame) window.cancelAnimationFrame(state.animationFrame);
    state.animationFrame = 0;
  }

  function releaseField() {
    stopLoop();
    window.removeEventListener("resize", resizeField);
    if (!state.gl) return;
    var extension = state.gl.context.getExtension("WEBGL_lose_context");
    if (extension) extension.loseContext();
    state.gl = null;
  }

  /** Film grain as a tiny generated tile (reference "grain 9"), blended with CSS. */
  function applyGrain() {
    var layer = state.root.querySelector("[data-splash-grain]");
    if (!layer) return;
    try {
      var tile = document.createElement("canvas");
      tile.width = GRAIN_TILE_PX;
      tile.height = GRAIN_TILE_PX;
      var context = tile.getContext("2d");
      var image = context.createImageData(GRAIN_TILE_PX, GRAIN_TILE_PX);
      for (var i = 0; i < image.data.length; i += 4) {
        var shade = Math.floor(Math.random() * 256);
        image.data[i] = shade; image.data[i + 1] = shade; image.data[i + 2] = shade; image.data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      layer.style.backgroundImage = "url(" + tile.toDataURL("image/png") + ")";
      layer.style.opacity = String(Math.min(0.2, RECIPE.grain / 110));
    } catch {
      /* grain is decorative */
    }
  }

  // ---------------------------------------------------------------- lifecycle
  function leave(immediate) {
    if (state.leaving) return;
    state.leaving = true;
    if (state.rotateTimer) window.clearInterval(state.rotateTimer);
    var duration = immediate ? 0 : (state.reducedMotion ? LEAVE_TRANSITION_REDUCED_MS : LEAVE_TRANSITION_MS);
    setPhase("leaving");
    window.setTimeout(function () {
      setPhase("done");
      releaseField();
      if (state.root) state.root.setAttribute("aria-hidden", "true");
    }, duration);
  }

  function maybeLeave() {
    if (!state.root || !state.readyRequested || state.leaving) return;
    var remaining = numberAttribute("data-min-visible-ms", 5800) - (now() - state.startedAt);
    if (remaining <= 0) leave(false);
    else window.setTimeout(function () { leave(false); }, remaining);
  }

  function init() {
    state.root = document.getElementById(ROOT_ID);
    if (!state.root) return;
    var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    state.reducedMotion = !!(motionQuery && motionQuery.matches);
    state.locale = state.root.getAttribute("data-locale") || document.documentElement.lang || "bs";
    setPhase("active");

    applyGrain();
    if (initField()) startLoop();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopLoop(); else startLoop();
    });
    if (motionQuery && motionQuery.addEventListener) {
      motionQuery.addEventListener("change", function (event) {
        state.reducedMotion = event.matches;
        if (state.reducedMotion) { stopLoop(); if (state.gl) drawFrame(fieldTime()); } else startLoop();
      });
    }

    readMessages(function (messages) {
      state.messages = messages;
      if (!state.leaving) startRotation();
    });

    // Fail-safe: never trap the user behind the splash if the app never signals readiness.
    window.setTimeout(function () { leave(false); }, numberAttribute("data-max-visible-ms", 12000));
    maybeLeave();
  }

  window.IDSSSplash = {
    ready: function () { state.readyRequested = true; maybeLeave(); },
    dismiss: function () { leave(true); },
    setLocale: function (locale) {
      state.locale = locale;
      if (state.root) state.root.setAttribute("data-locale", locale);
      var element = messageElement();
      if (element && state.messages) showMessage(Number(element.getAttribute("data-index")) || 0, false);
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
