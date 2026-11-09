/* vox-style-animation kit — the "Vox explainer" look in HTML + GSAP, rendered frame by frame to MP4.
 *
 *   <link rel="stylesheet" href="../../kit/vox.css">
 *   <script src="../../node_modules/gsap/dist/gsap.min.js"></script>
 *   <script src="../../kit/vox.js"></script>
 *   <script>
 *     const V = VOX.init({ width: 1080, height: 1920, fps: 30, duration: 12 });
 *     const s1 = V.scene(0, 6);
 *     const card = V.card(s1, "photo.jpg", { x: 140, y: 420, w: 800, h: 600, rot: -2 });
 *     V.enter(card, 0.4, "rise");
 *     V.push(card, 0.4, 6, { to: 1.05 });
 *   </script>
 *
 * Rules the kit follows (see references/LOOK_BOOK.md for why):
 *   - Every tween is seek-safe: the renderer jumps to any frame and gets the same picture.
 *   - Anything that should feel hand-made (grain, dust, boil, counters, type-on) runs on a 12 fps grid, not 30/60.
 *   - The lens (grain, dust, vignette, fringe blur, flicker) never moves with the camera.
 *   - Sound lives on the same timeline: helpers drop SFX cues (VOX.sfx) and the renderer mixes them in.
 */
window.VOX = (function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const RENDER = /[?&]render\b/.test(location.search);
  let PLAIN = /[?&]plain\b/.test(location.search);   // ?plain = the "template" version: every pro detail switched off (for before/after)
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, "")) || "kit/";

  let W = 1080, H = 1920, FPS = 30, DUR = 10, tl, stage, camera, world, fx = {}, opts = {};
  const procs = [], cues = [], images = [];
  let uid = 0;

  // ---------- small utilities ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  function hash(n, salt) {                 // deterministic 0..1 for integer n (+ salt)
    let t = (n * 374761393 + (salt || 0) * 668265263) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function el(tag, cls, parent, style) {
    const e = document.createElement(tag || "div");
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const px = (v) => (typeof v === "number" ? v + "px" : v);
  const dataSvg = (s) => `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`;

  // ---------- easing ----------
  function bezier(x1, y1, x2, y2) {       // cubic-bezier() as an ease, same curve as CSS / After Effects
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (p) => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let t = p;
      for (let i = 0; i < 8; i++) { const e = X(t) - p, d = dX(t); if (Math.abs(e) < 1e-7) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      let lo = 0, hi = 1; t = p;
      while (hi - lo > 1e-7) { if (X(t) < p) lo = t; else hi = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  const EASE = {
    settle: "back.out(1.25)",              // small objects landing: a hint of overshoot, never the camera
    land: "power3.out",                    // cards sliding in and stopping on paper
    soft: "sine.inOut",                    // slow pushes, parallax, drifts
    camera: bezier(0.7, 0, 0.3, 1),        // camera moves: ~70% influence both ends (slow-fast-slow)
    cut: bezier(0.82, 0, 0.18, 1),         // cutting the curve: steep middle (AE ~90% influence), the cut hides in it
    snap: "expo.out",
  };
  // hold each pose for 1/fps s ("on twos" at 12 fps): the motion-graphics stutter that reads hand-made
  function stepped(ease, dur, fps) {
    const e = typeof ease === "function" ? ease : gsap.parseEase(ease || "none");
    const n = Math.max(1, Math.round(dur * (fps || 12)));
    return (p) => e(p <= 0 ? 0 : Math.min(1, Math.ceil(p * n - 1e-9) / n));
  }
  // collage motion runs "on twos" (12 fps) unless init({ onTwos: false }) or a helper gets { steps: 0 }
  function ez(ease, dur, o) {
    const st = o && o.steps != null ? o.steps : opts.onTwos ? 12 : 0;
    if (!st) return ease;
    return stepped(ease, dur, st);
  }
  const q = (t, fps) => Math.round(t * (fps || 12)) / (fps || 12);   // snap a start time to the 12 fps grid
  function fastest(ease) {                 // where an ease moves fastest (0..1 of its duration)
    let best = -1, at = 0.5;
    for (let i = 1; i <= 2000; i++) { const v = ease(i / 2000) - ease((i - 1) / 2000); if (v > best) { best = v; at = (i - 0.5) / 2000; } }
    return at;
  }

  // ---------- procedural layer: functions of time, called on every seek ----------
  // Per-element procedural offsets (push, float, drift) go into the separate CSS translate/scale/rotate properties,
  // so they stack with GSAP's transform tweens instead of fighting them, and are exact at any seek time.
  const mods = new Map();
  function mod(e) { let m = mods.get(e); if (!m) { m = { tx: 0, ty: 0, s: 1, r: 0 }; mods.set(e, m); } return m; }
  function proc(fn) { procs.push(fn); return fn; }
  function runProcs(t) {
    mods.forEach((m) => { m.tx = 0; m.ty = 0; m.s = 1; m.r = 0; });
    for (let i = 0; i < procs.length; i++) procs[i](t);
    mods.forEach((m, e) => {
      e.style.translate = m.tx || m.ty ? `${m.tx.toFixed(2)}px ${m.ty.toFixed(2)}px` : "";
      e.style.scale = m.s !== 1 ? m.s.toFixed(5) : "";
      e.style.rotate = m.r ? `${m.r.toFixed(4)}deg` : "";
    });
  }
  // work that needs real layout (measuring words) waits until the fonts have loaded: see ready()
  const later = [];
  const toFn = (e) => (typeof e === "function" ? e : gsap.parseEase(e || "none"));
  // resolve a target: an element, or a selector inside the stage. A miss is an error you can see, not a blank video.
  function $(x, who) {
    const e = typeof x === "string" ? stage.querySelector(x) : x;
    if (!e) throw new Error(`VOX.${who}(): target not found${typeof x === "string" ? ` for "${x}"` : " (got null: check your querySelector)"}`);
    return e;
  }

  // ---------- sound cues ----------
  const VARIANTS = { type_key: 6 };
  function sfx(name, t, o) {
    o = o || {};
    if (t == null || !name) return;
    let file = name;
    if (VARIANTS[name]) file = `${name}_${Math.floor(hash(cues.length, 9) * VARIANTS[name])}`;
    cues.push({ name: file, t: +t.toFixed(4), gain: o.gain == null ? -10 : o.gain, pan: o.pan || 0, src: o.src || null,
      loop: !!o.loop, until: o.until == null ? null : +o.until });   // { loop: true, until: 18 } for beds like projector_loop
  }

  // ---------- generated shapes (marker strokes, torn edges) ----------
  const shapeCache = {};
  function markerShape(color, k) {
    const key = `hl${color}${k}`;
    if (shapeCache[key]) return shapeCache[key];
    const r = rng(41 + k * 13), top = [], bot = [];
    for (let x = 0; x <= 200; x += 8) { top.push([x, 5 + r() * 3 + (x < 10 ? 2 : 0)]); bot.push([x, 35 - r() * 3 - (x > 190 ? 2 : 0)]); }
    const d = "M" + top.map((p) => p.join(",")).join(" L") + " L" + bot.reverse().map((p) => p.join(",")).join(" L") + " Z";
    const streaks = [0, 1, 2].map((i) => `<rect x="${(r() * 30).toFixed(0)}" y="${(11 + i * 8 + r() * 3).toFixed(1)}" width="${(120 + r() * 70).toFixed(0)}" height="1.2" fill="#fff" opacity=".18"/>`).join("");
    const s = `<svg xmlns="${NS}" viewBox="0 0 200 40" preserveAspectRatio="none"><path d="${d}" fill="${color}" fill-opacity=".86"/>${streaks}</svg>`;
    return (shapeCache[key] = dataSvg(s));
  }
  function lineShape(color, k) {
    const key = `ul${color}${k}`;
    if (shapeCache[key]) return shapeCache[key];
    const r = rng(77 + k * 5), pts = [];
    for (let x = 2; x <= 198; x += 14) pts.push(`${x},${(5 + Math.sin(x / 30 + k) * 1.3 + (r() - 0.5) * 1.2).toFixed(1)}`);
    const s = `<svg xmlns="${NS}" viewBox="0 0 200 10" preserveAspectRatio="none"><polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
    return (shapeCache[key] = dataSvg(s));
  }
  // a torn/deckled edge as a CSS polygon: edges = "b" (bottom), "tb", "lrtb"...
  function tornPolygon(edges, seed, amp) {
    const r = rng(seed || 3), a = amp || 1.4, pts = [];
    const j = () => (r() * a).toFixed(2);
    const n = 28;
    for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${edges.includes("t") ? j() : 0}%`);
    for (let i = 1; i <= n; i++) pts.push(`${edges.includes("r") ? (100 - r() * a).toFixed(2) : 100}% ${(i / n * 100).toFixed(2)}%`);
    for (let i = n - 1; i >= 0; i--) pts.push(`${(i / n * 100).toFixed(2)}% ${edges.includes("b") ? (100 - r() * a * 1.6).toFixed(2) : 100}%`);
    for (let i = n - 1; i >= 1; i--) pts.push(`${edges.includes("l") ? j() : 0}% ${(i / n * 100).toFixed(2)}%`);
    return `polygon(${pts.join(",")})`;
  }

  // ---------- SVG filters, once ----------
  function defs() {
    const s = svg("svg", { width: 0, height: 0, style: "position:absolute;width:0;height:0" }, stage);
    const lift = opts.blackLift == null ? 0.11 : opts.blackLift, gain = (1 - lift) / 0.96, sat = opts.saturate == null ? 0.88 : opts.saturate;
    const f = (c) => `<feFunc${c} type="linear" slope="${gain.toFixed(4)}" intercept="${lift.toFixed(4)}"/>`;
    s.innerHTML = `
      <filter id="vx-tint" color-interpolation-filters="sRGB">
        <feColorMatrix type="saturate" values="${sat}"/>
        <feComponentTransfer>${f("R")}${f("G")}${f("B")}</feComponentTransfer>
      </filter>
      <filter id="vx-rough" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/>
        <feDisplacementMap in="SourceGraphic" scale="1.6"/>
      </filter>
      ${[0, 1, 2, 3].map((k) => `
      <filter id="vx-boil-${k}" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${k * 17 + 3}"/>
        <feDisplacementMap in="SourceGraphic" scale="${opts.boil == null ? 5 : opts.boil}" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`).join("")}
`;
  }
  const stickerDone = {};
  function stickerFilter(r, color) {
    const id = `vx-sticker-${r}-${color.replace(/[^a-z0-9]/gi, "")}`;
    if (stickerDone[id]) return id;
    stickerDone[id] = 1;
    const s = svg("svg", { width: 0, height: 0, style: "position:absolute" }, stage);
    s.innerHTML = `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="dilate" radius="${r}" result="grow"/>
      <feGaussianBlur in="grow" stdDeviation="0.6" result="growS"/>
      <feFlood flood-color="${color}"/><feComposite in2="growS" operator="in" result="edge"/>
      <feGaussianBlur in="growS" stdDeviation="${r * 1.6}" result="sh"/>
      <feOffset in="sh" dx="${r * 0.4}" dy="${r * 1.1}" result="sho"/>
      <feFlood flood-color="#1e1405" flood-opacity=".38"/><feComposite in2="sho" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    return id;
  }

  // ---------- init ----------
  function init(o) {
    opts = o = Object.assign({ width: 1080, height: 1920, fps: 30, duration: 10, paper: null, texture: 0.55, crumple: false,
      grain: 0.13, dust: 0.55, vignette: 0.35, fringe: 0, flicker: 0.018, drift: 0, fxFps: 12, roomTone: -42, onTwos: true, window: 0 }, o || {});
    if (o.plain) PLAIN = true;
    if (/[?&]draft\b/.test(location.search)) o.fringe = 0;   // render.mjs --scale ≠ 1: backdrop blur misbehaves at other pixel ratios
    if (PLAIN) Object.assign(o, { paper: "#FFFFFF", texture: 0, crumple: false, grain: 0, dust: 0, vignette: 0, fringe: 0, flicker: 0,
      drift: 0, window: 0, onTwos: false, blackLift: 0, saturate: 1, roomTone: false });
    W = o.width; H = o.height; FPS = o.fps; DUR = o.duration;
    document.body.classList.toggle("vx-render", RENDER);
    stage = el("div", PLAIN ? "vx-plain" : "", document.body);
    stage.id = "vx-stage";
    Object.assign(stage.style, { width: W + "px", height: H + "px" });
    const T = BASE + "textures/";
    stage.style.setProperty("--vx-paper-tex", `url("${T}paper.png")`);
    stage.style.setProperty("--vx-crumple-tex", `url("${T}crumple.png")`);
    stage.style.setProperty("--vx-halftone-tex", `url("${T}halftone.png")`);
    stage.style.setProperty("--vx-hl-shape", markerShape(o.accent || "#FFD43B", 0));
    stage.style.setProperty("--vx-ul-shape", lineShape(o.red || "#D7261E", 0));
    if (o.paper) stage.style.setProperty("--vx-paper", o.paper);
    if (o.accent) stage.style.setProperty("--vx-accent", o.accent);
    defs();

    camera = el("div", "", stage); camera.id = "vx-camera";
    const paper = el("div", "vx-paper" + (o.crumple ? " crumpled" : ""), camera);
    paper.style.setProperty("--vx-paper-amt", o.texture);
    world = camera;

    // the lens: fixed layers above the camera
    if (o.fringe) { fx.fringe = el("div", "vx-fx vx-fringe", stage); fx.fringe.style.setProperty("--vx-fringe", o.fringe + "px"); }
    if (o.vignette) { fx.vig = el("div", "vx-fx vx-vignette", stage); fx.vig.style.setProperty("--vx-vig", o.vignette); }
    if (o.grain) { fx.grain = el("div", "vx-fx vx-grain", stage); fx.grain.style.setProperty("--vx-grain", o.grain); }
    if (o.dust) { fx.dust = el("div", "vx-fx vx-dust", stage); fx.dust.style.setProperty("--vx-dust", o.dust); }
    if (o.window) { fx.window = el("div", "vx-fx vx-window", stage); fx.window.style.setProperty("--vx-window", o.window); }
    if (o.flicker) fx.flicker = el("div", "vx-fx vx-flicker", stage);

    tl = gsap.timeline({ paused: true });
    tl.set({}, {}, DUR);

    // grain, dust and exposure flicker change on the 12 fps grid; camera drifts a pixel or two (nothing is ever dead still)
    const G = [...Array(8)].map((_, i) => `url("${T}grain_${i}.png")`), D = [...Array(12)].map((_, i) => `url("${T}dust_${i}.png")`);
    proc((t) => {
      const k = Math.floor(t * o.fxFps + 1e-6);
      if (fx.grain) { fx.grain.style.backgroundImage = G[k % 8]; fx.grain.style.backgroundPosition = `${Math.floor(hash(k, 1) * 512)}px ${Math.floor(hash(k, 2) * 512)}px`; }
      if (fx.dust) { fx.dust.style.backgroundImage = D[(k * 7) % 12]; fx.dust.style.transform = `scale(${hash(k, 3) > 0.5 ? -1 : 1},${hash(k, 4) > 0.5 ? -1 : 1})`; }
      if (fx.flicker) fx.flicker.style.opacity = (hash(k, 5) * o.flicker).toFixed(4);
      if (o.drift) {   // off by default: the measured references hold the paper dead still while one thing moves
        const a = o.drift, m = mod(camera);
        m.tx += (Math.sin(t * 0.37) * 1.6 + Math.sin(t * 0.91 + 1) * 0.7) * a;
        m.ty += (Math.sin(t * 0.29 + 2) * 1.4 + Math.sin(t * 0.83) * 0.6) * a;
        m.r += Math.sin(t * 0.23 + 0.5) * 0.06 * a;
      }
    });
    if (o.roomTone != null && o.roomTone !== false) cues.push({ name: "room_tone", t: 0, gain: o.roomTone, loop: true, pan: 0 });

    window.__vox = { width: W, height: H, fps: FPS, duration: DUR, cues, audio: o.audio || null, music: o.music || null,
      musicGain: o.musicGain == null ? -22 : o.musicGain, voiceGain: o.voiceGain || 0, base: BASE,
      seek: (t) => { tl.time(t, false); runProcs(t); }, ready };
    if (!RENDER) setTimeout(preview, 0);
    else { stage.style.left = "0px"; stage.style.top = "0px"; }
    return api;
  }

  function ready() {
    const imgs = [...stage.querySelectorAll("img")];
    return Promise.all([document.fonts.ready, ...imgs.map((i) => (i.complete ? (i.decode ? i.decode().catch(() => 0) : 0) : new Promise((r) => { i.onload = i.onerror = r; })))])
      .then(() => { later.splice(0).forEach((f) => f()); tl.time(0); runProcs(0); return true; });
  }

  // ---------- scenes ----------
  function scene(t0, t1, o) {
    o = o || {};
    const s = el("div", "vx-scene", world);
    if (o.paper) {
      const p = el("div", "vx-paper", s);
      p.style.backgroundColor = o.paper;
      p.style.setProperty("--vx-paper-amt", o.texture == null ? opts.texture : o.texture);
    }
    if (o.dark) { s.style.background = o.dark === true ? "#1C1A17" : o.dark; s.style.color = "#F2ECDF"; }
    tl.set(s, { visibility: "visible" }, t0);
    if (t1 != null) tl.set(s, { visibility: "hidden" }, t1);
    s.t0 = t0; s.t1 = t1;
    return s;
  }
  function group(parent, o) {
    o = o || {};
    const g = el("div", "vx-layer", parent);
    if (o.origin) g.style.transformOrigin = o.origin;
    return g;
  }

  // ---------- elements ----------
  function splitWords(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (n.parentNode.classList && n.parentNode.classList.contains("vx-word")) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((p) => {
        if (!p) return;
        if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
        else { const w = el("span", "vx-word"); w.textContent = p; frag.appendChild(w); }
      });
      const prev = n.previousSibling, glue = prev && prev.nodeType === 1 && /^[^\s]/.test(n.textContent) ? frag.firstChild : null;
      n.parentNode.replaceChild(frag, n);
      if (glue && glue.nodeType === 1) {   // "<mark>words</mark>," — keep the comma on the same line as the mark
        const nb = el("span", "vx-nb");
        prev.parentNode.insertBefore(nb, prev);
        nb.appendChild(prev); nb.appendChild(glue);
      }
    });
    return [...root.querySelectorAll(".vx-word")];
  }
  // text(parent, "html with <mark>…</mark>", { x, y, w, size, font: serif|quote|sans|cond|mono|hand, color, align, … })
  function text(parent, html, o) {
    o = o || {};
    const e = el("div", `vx-text vx-${o.font || "serif"}${o.printed ? " vx-printed" : ""}${o.cls ? " " + o.cls : ""}`, parent, {
      left: px(o.x || 0), top: px(o.y || 0), width: o.w ? px(o.w) : "auto", fontSize: px(o.size || 72),
      color: o.color || "", textAlign: o.align || "left", lineHeight: o.lh || "", letterSpacing: o.ls || "",
      fontWeight: o.weight || "", whiteSpace: o.nowrap ? "nowrap" : "" });
    e.innerHTML = html;
    if (o.rot) gsap.set(e, { rotation: o.rot });
    if (o.origin) e.style.transformOrigin = o.origin;
    e.words = splitWords(e);
    return e;
  }
  // card(parent, src, { x, y, w, h, border (0.04 of w), bottom (extra px, polaroid), rot, shadow: card|flat|lifted,
  //                     bw, halftone (0..1), tape: true|["tl","tr"], torn: "tb", caption, focus: "50% 40%", tint })
  function card(parent, src, o) {
    o = Object.assign({ x: 0, y: 0, w: 600, h: 400, border: 0.04, bottom: 0, rot: 0, shadow: "card" }, o || {});
    const b = Math.round(o.w * o.border), bw = o.w + 2 * b, bh = o.h + 2 * b + o.bottom;
    const wrap = el("div", "vx-cardwrap", parent, { position: "absolute", left: px(o.x), top: px(o.y), width: px(bw), height: px(bh) });
    const sheet = el("div", `vx-card ${o.shadow === "card" ? "" : o.shadow}${o.bw ? " bw" : ""}`, wrap, { inset: 0 });
    if (o.paperColor) sheet.style.background = o.paperColor;
    if (o.torn) {   // clip-path would cut a box-shadow, so the shadow moves to a filter on the wrapper
      sheet.style.clipPath = tornPolygon(o.torn, (o.seed || ++uid) * 7, 1.1);
      sheet.style.boxShadow = "none";
      wrap.style.filter = "drop-shadow(0 2px 2px rgba(30,20,5,.32)) drop-shadow(0 16px 20px rgba(30,20,5,.24))";
    }
    const box = el("div", "vx-img", sheet, { left: px(b), top: px(b), width: px(o.w), height: px(o.h) });
    const img = el("img", "", box);
    img.src = src;
    if (o.focus) img.style.objectPosition = o.focus;
    if (o.tint === false) img.style.filter = o.bw ? "grayscale(1)" : "none";
    if (o.halftone) { const h = el("div", "vx-halftone", box); h.style.opacity = o.halftone; }
    if (o.caption) {
      const c = el("div", "vx-caption", sheet, { top: px(b + o.h + Math.max(6, (o.bottom - 46) / 2)), fontSize: px(o.captionSize || 44) });
      c.textContent = o.caption;
    }
    if (o.tape && !PLAIN) {
      const spots = o.tape === true ? ["tl", "tr"] : o.tape;
      spots.forEach((s, i) => {
        const tp = el("div", "vx-tape", wrap);
        tp.style.backgroundImage = `url("${BASE}textures/tape_${(i + (o.seed || 0)) % 3}.png")`;
        const r = rng((o.seed || 5) + i * 31);
        const at = { tl: [-50, -18, -38], tr: [bw - 120, -18, 38], bl: [-50, bh - 30, 38], br: [bw - 120, bh - 30, -38], t: [bw / 2 - 85, -24, -3 + r() * 6] }[s];
        Object.assign(tp.style, { left: px(at[0]), top: px(at[1]) });
        gsap.set(tp, { rotation: at[2] + (r() - 0.5) * 10 });
      });
    }
    gsap.set(wrap, { rotation: PLAIN ? 0 : o.rot, transformOrigin: "50% 50%" });
    wrap.img = img; wrap.photo = box; wrap.sheet = sheet;
    return wrap;
  }
  // cutout(parent, "subject.png" (transparent PNG), { x, y, w, outline: 9, outlineColor, rot })
  function cutout(parent, src, o) {
    o = Object.assign({ x: 0, y: 0, w: 500, outline: 9, outlineColor: "#F7F3EA", rot: 0 }, o || {});
    const wrap = el("div", "vx-cutout", parent, { left: px(o.x), top: px(o.y), width: px(o.w) });
    const img = el("img", "", wrap);
    img.src = src;
    wrap.style.filter = o.outline ? `url(#${stickerFilter(o.outline, o.outlineColor)})` : "";
    gsap.set(wrap, { rotation: PLAIN ? 0 : o.rot });
    wrap.img = img;
    return wrap;
  }
  function label(parent, txt, o) {
    o = Object.assign({ x: 0, y: 0, size: 30, style: "" }, o || {});
    const e = el("div", "vx-label " + o.style, parent, { left: px(o.x), top: px(o.y), fontSize: px(o.size) });
    e.textContent = txt;
    if (o.rot) gsap.set(e, { rotation: o.rot });
    return e;
  }
  function note(parent, html, o) {
    o = Object.assign({ x: 0, y: 0, w: 420, size: 50, rot: -2, torn: "b" }, o || {});
    const wrap = el("div", "", parent, { position: "absolute", left: px(o.x), top: px(o.y), width: px(o.w),
      filter: "drop-shadow(0 2px 2px rgba(30,20,5,.3)) drop-shadow(0 12px 16px rgba(30,20,5,.22))" });
    const n = el("div", "vx-note", wrap, { position: "relative", fontSize: px(o.size), clipPath: tornPolygon(o.torn, o.seed || 11, 2.4), boxShadow: "none" });
    if (o.color) n.style.background = o.color;
    n.innerHTML = html;
    wrap.words = splitWords(n);
    gsap.set(wrap, { rotation: PLAIN ? 0 : o.rot });
    return wrap;
  }
  // doc(parent, { x, y, w, head: ["LEFT", "RIGHT"], html: "<p>…<mark>…</mark></p>", size, rot })
  function doc(parent, o) {
    o = Object.assign({ x: 0, y: 0, w: 860, rot: 0, size: 30 }, o || {});
    const d = el("div", "vx-doc", parent, { left: px(o.x), top: px(o.y), width: px(o.w), fontSize: px(o.size) });
    if (o.font) d.style.fontFamily = o.font;
    if (o.head) { const h = el("div", "vx-doc-head", d); h.innerHTML = o.head.map((s) => `<span>${s}</span>`).join(""); }
    const body = el("div", "vx-doc-body", d);
    body.innerHTML = o.html || "";
    d.words = splitWords(body);
    gsap.set(d, { rotation: PLAIN ? 0 : o.rot });
    return d;
  }
  // inline an SVG (e.g. a map from scripts/map.mjs) so its paths can be styled and animated
  function svgBlock(parent, markup, o) {
    o = Object.assign({ x: 0, y: 0 }, o || {});
    const wrap = el("div", "vx-svg", parent, { position: "absolute", left: px(o.x), top: px(o.y), width: o.w ? px(o.w) : "", height: o.h ? px(o.h) : "" });
    wrap.innerHTML = markup;
    const s = wrap.querySelector("svg");
    if (s && o.w) { s.setAttribute("width", o.w); if (o.h) s.setAttribute("height", o.h); }
    return wrap;
  }

  // ---------- motion ----------
  const ENTER = {
    rise:    { from: { y: 110, rotation: "+=3", autoAlpha: 0 }, dur: 0.75, ease: EASE.land, sfx: "paper_slide", at: 0 },
    drop:    { from: { scale: 1.14, y: -24, rotation: "+=4", autoAlpha: 0 }, dur: 0.42, ease: "power2.in", sfx: "card_drop", at: 0.92 },
    left:    { from: { x: -1.0, rotation: "-=4" }, dur: 0.85, ease: EASE.land, sfx: "paper_slide", at: 0 },
    right:   { from: { x: 1.0, rotation: "+=4" }, dur: 0.85, ease: EASE.land, sfx: "paper_slide", at: 0 },
    pop:     { from: { scale: 0, autoAlpha: 0 }, dur: 0.38, ease: "back.out(2.2)", sfx: "pop", at: 0 },
    stamp:   { from: { scale: 1.7, autoAlpha: 0, rotation: "-=6" }, dur: 0.2, ease: "power4.in", sfx: "stamp", at: 1 },
    fade:    { from: { autoAlpha: 0 }, dur: 0.5, ease: "power1.out" },
    archive: { from: { x: -0.16, autoAlpha: 0, filter: "blur(28px)" }, dur: 0.33, ease: "power2.out", sfx: "shutter", at: 0 },
    wipe:    { clip: true, dur: 0.4, ease: "power2.inOut", sfx: "paper_rustle", at: 0 },
    cut:     { cut: true, dur: 0 },   // just appears, on the frame (badges, captions: the refs hard-pop them)
  };
  // enter(el, t, how, { dur, ease, steps (fps), sfx: name|false, gain })
  function enter(e, t, how, o) {
    o = o || {};
    e = $(e, "enter");
    const k = ENTER[how || "rise"] || ENTER.rise, dur = o.dur != null ? o.dur : k.dur;
    const ease = ez(o.ease || k.ease, dur, o);
    if (k.cut) {
      gsap.set(e, { autoAlpha: 0 });
      tl.set(e, { autoAlpha: 1 }, t);
    } else if (k.clip) {
      gsap.set(e, { clipPath: "inset(0% 100% 0% 0%)" });
      tl.fromTo(e, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: dur, ease, immediateRender: false }, t);
      tl.set(e, { clipPath: "none" }, t + dur);   // a lingering clip would cut off shadows and tape
    } else {
      const restFilter = e.style.filter || "none";
      const from = Object.assign({}, k.from), to = {};
      const cur = gsap.getProperty(e, "rotation") || 0;
      for (const p in from) {
        let v = from[p];
        if (p === "x" && typeof v === "number" && Math.abs(v) <= 1.5) v = v * W;     // fractions of the frame width
        if (typeof v === "string" && /^[+-]=/.test(v)) v = cur + parseFloat(v.replace("=", ""));
        from[p] = v;
        to[p] = p === "rotation" ? cur : p === "autoAlpha" ? 1 : p === "scale" ? (gsap.getProperty(e, "scale") || 1) : p === "filter" ? "blur(0px)" : 0;
      }
      gsap.set(e, from);
      tl.fromTo(e, from, Object.assign(to, { duration: dur, ease, immediateRender: false }), t);
      if ("filter" in from) tl.set(e, { filter: restFilter }, t + dur);   // give back a torn card's drop-shadow
    }
    if (o.sfx !== false && (o.sfx || k.sfx)) sfx(o.sfx || k.sfx, t + dur * (k.at || 0), { gain: o.gain });
    return t + dur;
  }
  function exit(e, t, how, o) {
    o = o || {};
    const dur = o.dur || 0.5;
    const to = { fade: { autoAlpha: 0 }, fall: { y: H * 0.6, rotation: "+=8", ease: "power2.in" }, left: { x: -W, rotation: "-=4" },
      right: { x: W, rotation: "+=4" }, shrink: { scale: 0, autoAlpha: 0, ease: "back.in(2)" } }[how || "fade"];
    tl.to(e, Object.assign({ duration: dur, ease: to.ease || "power2.in" }, to, { ease: to.ease || "power2.in" }), t);
    if (o.sfx) sfx(o.sfx, t, { gain: o.gain });
    return t + dur;
  }
  // words(el, t, { stagger, dur, from, steps, sfx })  — kinetic type, word by word
  function words(e, t, o) {
    o = o || {};
    const list = e.words || splitWords(e), st = o.stagger == null ? 0.07 : o.stagger, dur = o.dur || 0.45;
    const from = o.from || { y: "35%", autoAlpha: 0 };
    const ease = ez(o.ease || "power3.out", dur, o);
    list.forEach((w, i) => {
      gsap.set(w, from);
      const to = { autoAlpha: 1, duration: dur, ease, immediateRender: false };
      for (const p in from) if (p !== "autoAlpha") to[p] = p === "scale" ? 1 : 0;
      tl.fromTo(w, from, to, t + i * st);
      if (o.sfx) sfx(o.sfx, t + i * st, { gain: o.gain == null ? -16 : o.gain });
    });
    return t + (list.length - 1) * st + dur;
  }
  // push(el, t0, t1, { from: 1, to: 1.06, x, y, rotation, origin, ease }) — the slow Ken Burns drift on a held image.
  // It runs on the CSS scale/translate/rotate properties, so it adds to enter()/drop/parallax tweens instead of replacing them.
  function push(e, t0, t1, o) {
    e = $(e, "push");
    o = Object.assign({ from: 1, to: 1.06, x: 0, y: 0, rotation: 0, ease: EASE.soft }, o || {});
    if (o.origin) e.style.transformOrigin = o.origin;
    const E = toFn(ez(o.ease, t1 - t0, o)), D = Math.max(1e-6, t1 - t0);
    proc((t) => {
      const p = E(clamp((t - t0) / D, 0, 1)), m = mod(e);
      m.s *= lerp(o.from, o.to, p); m.tx += o.x * p; m.ty += o.y * p; m.r += o.rotation * p;
    });
    return t1;
  }
  // camera(t, dur, { x, y, scale, rotation, origin, steps, sfx }, ease?) — moves the whole world (the lens layers stay put)
  function cam(t, dur, v, ease) {
    v = Object.assign({}, v);
    const o = { steps: v.steps }, snd = v.sfx;
    delete v.steps; delete v.sfx;
    if (v.origin) { tl.set(camera, { transformOrigin: v.origin }, t); delete v.origin; }
    tl.to(camera, Object.assign({ duration: dur, ease: ez(ease || EASE.camera, dur, o) }, v), t);
    if (snd) sfx(snd, t);
    return t + dur;
  }
  // parallax([{ el, depth }], t0, t1, { dx, dy, zoom }) — depth 0 = far wall, 1 = right at the lens
  function parallax(layers, t0, t1, o) {
    o = Object.assign({ dx: -60, dy: 0, zoom: 0.06 }, o || {});
    layers.forEach((L) => {
      const d = L.depth;
      tl.fromTo(L.el, { x: -o.dx * d / 2, y: -o.dy * d / 2, scale: 1 },
        { x: o.dx * d / 2, y: o.dy * d / 2, scale: 1 + o.zoom * d, duration: t1 - t0, ease: ez(EASE.soft, t1 - t0, o), immediateRender: false }, t0);
    });
    return t1;
  }
  // float(el, t0, t1, { amp, period, rot }) — a cut-out breathing / bobbing (uses CSS translate, so it stacks with tweens)
  function float(e, t0, t1, o) {
    o = Object.assign({ amp: 5, period: 3.2, rot: 0.5, fps: 0 }, o || {});
    const ph = hash(++uid, 8) * 6.28;
    e = $(e, "float");
    proc((t) => {
      if (t < t0 || t > t1) return;
      const tt = o.fps ? Math.floor(t * o.fps) / o.fps : t, m = mod(e);
      m.ty += Math.sin((tt / o.period) * 6.283 + ph) * o.amp;
      m.r += Math.sin((tt / o.period) * 6.283 * 0.7 + ph * 2) * o.rot;
    });
  }
  // boil(el, t0, t1, { fps: 8 }) — hand-drawn wobble: the line re-draws itself a few times a second
  function boil(e, t0, t1, o) {
    o = Object.assign({ fps: 8 }, o || {});
    const base = e.style.filter || "";
    proc((t) => {
      if (t < t0 || (t1 != null && t > t1)) { e.style.filter = base; return; }
      e.style.filter = `${base} url(#vx-boil-${Math.floor(t * o.fps) % 4})`.trim();
    });
  }

  // ---------- annotation ----------
  function targets(x, who) {
    const wordsOf = (e) => { const w = e.classList.contains("vx-word") ? [e] : [...e.querySelectorAll(".vx-word")]; return w.length ? w : splitWords(e); };
    if (typeof x === "string") {
      const found = [...stage.querySelectorAll(x)];
      if (!found.length) throw new Error(`VOX.${who}(): no element matches "${x}"`);
      return found.flatMap(wordsOf);
    }
    if (!x) throw new Error(`VOX.${who}(): target not found (got null: check your querySelector)`);
    if (x instanceof Element) return wordsOf(x);
    return [...x];
  }
  // sweep a per-word effect (--p 0% → 100%) across a phrase, left to right, line after line
  function sweep(list, t, dur, cls, o) {
    const lens = list.map((w) => Math.max(2, w.textContent.length + 1)), total = lens.reduce((a, b) => a + b, 0);
    let acc = 0;
    list.forEach((w, i) => {
      w.classList.add(cls);
      if (o.var) w.style.setProperty(o.var, o.val(i));
      w.style.setProperty("--p", "0%");
      const d = (dur * lens[i]) / total, ease = list.length === 1 ? "power1.inOut" : i === 0 ? "power1.in" : i === list.length - 1 ? "power1.out" : "none";
      tl.fromTo(w, { "--p": "0%" }, { "--p": "100%", duration: d, ease, immediateRender: false }, t + (dur * acc) / total);
      acc += lens[i];
    });
    return t + dur;
  }
  // highlight(target, t, { color, dur }) — the yellow marker, timed to land as the voice says the words
  function highlight(target, t, o) {
    o = o || {};
    const list = targets(target, "highlight"), color = o.color || (o.box ? opts.red || "#D7261E" : opts.accent || "#FFD43B");
    const chars = list.reduce((a, w) => a + w.textContent.length + 1, 0);
    const dur = o.dur || clamp(0.25 + chars * 0.022, 0.35, 1.3);
    list.forEach((w, i) => {   // close the gap between words so the stroke reads as one pass
      w.style.setProperty("--vx-hl-shape", o.box ? `linear-gradient(${color},${color})` : markerShape(color, i % 3));
    });
    if (o.sfx !== false) sfx("highlighter", t, { gain: o.gain == null ? -12 : o.gain });
    if (o.box) {   // solid box, word knocked out in the paper colour (a loud alternative to the marker)
      list.forEach((w) => w.classList.add("vx-hlbox"));
      list.forEach((w) => tl.set(w, { color: o.textColor || "var(--vx-card)" }, t + dur * 0.5));
    }
    const end = sweep(list, t, dur, "vx-hl", {});
    later.push(() => list.forEach((w, i) => {   // after fonts load: bridge the real gap to the next word on the same line
      const nx = list[i + 1];
      if (!nx || nx.offsetParent !== w.offsetParent || Math.abs(nx.offsetTop - w.offsetTop) > 2) return;
      const gap = nx.offsetLeft - (w.offsetLeft + w.offsetWidth);
      if (gap > 0 && gap < w.offsetHeight) w.style.setProperty("--hl-join", `${-(gap + 3)}px`);
    }));
    return end;
  }
  function underline(target, t, o) {
    o = o || {};
    const list = targets(target, "underline");
    if (o.color) list.forEach((w, i) => w.style.setProperty("--vx-ul-shape", lineShape(o.color, i % 3)));
    if (o.sfx !== false) sfx("pen_scribble", t, { gain: -16 });
    return sweep(list, t, o.dur || 0.45, "vx-ul", {});
  }
  function strike(target, t, o) { o = o || {}; if (o.sfx !== false) sfx("pen_scribble", t, { gain: -16 }); return sweep(targets(target, "strike"), t, o.dur || 0.35, "vx-strike", {}); }
  function redact(target, t, o) { o = o || {}; if (o.sfx !== false) sfx("tape_rip", t, { gain: -14 }); return sweep(targets(target, "redact"), t, o.dur || 0.4, "vx-redact", {}); }

  // box of an element in its offsetParent's coordinates (layout box: ignores transforms, so it is stable)
  function box(e) {
    let x = 0, y = 0, n = e;
    const host = e.offsetParent;
    while (n && n !== host) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { host, x, y, w: e.offsetWidth, h: e.offsetHeight };
  }
  function overlaySvg(host) {
    let s = [...host.children].find((c) => c.classList && c.classList.contains("vx-ink"));
    if (!s) {
      s = svg("svg", { class: "vx-ink", width: 10, height: 10, style: "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:5" }, host);
    }
    return s;
  }
  function drawPaths(paths, len, t, dur, until, o) {
    const ease = ez(bezier(0.45, 0, 0.2, 1), dur, o), t0 = q(t);
    paths.forEach((p) => { p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len; });
    proc((tt) => paths.forEach((p) => { p.style.display = tt >= t0 ? "" : "none"; }));   // no round-cap dot before it starts (display, not visibility: a hidden scene must stay hidden)
    paths.forEach((p) => tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease, immediateRender: false }, t0));
    if (o.boil && paths.length > 1) {   // opt-in: boil between the variants at 6 fps while it stays on screen (refs mostly draw on, then hold)
      proc((tt) => {
        const k = tt < t0 + dur ? 0 : Math.floor(tt * 6) % paths.length;
        paths.forEach((p, i) => { p.style.opacity = i === k ? 1 : 0; });
      });
    }
    return t0 + dur;
  }
  function strokePath(d, s, o) {
    return svg("path", { d, fill: "none", stroke: o.color, "stroke-width": o.width, "stroke-linecap": "round", "stroke-linejoin": "round" }, s);
  }
  function catmull(pts) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  // circle(target, t, { color, width, pad, tilt, dur, boil }) — one pen stroke that overshoots its start, then holds
  function circle(target, t, o) {
    o = Object.assign({ color: opts.red || "#D7261E", width: 8, pad: 26, tilt: -3, dur: 0.3, seed: ++uid }, o || {});
    target = $(target, "circle");
    if (o.sfx !== false) sfx("pen_scribble", q(t), { gain: o.gain == null ? -12 : o.gain });
    later.push(() => {   // measured after the fonts load, or the ring lands where the fallback font put the word
    const b = box(target), s = overlaySvg(b.host);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + o.pad * 0.9, ry = b.h / 2 + o.pad, tilt = (o.tilt * Math.PI) / 180;
    const paths = [0, 1, 2].map((k) => {
      const r = rng(o.seed * 7 + k * 101), a0 = -2.3 + (r() - 0.5) * 0.2, sweepA = 2 * Math.PI + 0.45, ph = [r() * 6.28, r() * 6.28], pts = [];
      for (let i = 0; i <= 64; i++) {
        const u = i / 64, a = a0 + sweepA * u, wob = 1 + 0.035 * Math.sin(2 * a + ph[0]) + 0.02 * Math.sin(5 * a + ph[1]) + 0.05 * u;
        const x = Math.cos(a) * rx * wob, y = Math.sin(a) * ry * wob;
        pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
      }
      return strokePath(catmull(pts), s, o);
    });
    const len = Math.max(...paths.map((p) => p.getTotalLength())) + 2;
    drawPaths(paths, len, t, o.dur, null, o);
    });
    return q(t) + o.dur;
  }
  // arrow(host, [x1,y1], [x2,y2], t, { color, width, bend, head, dur }) — a hand-drawn curved arrow in host's px
  function arrow(host, a, b, t, o) {
    o = Object.assign({ color: opts.red || "#D7261E", width: Math.round(W * 0.0095), bend: 0.22, head: 34, dur: 0.25, seed: ++uid }, o || {});
    host = $(host, "arrow");
    const s = overlaySvg(host), paths = [], heads = [];
    for (let k = 0; k < 3; k++) {
      const r = rng(o.seed * 13 + k * 7), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      const nx = -dy / L, ny = dx / L, pts = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16, bow = Math.sin(u * Math.PI) * o.bend * L, j = (r() - 0.5) * 2.2;
        pts.push([a[0] + dx * u + nx * (bow + j), a[1] + dy * u + ny * (bow + j)]);
      }
      paths.push(strokePath(catmull(pts), s, o));
      const e = pts[pts.length - 1], p = pts[pts.length - 3], ang = Math.atan2(e[1] - p[1], e[0] - p[0]), hs = o.head;
      const h1 = [e[0] - Math.cos(ang - 0.5) * hs, e[1] - Math.sin(ang - 0.5) * hs], h2 = [e[0] - Math.cos(ang + 0.5) * hs * 0.9, e[1] - Math.sin(ang + 0.5) * hs * 0.9];
      heads.push(strokePath(`M${h1[0].toFixed(1)},${h1[1].toFixed(1)} L${e[0].toFixed(1)},${e[1].toFixed(1)} L${h2[0].toFixed(1)},${h2[1].toFixed(1)}`, s, o));
    }
    const len = Math.max(...paths.map((p) => p.getTotalLength())) + 2, hl = Math.max(...heads.map((p) => p.getTotalLength())) + 2;
    if (o.sfx !== false) sfx("pen_scribble", q(t), { gain: -14 });
    const end = drawPaths(paths, len, t, o.dur, null, o);
    return drawPaths(heads, hl, end, 0.17, null, o);
  }
  // spotlight(target, t, t1, { dim, pad }) — the rest of the frame dims so the eye goes to one thing
  function spotlight(target, t, t1, o) {
    o = Object.assign({ dim: 0.55, pad: 40, fade: 0.4 }, o || {});
    target = $(target, "spotlight");
    const ov = el("div", "vx-fx", stage, { zIndex: 40, opacity: 0 });
    later.push(() => {   // layout position in frame px (ignores the target's own enter/push transforms)
      let x = 0, y = 0, n = target;
      while (n && n !== stage && stage.contains(n)) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      const cx = x + target.offsetWidth / 2, cy = y + target.offsetHeight / 2, rw = target.offsetWidth / 2 + o.pad, rh = target.offsetHeight / 2 + o.pad;
      ov.style.background = `radial-gradient(ellipse ${rw * 1.25}px ${rh * 1.25}px at ${cx}px ${cy}px, rgba(15,10,4,0) 70%, rgba(15,10,4,${o.dim}) 100%)`;
    });
    tl.fromTo(ov, { opacity: 0 }, { opacity: 1, duration: o.fade, ease: "power1.inOut", immediateRender: false }, t);
    if (t1) tl.to(ov, { opacity: 0, duration: o.fade, ease: "power1.inOut" }, t1);
    return ov;
  }

  // ---------- type and numbers ----------
  // type(el, t, { cps, sfx, cursor }) — characters appear on a typewriter rhythm (slightly uneven, like a person)
  function type(e, t, o) {
    o = Object.assign({ cps: 22, sfx: true, gain: -18 }, o || {});
    e = $(e, "type");
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const chars = [];
    nodes.forEach((n) => {
      const frag = document.createDocumentFragment();
      [...n.textContent].forEach((c) => { const s = el("span", "vx-ch"); s.textContent = c; frag.appendChild(s); chars.push(s); });
      n.parentNode.replaceChild(frag, n);
    });
    const times = [];
    let tt = t;
    chars.forEach((c, i) => {
      times.push(tt);
      if (o.sfx && c.textContent.trim()) sfx("type_key", tt, { gain: o.gain });
      tt += (1 / o.cps) * (0.7 + hash(i, 21) * 0.6) * (c.textContent === " " ? 1.4 : 1);
    });
    proc((now) => { for (let i = 0; i < chars.length; i++) chars[i].style.opacity = now >= times[i] ? 1 : 0; });   // opacity, not visibility: a hidden scene must stay hidden
    return tt;
  }
  // count(el, t, from, to, { dur, fps, format, ease, sfx }) — a number that rolls (on a 15 fps grid so it ticks)
  function count(e, t, from, to, o) {
    o = Object.assign({ dur: 1.2, fps: 15, ease: "power2.out", decimals: 0, prefix: "", suffix: "", sfx: "tick" }, o || {});
    e = $(e, "count");
    const ease = gsap.parseEase(o.ease), fmt = o.format || ((v) => o.prefix + v.toLocaleString("en-US", { minimumFractionDigits: o.decimals, maximumFractionDigits: o.decimals }) + o.suffix);
    e.classList.add("vx-count");
    proc((now) => {
      const p = clamp((Math.floor((now - t) * o.fps) / o.fps) / o.dur, 0, 1);
      const v = lerp(from, to, ease(p));
      e.textContent = fmt(o.decimals ? v : Math.round(v));
    });
    if (o.sfx) for (let k = 0; k < o.dur * 10; k += 1) sfx(o.sfx, t + k / 10, { gain: -20 - k });
    return t + o.dur;
  }
  // bars(parent, [{ value, label, color }], t, { x, y, w, h, gap, max, stagger, valueFmt }) — a hand-made bar chart
  function bars(parent, data, t, o) {
    o = Object.assign({ x: Math.round(W * 0.1), y: Math.round(H * 0.32), w: Math.round(W * 0.8), h: Math.round(H * 0.42), gap: 40, stagger: 0.25, dur: 0.8 }, o || {});
    const g = el("div", "vx-chart", parent, { position: "absolute", left: px(o.x), top: px(o.y), width: px(o.w), height: px(o.h) });
    const max = o.max || Math.max(...data.map((d) => d.value)), bw = (o.w - o.gap * (data.length - 1)) / data.length;
    data.forEach((d, i) => {
      const hh = Math.max(4, (d.value / max) * (o.h - 120));
      const b = el("div", "vx-bar", g, { left: px(i * (bw + o.gap)), width: px(bw), height: px(hh), bottom: "90px", background: d.color || "var(--vx-ink)",
        boxShadow: "0 1px 1px rgba(0,0,0,.25), 0 10px 18px -8px rgba(0,0,0,.3)" });
      const lb = el("div", "vx-text vx-mono", g, { left: px(i * (bw + o.gap)), width: px(bw), bottom: "20px", fontSize: "30px", textAlign: "center", textTransform: "uppercase" });
      lb.textContent = d.label || "";
      const v = el("div", "vx-text vx-sans", g, { left: px(i * (bw + o.gap)), width: px(bw), bottom: px(hh + 110), fontSize: "54px", textAlign: "center" });
      const tt = t + i * o.stagger;
      gsap.set(b, { scaleY: 0 });
      tl.fromTo(b, { scaleY: 0 }, { scaleY: 1, duration: o.dur, ease: ez("power3.out", o.dur, o), immediateRender: false }, tt);
      gsap.set(v, { autoAlpha: 0 });
      tl.fromTo(v, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, tt + o.dur * 0.6);
      count(v, tt, 0, d.value, { dur: o.dur, sfx: false, format: o.valueFmt });
      sfx("pop", tt, { gain: -16 });
    });
    return g;
  }

  // caption(parent, "TEXT", t0, t1, { y: 0.76 }) — the small low caption box: ~62% black, condensed caps, 1–3 words.
  // The references sit at 78–82% of the height; 0.76 keeps a 9:16 caption clear of the Reels/TikTok bottom UI.
  function caption(parent, txt, t0, t1, o) {
    o = Object.assign({ y: H > W ? 0.76 : 0.8, size: Math.round(H * 0.024) }, o || {});
    const c = el("div", "vx-caption-box", parent, { top: px(H * o.y), fontSize: px(o.size) });
    c.textContent = txt;
    gsap.set(c, { xPercent: -50, autoAlpha: 0 });
    tl.set(c, { autoAlpha: 1 }, t0);
    if (t1 != null) tl.set(c, { autoAlpha: 0 }, t1);
    return c;
  }
  // badge(parent, "1", x, y, t, { size, color }) — a numbered red disc that pops exactly on the spoken word
  function badge(parent, n, x, y, t, o) {
    o = Object.assign({ size: 150 }, o || {});
    const b = el("div", "vx-badge", parent, { left: px(x - o.size / 2), top: px(y - o.size / 2), width: px(o.size), height: px(o.size), fontSize: px(o.size * 0.62) });
    if (o.color) b.style.background = o.color;
    b.textContent = n;
    enter(b, t, o.pop ? "pop" : "cut", { sfx: "pop", gain: -12 });   // the refs hard-pop badges; { pop: true } scales in
    return b;
  }

  // ---------- maps ----------
  // route(pathEl, t, dur, { dashed }) — draw a line on (e.g. a flight path in a map from scripts/map.mjs)
  function route(p, t, dur, o) {
    o = o || {};
    p = $(p, "route");
    const len = p.getTotalLength() + 2;
    if (o.dashed) {   // a dashed line can't draw on with its own dasharray, so reveal it through a mask
      const s = p.ownerSVGElement, id = "vx-m" + ++uid;
      let d = s.querySelector("defs") || svg("defs", {}, s);
      const m = svg("mask", { id, maskUnits: "userSpaceOnUse" }, d);
      const mp = svg("path", { d: p.getAttribute("d"), fill: "none", stroke: "#fff", "stroke-width": (parseFloat(getComputedStyle(p).strokeWidth) || 6) * 3, "stroke-linecap": "round" }, m);
      p.setAttribute("mask", `url(#${id})`);
      mp.style.strokeDasharray = `${len} ${len}`; mp.style.strokeDashoffset = len;
      tl.fromTo(mp, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease: o.ease || EASE.camera, immediateRender: false }, t);
    } else {
      p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len;
      tl.fromTo(p, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease: o.ease || EASE.camera, immediateRender: false }, t);
    }
    if (o.sfx !== false) sfx(o.sfx || "whoosh_low", t, { gain: -18 });
    return t + dur;
  }
  // pin(parent, x, y, t, { label, color }) — a dot that drops in and pulses twice
  function pin(parent, x, y, t, o) {
    o = o || {};
    const p = el("div", "vx-pin", parent, { left: px(x), top: px(y) });
    proc((tt) => { p.style.display = tt >= t ? "" : "none"; });   // exact when scrubbing backwards too
    const ring = el("div", "ring", p), dot = el("div", "dot", p);
    if (o.color) { dot.style.background = o.color; ring.style.borderColor = o.color; }
    gsap.set(dot, { scale: 0 });
    tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(2.5)", immediateRender: false }, t);
    [0, 0.7].forEach((d) => tl.fromTo(ring, { scale: 1, opacity: 0.9 }, { scale: 4.2, opacity: 0, duration: 1.1, ease: "power2.out", immediateRender: false }, t + 0.15 + d));
    sfx("map_ping", t, { gain: -16 });
    if (o.label) { p.labelEl = label(p, o.label, Object.assign({ x: 26, y: -60, size: 28 }, o.labelOpts || {})); enter(p.labelEl, t + 0.25, "wipe", { sfx: false, dur: 0.35 }); }
    return p;
  }

  // ---------- transitions ----------
  // curveCut(wrap, a, b, t, { dur, from, to, x, y, origin }) — cut on the fastest frame of ONE eased move.
  // a and b sit inside wrap; b is pre-scaled so it lands on its own framing. Returns the cut time.
  function curveCut(wrap, a, b, t, o) {
    o = Object.assign({ dur: 0.7, from: 1, to: 1.7, x: 0, y: 0, origin: "50% 46%", ease: EASE.cut }, o || {});
    const tc = Math.round((t + fastest(o.ease) * o.dur) * FPS) / FPS;
    gsap.set(wrap, { transformOrigin: o.origin });
    gsap.set(b, { transformOrigin: o.origin, scale: o.from / o.to, x: -o.x / o.to, y: -o.y / o.to, autoAlpha: 0 });
    tl.fromTo(wrap, { scale: o.from, x: 0, y: 0 }, { scale: o.to, x: o.x, y: o.y, duration: o.dur, ease: ez(o.ease, o.dur, o), immediateRender: false }, t);
    tl.set(a, { autoAlpha: 0 }, tc);
    tl.set(b, { autoAlpha: 1 }, tc);
    sfx("whoosh_fast", tc - 0.14, { gain: -10 });
    return tc;
  }
  // whip(a, b, t, { dir, dur }) — whip pan between two scenes with a horizontal motion blur, cut in the blur
  function whip(a, b, t, o) {
    o = Object.assign({ dir: -1, dur: 0.42 }, o || {});
    const tc = t + o.dur / 2, id = "vx-whip-" + ++uid, f = svg("svg", { width: 0, height: 0, style: "position:absolute" }, stage);
    f.innerHTML = `<filter id="${id}" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="0 0"/></filter>`;
    const blur = f.querySelector("feGaussianBlur");
    tl.fromTo(a, { x: 0 }, { x: o.dir * W * 0.45, duration: o.dur / 2, ease: "power3.in", immediateRender: false }, t);
    gsap.set(b, { x: -o.dir * W * 0.45 });
    tl.fromTo(b, { x: -o.dir * W * 0.45 }, { x: 0, duration: o.dur / 2, ease: "power3.out", immediateRender: false }, tc);
    proc((tt) => {   // the blur exists only inside the whip; outside it the scenes are left untouched
      const p = clamp(1 - Math.abs(tt - tc) / (o.dur / 2), 0, 1), on = p > 0;
      blur.setAttribute("stdDeviation", `${(Math.pow(p, 1.5) * 60).toFixed(1)} 0`);
      [a, b].forEach((s) => { if (on) s.style.filter = `url(#${id})`; else if (s.style.filter === `url("#${id}")` || s.style.filter === `url(#${id})`) s.style.filter = ""; });
    });
    sfx("whoosh", t - 0.05, { gain: -9 });
    return tc;
  }
  // paperWipe(t, { dur, dir, color }) — a torn sheet of paper sweeps across; switch scenes at the returned time
  function paperWipe(t, o) {
    o = Object.assign({ dur: 0.9, dir: -1, color: null }, o || {});
    const sheet = el("div", "vx-paper", stage, { inset: "auto", left: 0, top: 0, width: px(W * 1.35), height: px(H), zIndex: 30,
      clipPath: tornPolygon(o.dir < 0 ? "l" : "r", 99, 3.2), filter: "drop-shadow(-6px 0 3px rgba(30,20,5,.25)) drop-shadow(-18px 0 30px rgba(30,20,5,.35))" });
    sheet.style.backgroundColor = o.color || "var(--vx-paper-2)";   // a shade off the paper, so the sheet reads as a sheet
    const off = o.dir < 0 ? W : -W * 1.35, out = o.dir < 0 ? -W * 1.35 : W;
    gsap.set(sheet, { x: off });
    tl.fromTo(sheet, { x: off }, { x: o.dir < 0 ? -W * 0.18 : -W * 0.17, duration: o.dur / 2, ease: "power2.in", immediateRender: false }, t);
    tl.to(sheet, { x: out, duration: o.dur / 2, ease: "power2.out" }, t + o.dur / 2);
    sfx("paper_slide", t, { gain: -8 });
    sfx("whoosh", t + 0.05, { gain: -14 });
    return t + o.dur / 2;
  }
  // flash(t) — a short exposure bump (archival camera flash / emphasis). Use rarely.
  function flash(t, o) {
    o = Object.assign({ amt: 0.5, dur: 0.35 }, o || {});
    const f = el("div", "vx-fx", stage, { background: "#FFF8E8", opacity: 0, zIndex: 45 });
    tl.fromTo(f, { opacity: o.amt }, { opacity: 0, duration: o.dur, ease: "power2.out", immediateRender: false }, t);
    tl.set(f, { opacity: 0 }, 0);
    return t + o.dur;
  }

  // ---------- preview (browser) ----------
  function preview() {
    const bar = el("div", "", document.body); bar.id = "vx-bar";
    bar.innerHTML = `<button id="vx-play">▶︎</button><input id="vx-scrub" type="range" min="0" max="${DUR}" step="${1 / FPS}" value="0"><span id="vx-time">0.00</span><button id="vx-snd" title="sound">♪ off</button>`;
    const btn = bar.querySelector("#vx-play"), scrub = bar.querySelector("#vx-scrub"), tm = bar.querySelector("#vx-time"), snd = bar.querySelector("#vx-snd");
    function fit() {
      const s = Math.min(innerWidth / W, (innerHeight - 44) / H);
      stage.style.transform = `scale(${s})`;
      stage.style.left = (innerWidth - W * s) / 2 + "px"; stage.style.top = (innerHeight - 44 - H * s) / 2 + "px";
    }
    addEventListener("resize", fit); fit();
    let playing = false, t = 0, last = 0, audio = null, sound = false, ac = null;
    const bufs = {}, voice = opts.audio ? new Audio(opts.audio) : null, music = opts.music ? new Audio(opts.music) : null;
    if (music) music.volume = Math.pow(10, (opts.musicGain == null ? -22 : opts.musicGain) / 20);
    const live = [];
    async function loadSounds() {
      ac = ac || new AudioContext();
      const names = [...new Set(cues.map((c) => c.name))];
      await Promise.all(names.map(async (n) => {
        if (bufs[n]) return;
        try { bufs[n] = await ac.decodeAudioData(await (await fetch(`${BASE}sfx/${n}.wav`)).arrayBuffer()); } catch (e) { bufs[n] = null; }
      }));
      if (!Object.values(bufs).some(Boolean)) snd.textContent = "♪ serve over http";
    }
    function startSound() {
      stopSound();
      if (!sound || !ac) return;
      const now = ac.currentTime;
      cues.forEach((c) => {
        const b = bufs[c.name];
        if (!b || (c.t + b.duration < t && !c.loop)) return;
        const src = ac.createBufferSource(), g = ac.createGain(), p = ac.createStereoPanner();
        src.buffer = b; src.loop = !!c.loop; g.gain.value = Math.pow(10, c.gain / 20); p.pan.value = c.pan || 0;
        src.connect(g).connect(p).connect(ac.destination);
        if (c.t >= t) src.start(now + c.t - t); else src.start(now, (t - c.t) % b.duration);
        live.push(src);
      });
      [voice, music].forEach((a) => { if (a) { a.currentTime = t; a.play().catch(() => 0); } });
    }
    function stopSound() { live.splice(0).forEach((s) => { try { s.stop(); } catch (e) { 0; } }); [voice, music].forEach((a) => a && a.pause()); }
    function show(x) { t = clamp(x, 0, DUR); tl.time(t, false); runProcs(t); scrub.value = t; tm.textContent = t.toFixed(2) + " / " + DUR.toFixed(2); }
    function toggle() {
      playing = !playing; btn.textContent = playing ? "❚❚" : "▶︎"; last = performance.now();
      if (playing) { if (t >= DUR - 1e-3) show(0); startSound(); } else stopSound();
    }
    btn.onclick = toggle;
    snd.onclick = async () => { sound = !sound; snd.textContent = sound ? "♪ on" : "♪ off"; if (sound) { await loadSounds(); if (playing) startSound(); } else stopSound(); };
    scrub.oninput = () => { show(+scrub.value); if (playing) startSound(); };
    addEventListener("keydown", (e) => {
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (e.code === "ArrowRight") show(t + (e.shiftKey ? 1 : 1 / FPS));
      if (e.code === "ArrowLeft") show(t - (e.shiftKey ? 1 : 1 / FPS));
    });
    gsap.ticker.add(() => {
      if (!playing) return;
      const n = performance.now(); show(t + (n - last) / 1000); last = n;
      if (t >= DUR) { playing = false; btn.textContent = "▶︎"; stopSound(); }
    });
    const m = location.search.match(/[?&]t=([\d.]+)/);
    ready().then(() => show(m ? +m[1] : 0));
  }

  const api = {
    init, scene, group, text, card, cutout, label, note, doc, svg: svgBlock,
    enter, exit, words, push, camera: cam, parallax, float, boil,
    highlight, underline, strike, redact, circle, arrow, spotlight,
    type, count, bars, caption, badge, route, pin, curveCut, whip, paperWipe, flash,
    sfx, proc, stepped, bezier, q, EASE, rng, hash, el,
    get tl() { return tl; }, get stage() { return stage; }, get cameraEl() { return camera; },
    get W() { return W; }, get H() { return H; }, get fps() { return FPS; },
  };
  return api;
})();
