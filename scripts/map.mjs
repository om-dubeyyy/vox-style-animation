#!/usr/bin/env node
// Make a Vox-style map you can animate: Natural Earth countries (public domain, via world-atlas) projected with d3-geo,
// written as a small JS file that the page loads. Countries, routes and points stay separate SVG paths, so the kit can
// fill a country, draw a route on, and drop pins at exact spots.
//
//   node scripts/map.mjs --name apollo --size 1000x1000 --projection orthographic --rotate=-122,22 --res 110m \
//        --highlight "United States of America" \
//        --points "Kennedy Space Center:-80.60,28.57;Splashdown:-169.15,13.32" --route "Kennedy Space Center>Splashdown" \
//        --out examples/apollo/map.js
//
//   then in the page:  <script src="map.js"></script>   const m = VOX.svg(scene, VOX_MAPS.apollo.svg, { x: 0, y: 400 });
//                      VOX_MAPS.apollo.points["Splashdown"] → [x, y] in the map's px;  m.querySelector("#route-0")
//
// Projections: mercator (default) · naturalEarth · equalEarth · orthographic (a globe; --rotate lon,lat spins it)
// --fit "Country A,Country B" zooms to those countries (padding --pad 60). --res 50m (default) or 110m (lighter).
// Borders are Natural Earth's de-facto lines. They are NOT the official borders of every country: India's official map, for
// example, differs in Kashmir and Arunachal Pradesh, and publishing a non-official map of India can be illegal there and gets
// taken down. Check disputed borders yourself before you publish (Vox has pulled videos over map errors).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as d3 from "d3-geo";
import * as topo from "topojson-client";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (k, d) => {   // --key value  or  --key=value (use = for values that start with "-")
  const eq = args.find((a) => a.startsWith(`--${k}=`));
  if (eq) return eq.slice(k.length + 3);
  const i = args.indexOf("--" + k);
  return i < 0 ? d : args[i + 1];
};
const [W, H] = opt("size", "1080x1080").split("x").map(Number);
const name = opt("name", "map"), res = opt("res", "50m"), pad = +opt("pad", 60);
const world = require(`world-atlas/countries-${res}.json`);
const countries = topo.feature(world, world.objects.countries).features;
const land = topo.feature(world, world.objects.land);
const borders = topo.mesh(world, world.objects.countries, (a, b) => a !== b);

const P = { mercator: d3.geoMercator, naturalEarth: d3.geoNaturalEarth1, equalEarth: d3.geoEqualEarth, orthographic: d3.geoOrthographic }[opt("projection", "mercator")];
if (!P) throw new Error("unknown --projection");
const proj = P();
if (opt("rotate")) proj.rotate(opt("rotate").split(",").map((v) => -+v));
const fit = opt("fit");
if (fit) {
  const names = fit.split(",").map((s) => s.trim());
  const fc = { type: "FeatureCollection", features: countries.filter((c) => names.includes(c.properties.name)) };
  const miss = names.filter((n) => !countries.some((c) => c.properties.name === n));
  if (miss.length) {
    const all = countries.map((c) => c.properties.name);
    miss.forEach((m) => {
      const k = m.toLowerCase().slice(0, 3), near = all.filter((a) => a.toLowerCase().includes(k)).slice(0, 5);
      console.error(`--fit: no country named "${m}".${near.length ? " Did you mean: " + near.join(", ") + "?" : ""}`);
    });
    process.exit(1);
  }
  proj.fitExtent([[pad, pad], [W - pad, H - pad]], fc);
} else if (opt("projection") === "orthographic") {
  proj.fitExtent([[pad, pad], [W - pad, H - pad]], { type: "Sphere" });
} else {
  proj.fitExtent([[pad, pad], [W - pad, H - pad]], land);
}
if (opt("center")) proj.center(opt("center").split(",").map(Number));
if (opt("zoom")) proj.scale(proj.scale() * +opt("zoom"));
proj.translate(proj.translate());
if (opt("projection") !== "orthographic") proj.clipExtent([[-40, -40], [W + 40, H + 40]]);   // cut shapes at the frame edge
const pathGen = d3.geoPath(proj);
const r1 = (n) => Math.round(n * 10) / 10;
const clean = (d) => (d || "").replace(/(\d+\.\d)\d+/g, "$1");

const hl = (opt("highlight", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const points = {};
(opt("points", "") || "").split(";").filter(Boolean).forEach((s) => {
  const i = s.lastIndexOf(":"), nm = s.slice(0, i).trim(), [lon, lat] = s.slice(i + 1).split(",").map(Number);
  const p = proj([lon, lat]);
  points[nm] = { xy: [r1(p[0]), r1(p[1])], lonlat: [lon, lat] };
});
const routes = (opt("route", "") || "").split(";").filter(Boolean).map((s) => s.split(">").map((x) => x.trim()));

let svgOut = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="vx-map">`;
if (opt("projection") === "orthographic") svgOut += `<path class="sphere" d="${clean(pathGen({ type: "Sphere" }))}" fill="#D9D0BC" stroke="#1C1A17" stroke-opacity=".25" stroke-width="2"/>`;
svgOut += `<path class="graticule" d="${clean(pathGen(d3.geoGraticule10()))}" fill="none" stroke="#1C1A17" stroke-opacity=".08" stroke-width="1"/>`;
svgOut += `<g class="countries">`;
const onScreen = (f) => { const [[x0, y0], [x1, y1]] = pathGen.bounds(f); return x1 >= -50 && y1 >= -50 && x0 <= W + 50 && y0 <= H + 50; };
for (const c of countries) {
  if (opt("projection") !== "orthographic" && !onScreen(c)) continue;   // skip what can't be seen: smaller files, faster seeking
  const d = clean(pathGen(c));
  if (!d) continue;
  const on = hl.includes(c.properties.name);
  const id = "c-" + c.properties.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  svgOut += `<path id="${id}" class="country${on ? " hl" : ""}" d="${d}" fill="${on ? "#E7B93E" : "#C9C1AE"}"/>`;
}
svgOut += `</g><path class="borders" d="${clean(pathGen(borders))}" fill="none" stroke="#F7F3EA" stroke-width="1.6" stroke-linejoin="round"/>`;
routes.forEach(([a, b], i) => {
  if (!points[a] || !points[b]) throw new Error(`--route: unknown point ${points[a] ? b : a}`);
  const line = { type: "LineString", coordinates: [points[a].lonlat, points[b].lonlat] };   // great circle
  svgOut += `<path id="route-${i}" class="route" d="${clean(pathGen(line))}" fill="none" stroke="#D7261E" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 16"/>`;
});
svgOut += `</svg>`;

const outFile = path.resolve(opt("out", `${name}.map.js`));
const data = { svg: svgOut, width: W, height: H, points: Object.fromEntries(Object.entries(points).map(([k, v]) => [k, v.xy])),
  source: "Natural Earth (public domain) via world-atlas 2.0.2 (ISC)" };
fs.writeFileSync(outFile, `// generated by scripts/map.mjs — ${new Date().toISOString().slice(0, 10)}\nwindow.VOX_MAPS = window.VOX_MAPS || {};\nwindow.VOX_MAPS[${JSON.stringify(name)}] = ${JSON.stringify(data)};\n`);
console.log(`${outFile}  (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB, ${Object.keys(points).length} points, ${routes.length} routes)`);
console.log("Reminder: these are Natural Earth de-facto borders. Check disputed borders (India, Kashmir, Crimea, Western Sahara…) against the official map of the country your audience is in before publishing.");
