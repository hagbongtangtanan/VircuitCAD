import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
const root = "/home/kheil_gwapo/projects/OldVircuitCAD";
const appPath = process.argv[2];
const sample = process.argv[3];
const port = Number(process.argv[4] || 9470);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-old-"));
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
// find the old pot knob circle colour #4a5468
const shot1 = await send("Page.captureScreenshot",{format:"png"});
const buf1 = Buffer.from(shot1.result.data,"base64");
const { data, info } = await sharp(buf1).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const at=(x,y)=>{const i=(y*info.width+x)*info.channels;return [data[i],data[i+1],data[i+2]];};
const hits=[];
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const [r,g,b]=at(x,y); if(Math.abs(r-0x4a)<=6&&Math.abs(g-0x54)<=6&&Math.abs(b-0x68)<=6) hits.push([x,y]); }
// cluster hits: find a dense ~14px group
let minX=1e9,maxX=-1,minY=1e9,maxY=-1,found=0;
for (const [hx,hy] of hits) {
  const near = hits.filter(([x,y])=>Math.abs(x-hx)<=8 && Math.abs(y-hy)<=8);
  if (near.length < 40) continue;
  const xs=near.map(p=>p[0]), ys=near.map(p=>p[1]);
  const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
  if (w>20 || h>20) continue;
  minX=Math.min(...xs); maxX=Math.max(...xs); minY=Math.min(...ys); maxY=Math.max(...ys); found=near.length;
  break;
}
console.log("old knob circle pixels", found, "bbox", minX,maxX,minY,maxY, "centre", (minX+maxX)/2, (minY+maxY)/2);
const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
if (found>10) {
  await send("Input.dispatchMouseEvent",{type:"mousePressed",x:cx,y:cy,button:"left",clickCount:1});
  await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:cx,y:cy,button:"left",clickCount:1});
  await sleep(900);
  const ok = await evaluate(`(() => { const s=document.querySelector('[data-testid="pot-slider"]'); if(!s) return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; setter.call(s,"80"); s.dispatchEvent(new Event("input",{bubbles:true})); return true; })()`);
  console.log("slider set", ok);
  await sleep(900);
  const shot2 = await send("Page.captureScreenshot",{format:"png"});
  fs.writeFileSync("/tmp/opencode/old-after.png", Buffer.from(shot2.result.data,"base64"));
  console.log("saved /tmp/opencode/old-after.png");
}
child.kill("SIGTERM"); await sleep(500);
