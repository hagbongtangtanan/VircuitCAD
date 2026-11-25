import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
const root = "/home/kheil_gwapo/projects/OldVircuitCAD";
const appPath = process.argv[2];
const sample = process.argv[3];
const port = Number(process.argv[4] || 9485);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-zoom-"));
const child = spawn(path.join(root, "node_modules/electron/dist/electron"), [appPath, sample, `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-sandbox"], { stdio: "ignore" });
async function findPage() { for (let i=0;i<100;i++){ try { const pages=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json()); const p=pages.find(e=>e.type==="page"); if(p) return p; } catch{} await sleep(200);} throw new Error("no page"); }
const page = await findPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id=0; const pending=new Map();
ws.onmessage=(e)=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
await new Promise(r=>ws.onopen=r);
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const evaluate=async(expression)=>(await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true})).result?.result?.value;
await sleep(3000);
await evaluate(`(() => { const b=[...document.querySelectorAll("button")].find(e=>e.innerText.includes("already know")); if(b) b.click(); return 1; })()`);
await sleep(1500);
const shot = async (name) => {
  const s = await send("Page.captureScreenshot",{format:"png"});
  const buf = Buffer.from(s.result.data,"base64");
  fs.writeFileSync(`/tmp/opencode/${name}.png`, buf);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let blue=0, nonbg=0;
  for(let y=100;y<320;y++)for(let x=480;x<700;x++){const i=(y*info.width+x)*info.channels;const [r,g,b]=[data[i],data[i+1],data[i+2]];
    if(r>=60&&r<=145&&g>=110&&g<=190&&b>=185&&b<=240&&b-g>=45&&g-r>=25) blue++;}
  console.log(name, "blue", blue);
};
await shot("zoom-before");
await evaluate(`(() => { const b=[...document.querySelectorAll("button")].find(e=>e.title==="Zoom in"); if(b){b.click(); return true;} return false; })()`);
await sleep(1200);
await shot("zoom-after");
console.log("zoom label", await evaluate(`(() => { const el=[...document.querySelectorAll("*")].find(e=>e.children.length===0 && /%$/.test((e.textContent||"").trim()) && /\\d/.test(e.textContent)); return el?el.textContent.trim():null; })()`));
child.kill("SIGTERM"); await sleep(500);
