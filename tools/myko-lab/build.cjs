#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "exports/myko-rig");
const SOURCES = [
  path.join(ROOT, "src/characters/myko.js"),
  path.join(__dirname, "test-scene.js"),
  path.join(__dirname, "lab.js"),
];
const names = [
  "neutral",
  "curious",
  "happy",
  "concerned",
  "surprised",
  "sleepy",
  "focused",
  "sad",
];
function build() {
  for (const source of SOURCES)
    if (!fs.existsSync(source)) throw new Error(`Missing source: ${source}`);
  const scripts = SOURCES.map(
    (source) =>
      `<script>\n${fs.readFileSync(source, "utf8").replace(/<\/script/gi, "<\\/script")}\n</script>`,
  ).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Myko · Character workshop</title>
<style>
*{box-sizing:border-box}body{margin:0;color:#3b4034;background:#e9e1d0;font-family:ui-sans-serif,system-ui,sans-serif}button,input,select{font:inherit}button,select{border:1px solid #beb6a4;border-radius:7px;background:#f8f2e4;color:inherit}button{cursor:pointer;padding:.7rem 1rem}button:hover,button[aria-pressed=true]{background:#59664a;color:#fff;border-color:#59664a}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b67b40;outline-offset:3px}header{padding:32px 5vw 21px;border-bottom:1px solid #c9c1ae;display:flex;justify-content:space-between;align-items:end;gap:20px}h1{font:500 38px Georgia,serif;margin:0}header p{max-width:48ch;margin:10px 0 0;color:#777060;font-size:14px;line-height:1.5}.eyebrow{text-transform:uppercase;font:11px ui-monospace,monospace;letter-spacing:.16em;margin-bottom:10px}main{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:28px;padding:26px 5vw 40px;max-width:1800px;margin:auto}.viewer{min-width:0}.canvas-wrap{border:1px solid #c9bda3;border-radius:14px;overflow:hidden;background:#f4ecd9;box-shadow:0 15px 35px #463b2212}canvas{display:block;width:100%;height:auto}.view-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}.view-tabs button{font-size:12px;padding:9px 12px}.transport{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:15px}.transport button{font-size:13px}.scrubber{flex:1;min-width:150px}input[type=range]{accent-color:#74835b;width:100%}.status{font:11px ui-monospace,monospace;color:#777060;margin:11px 0 0;min-height:20px}aside{padding-top:0}aside h2{font:25px Georgia,serif;margin:0 0 18px}form>label{display:grid;gap:6px;margin-bottom:15px;font-size:13px}select{width:100%;padding:10px}.check{display:flex!important;align-items:center;gap:9px!important}.check input{accent-color:#74835b;width:16px;height:16px}details{margin-top:24px;border-top:1px solid #c9c1ae;padding-top:16px}summary{cursor:pointer;font-size:14px}#joint-controls{margin-top:15px;display:grid;gap:12px}#joint-controls label{display:grid;grid-template-columns:1fr 38px;gap:6px;font-size:11px}#joint-controls label span{grid-column:1/-1}#joint-controls output{font:11px ui-monospace,monospace;text-align:right;align-self:center}aside .hint{font-size:12px;line-height:1.6;color:#79705f;border-top:1px solid #c9c1ae;padding-top:16px;margin-top:20px}.sheet-mode main{grid-template-columns:minmax(0,1fr)}.sheet-mode aside,.sheet-mode .transport{display:none}.sheet-mode header{padding-top:22px}.sheet-mode .status{display:none}@media(max-width:760px){header{padding:24px 20px;display:block}header>button{margin-top:20px}main{padding:20px;grid-template-columns:1fr}aside{padding-top:20px}.view-tabs{gap:5px}.view-tabs button{padding:8px;font-size:11px}h1{font-size:33px}}
</style></head><body>
<header><div><div class="eyebrow">Procedural character development</div><h1>Myko, built by hand.</h1><p>A reusable Canvas character, with held poses, articulated joints and eight expressions.</p></div><button id="download" type="button">Save this sheet</button></header>
<main><section class="viewer" aria-label="Character preview"><nav class="view-tabs" aria-label="Character sheets">${[
    ["hero", "Character"],
    ["views", "Turnaround"],
    ["poses", "Poses"],
    ["expressions", "Expressions"],
    ["scales", "Scale studies"],
  ]
    .map(
      ([id, title]) =>
        `<button type="button" data-sheet="${id}" aria-pressed="${id === "hero"}">${title}</button>`,
    )
    .join(
      "",
    )}</nav><div class="canvas-wrap"><canvas id="myko-canvas" width="1200" height="940" aria-label="Procedurally drawn Myko character"></canvas></div><div class="transport"><button id="play" type="button" aria-pressed="false">Play pose</button><button id="step" type="button">Step pose</button><label class="scrubber"><span class="eyebrow">Scrub four seconds</span><input id="time" aria-label="Animation time" type="range" min="0" max="3.999" step="0.0416666667" value="0"></label></div><p class="status" id="frame-status" aria-live="off"></p></section>
<aside><h2>The character rig</h2><form id="rig-controls"><label>View<select name="facing"><option value="front">Front-ish</option><option value="left" selected>Three-quarter left</option><option value="right">Three-quarter right</option><option value="side-left">Left profile</option><option value="side-right">Right profile</option></select></label><label>Pose<select name="pose">${["neutral", "walking", "reaching", "crouching"].map((s) => `<option>${s}</option>`).join("")}</select></label><label>Expression<select name="eyeExpression">${names.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Held poses per second<select name="fps"><option value="8">8 drawings / second</option><option value="12" selected>12 drawings / second</option></select></label><label class="check"><input type="checkbox" name="debug">Show joint hierarchy</label><label class="check"><input type="checkbox" name="imperfections">Handmade registration</label><button type="button" id="reset-pose">Reset the pose</button><details><summary>Adjust individual joints</summary><div id="joint-controls"></div></details></form><p class="hint">Each frame comes from the same procedural drawing. The sheets test identity across views, expressions, poses and scale.</p></aside></main>
${scripts}
</body></html>`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, ".gitignore"), "*\n!.gitignore\n");
  const output = path.join(OUT, "myko-character-lab.html");
  fs.writeFileSync(output, html);
  return output;
}
if (require.main === module) console.log(build());
module.exports = { build, ROOT, OUT, SOURCES };
