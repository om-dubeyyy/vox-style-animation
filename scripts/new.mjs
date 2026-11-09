#!/usr/bin/env node
// Start a new video from the starter template, with every path already pointing at this kit.
//
//   npm run new -- moon-landing                  → videos/moon-landing/index.html (+ assets/, SOURCES.md)
//   node scripts/new.mjs moon-landing --dir ~/Desktop/videos   → somewhere else (paths are rewritten to reach the kit)
//   node scripts/new.mjs moon-landing --landscape              → 1920×1080 instead of 1080×1920
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
if (!name || !/^[\w.-]+$/.test(name)) { console.error("usage: npm run new -- <name>   (letters, numbers, - and _ only)"); process.exit(1); }
const di = args.indexOf("--dir");
const base = di >= 0 ? path.resolve(args[di + 1].replace(/^~(?=$|\/)/, process.env.HOME || "~")) : path.join(ROOT, "videos");
const dir = path.join(base, name);
if (fs.existsSync(dir)) { console.error(`${dir} already exists`); process.exit(1); }
fs.mkdirSync(path.join(dir, "assets"), { recursive: true });

const rel = (p) => path.relative(dir, path.join(ROOT, p)).split(path.sep).join("/");
let html = fs.readFileSync(path.join(ROOT, "templates/starter/index.html"), "utf8")
  .replaceAll("../../kit/", rel("kit") + "/")
  .replaceAll("../../node_modules/", rel("node_modules") + "/")
  .replace(/<!-- Don't copy this by hand[^>]*-->\n/, "")
  .replace("<title>Starter · vox-style-animation</title>", `<title>${name}</title>`);
if (args.includes("--landscape")) html = html.replace("width: 1080, height: 1920", "width: 1920, height: 1080");
fs.writeFileSync(path.join(dir, "index.html"), html);
fs.writeFileSync(path.join(dir, "SOURCES.md"), `# ${name}: sources\n\n| File / claim | Source URL | Licence | Credit line |\n|---|---|---|---|\n`);

const page = path.relative(process.cwd(), path.join(dir, "index.html")) || "index.html";
const render = path.relative(process.cwd(), path.join(ROOT, "scripts/render.mjs"));
console.log(`Created ${dir}
  edit:    ${page}
  photos:  ${path.join(dir, "assets")}   (log every licence in SOURCES.md)
  preview: npm run preview   →   http://localhost:8080/${path.relative(ROOT, dir).split(path.sep).join("/")}/   (inside the kit folder only)
  stills:  node ${render} ${page} --stills 1,3,5
  render:  node ${render} ${page} --gif`);
