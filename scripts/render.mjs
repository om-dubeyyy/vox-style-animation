#!/usr/bin/env node
// Render a vox-style-animation page to MP4: headless Chromium seeks the GSAP timeline frame by frame, ffmpeg encodes,
// and every VOX.sfx cue (plus your voice-over and music) is mixed under the picture.
//
//   node scripts/render.mjs examples/apollo/index.html                         → examples/apollo/out.mp4
//   node scripts/render.mjs page.html --out film.mp4 --voice vo.wav --music bed.mp3
//   node scripts/render.mjs page.html --stills 0.5,3,7.2                       → PNGs for checking frames
//   node scripts/render.mjs page.html --from 4 --to 9 --scale 0.5              → a quick half-size draft of 4–9 s
//   node scripts/render.mjs page.html --gif                                    → also a 300-wide preview GIF
//
// Options: --fps N (default: the page's) · --crf 18 · --no-sfx (keeps room tone) · --music-db -22 (relative to its own level)
//          --no-duck (music is sidechain-ducked under the voice by default) · --lufs -14 · --query plain (before/after)
// Needs Node 18+ and ffmpeg 4.4+ on the PATH.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (!args.length || args[0].startsWith("-")) {
  console.error("usage: node scripts/render.mjs page.html [--out out.mp4] [--voice vo.wav] [--music bed.mp3] [--stills 1,2.5] [--from s --to s] [--scale 0.5] [--gif]");
  process.exit(1);
}
const page = path.resolve(args[0]);
const opt = (k, d) => {   // --key value  or  --key=value
  const eq = args.find((a) => a.startsWith(`--${k}=`));
  if (eq) return eq.slice(k.length + 3);
  const i = args.indexOf("--" + k);
  return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true);
};
const out = path.resolve(opt("out", path.join(path.dirname(page), "out.mp4")));
const scale = +opt("scale", 1), crf = +opt("crf", 18), lufs = +opt("lufs", -14);
const stills = opt("stills", null);
if (spawnSync("ffmpeg", ["-version"]).error) {
  console.error("ffmpeg was not found. Install it (https://ffmpeg.org/download.html, or `brew install ffmpeg` / `winget install ffmpeg`) and try again.");
  process.exit(1);
}
if (!fs.existsSync(page)) { console.error("No such page: " + page); process.exit(1); }
const ff = (a, o = {}) => { const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: ["ignore", "inherit", "inherit"], ...o }); if (r.status) throw new Error("ffmpeg failed"); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
const tab = await ctx.newPage();
const errors = [];
tab.on("pageerror", (e) => { errors.push(e.message); console.error("page error:", e.message); });
tab.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
const query = [opt("query", ""), scale !== 1 ? "draft" : ""].filter(Boolean).join("&");   // --query plain → the "template" version
await tab.goto(pathToFileURL(page).href + "?render" + (query ? "&" + query : ""), { waitUntil: "load" });
await tab.waitForFunction(() => window.__vox, null, { timeout: 15000 }).catch(() => {});
const stop = (why) => { console.error(`\nNot rendering: ${why}\nFix the page (open it in the browser preview to see the error), then run this again.`); process.exit(1); };
if (errors.length) stop(errors[0]);
if (!(await tab.evaluate(() => !!window.__vox))) stop("the page never called VOX.init() (check the <script> paths to kit/vox.js and gsap).");
const cfg = await tab.evaluate(() => { const v = window.__vox; return { w: v.width, h: v.height, fps: v.fps, dur: v.duration, cues: v.cues, audio: v.audio, music: v.music, musicGain: v.musicGain, voiceGain: v.voiceGain, base: v.base }; });
await tab.setViewportSize({ width: cfg.w, height: cfg.h });
await tab.evaluate(() => window.__vox.ready());
if (errors.length) stop(errors[0]);
const fps = +opt("fps", cfg.fps);

if (stills) {
  const dir = path.join(path.dirname(out), "stills");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of String(stills).split(",").map(Number)) {
    await tab.evaluate((t) => window.__vox.seek(t), s);
    const f = path.join(dir, `t${s.toFixed(2).replace(".", "_")}.png`);
    await tab.screenshot({ path: f });
    console.log(f);
  }
  await browser.close();
  process.exit(0);
}

const t0 = +opt("from", 0), t1 = Math.min(+opt("to", cfg.dur), cfg.dur);
const N = Math.round((t1 - t0) * fps);
const silent = out.replace(/\.mp4$/, "") + ".video.mp4";
if (scale !== 1) console.log(`  draft at ${scale}× (fringe blur off)`);
// screenshots are full-range BT.601 JPEGs: convert to BT.709 TV range so the colours in the MP4 match the browser
const enc = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "-",
  "-vf", "scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709,format=yuv420p",
  "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", silent], { stdio: ["pipe", "inherit", "inherit"] });
const started = Date.now();
for (let i = 0; i < N; i++) {
  const t = t0 + i / fps;
  await tab.evaluate((x) => window.__vox.seek(x), t);
  const buf = await tab.screenshot({ type: "jpeg", quality: 94 });
  if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once("drain", r));
  if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${N}  ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
enc.stdin.end();
await new Promise((r) => enc.on("close", r));
await browser.close();
console.log(`\r  ${N} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);

// ---------- sound ----------
const pageDir = path.dirname(page);
const kitDir = cfg.base.startsWith("file://") ? fileURLToPath(cfg.base) : path.resolve(pageDir, cfg.base);
const given = (k, fromPage) => {
  const v = opt(k, null), f = v && v !== true ? path.resolve(v) : fromPage ? path.resolve(pageDir, fromPage) : null;
  if (f && !fs.existsSync(f)) console.warn(`  ! --${k} file not found, rendering without it: ${f}`);
  return f && fs.existsSync(f) ? f : null;
};
const voice = given("voice", cfg.audio), music = given("music", cfg.music);
const musicDb = +opt("music-db", cfg.musicGain ?? -22);
const cues = cfg.cues.filter((c) => c.t < t1 && (!args.includes("--no-sfx") || c.name === "room_tone"));
const D = t1 - t0;
const inputs = ["-f", "lavfi", "-t", D.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"], chains = [], mixIn = ["[0:a]"];   // silence = the full length
const files = [...new Set(cues.map((c) => c.src ? path.resolve(pageDir, c.src) : path.join(kitDir, "sfx", c.name + ".wav")))];
files.forEach((f) => { if (!fs.existsSync(f)) console.warn("  missing sound:", f); });
const okFiles = files.filter((f) => fs.existsSync(f));
okFiles.forEach((f) => inputs.push("-i", f));
const IN0 = 1;   // input 0 is the silent bed
const uses = okFiles.map(() => []);
cues.forEach((c) => {
  const f = c.src ? path.resolve(pageDir, c.src) : path.join(kitDir, "sfx", c.name + ".wav"), k = okFiles.indexOf(f);
  if (k >= 0) uses[k].push(c);
});
let n = 0;
uses.forEach((list, k) => {
  if (!list.length) return;
  chains.push(`[${k + IN0}:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=${list.length}${list.map((_, j) => `[s${k}_${j}]`).join("")}`);
  list.forEach((c, j) => {
    const lbl = `c${n++}`, pan = c.pan || 0, l = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2, r = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
    const start = c.t - t0, cut = start < 0 ? `atrim=start=${(-start).toFixed(3)},asetpts=PTS-STARTPTS,` : "";
    const loop = c.loop ? `aloop=loop=-1:size=2e9,` : "", len = c.until != null ? Math.min(c.until, t1) - Math.max(c.t, t0) : D;
    chains.push(`[s${k}_${j}]${loop}${cut}atrim=0:${Math.max(0.01, len).toFixed(3)},volume=${c.gain}dB,pan=stereo|c0=${l.toFixed(3)}*c0|c1=${r.toFixed(3)}*c1,adelay=${Math.max(0, Math.round(start * 1000))}:all=1[${lbl}]`);
    mixIn.push(`[${lbl}]`);
  });
});
let idx = okFiles.length + IN0;
if (voice) {
  inputs.push("-ss", String(t0), "-i", voice);
  chains.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${cfg.voiceGain || 0}dB,asplit=2[vo][vokey]`);
  mixIn.push("[vo]"); idx++;
}
if (music) {
  inputs.push("-ss", String(t0), "-i", music);
  // music under voice: down a lot, a notch where speech lives, and ducked a further few dB while the voice talks
  chains.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${musicDb}dB,equalizer=f=2200:t=q:w=0.8:g=-6,afade=t=out:st=${Math.max(0, D - 1.5).toFixed(2)}:d=1.5[mu0]`);
  if (voice && !args.includes("--no-duck")) {
    chains.push(`[mu0][vokey]sidechaincompress=threshold=0.03:ratio=4:attack=80:release=600:makeup=1[mu]`);
  } else { chains.push(`[mu0]anull[mu]`); if (voice) chains.push(`[vokey]anullsink`); }
  mixIn.push("[mu]"); idx++;
} else if (voice) chains.push(`[vokey]anullsink`);

if (mixIn.length > 1) {
  const mixed = out.replace(/\.mp4$/, "") + ".mix.wav";
  const raw = out.replace(/\.mp4$/, "") + ".raw.wav";
  chains.push(`${mixIn.join("")}amix=inputs=${mixIn.length}:normalize=0:duration=first,atrim=0:${D.toFixed(3)}[out]`);
  ff([...inputs, "-filter_complex", chains.join(";"), "-map", "[out]", "-ar", "48000", "-c:a", "pcm_f32le", raw]);
  // loudness: measure, set the gain, catch peaks with a limiter (−1.5 dBFS), measure again and trim. Two rounds land
  // within a few tenths of the target even when sparse, peaky SFX make a single loudnorm pass fall short.
  const measure = (f) => {
    const m = spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
    return +JSON.parse(m.stderr.slice(m.stderr.lastIndexOf("{"), m.stderr.lastIndexOf("}") + 1)).input_i;
  };
  const mid = out.replace(/\.mp4$/, "") + ".mid.wav";
  const lim = "alimiter=limit=0.84:attack=1:release=60:level=false";
  ff(["-i", raw, "-af", `volume=${(lufs - measure(raw)).toFixed(2)}dB,${lim}`, "-c:a", "pcm_f32le", mid]);
  ff(["-i", mid, "-af", `volume=${(lufs - measure(mid)).toFixed(2)}dB,${lim},aresample=48000`, "-c:a", "pcm_s16le", mixed]);
  fs.unlinkSync(mid);
  fs.unlinkSync(raw);
  ff(["-i", silent, "-i", mixed, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", D.toFixed(3), "-movflags", "+faststart", out]);
  fs.unlinkSync(silent); fs.unlinkSync(mixed);
  console.log(`  sound: ${cues.length} cues${voice ? " + voice" : ""}${music ? " + music" : ""} → ${lufs} LUFS`);
} else fs.renameSync(silent, out);
console.log(out);

if (args.includes("--gif")) {
  const gif = out.replace(/\.[^.\/\\]+$/, "") + ".gif";
  // grain and dust make GIFs huge: denoise first, fewer colours (the MP4 keeps the full texture)
  ff(["-i", out, "-vf", "fps=10,scale=300:-1:flags=lanczos,hqdn3d=6:6:8:8,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle", gif]);
  console.log(gif);
}
