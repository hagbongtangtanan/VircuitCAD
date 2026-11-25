const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ledNewDist = path.join(__dirname, "led-new/dist/renderLedSvg.js");
const globalThis = {};
eval(fs.readFileSync(ledNewDist, "utf8"));
const renderLedSvg = globalThis.LedSvg.renderLedSvg;

const PX_PER_UNIT = 4;
const GLOW_CENTER = { x: 0, y: -68 };
const GLOW_RADIUS = 100;
const CENTER_PX = { x: 480, y: 720 }; // (0,0) design -> pixel

function svgToPx(x, y) {
  return {
    x: Math.round((x - (-120)) * 4),
    y: Math.round((y - (-180)) * 4),
  };
}

async function testGlowAlpha(color, theme, bgColor, bgName) {
  const svg = renderLedSvg({ color, theme, lit: true, burnt: false, showLabels: false });
  
  const outDir = path.join(__dirname, "led-new/out/glow-test");
  fs.mkdirSync(outDir, { recursive: true });
  
  const svgPath = path.join(outDir, `led-${color}-${theme}-lit.svg`);
  fs.writeFileSync(svgPath, svg);
  
  const pngPath = path.join(outDir, `led-${color}-${theme}-lit-${bgName}.png`);
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(960, 880)
    .flatten({ background: bgColor })
    .png()
    .toFile(pngPath);
  
  const { data, info } = await sharp(pngPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  
  const centerPx = { x: 480, y: 480 - 68 * 4 }; // (0, -68) in design units
  // Actually center is (0, -68) in design coords
  // SVG viewBox: -120 -180 240 220
  // So (0, -68) maps to:
  // x: (0 - (-120)) * 4 = 480
  // y: (-68 - (-180)) * 4 = 112 * 4 = 448
  
  const glowCenterPx = { x: 480, y: 448 };
  
  const samples = [];
  for (let r = 0; r <= 100; r += 5) {
    const px = { x: glowCenterPx.x + r * 4, y: glowCenterPx.y };
    if (px.x >= 0 && px.x < 960 && px.y >= 0 && px.y < 880) {
      const idx = (px.y * 960 + px.x) * 4;
      const alpha = data[idx + 3] / 255;
      samples.push({ r, alpha });
    }
  }
  
  return samples;
}

async function runTests() {
  const colors = ["yellow", "red"];
  const themes = ["dark", "light"];
  const backgrounds = { white: "#FFFFFF", dark: "#050A14" };
  
  for (const color of colors) {
    for (const theme of themes) {
      for (const [bgName, bgColor] of Object.entries({ white: "#FFFFFF", dark: "#050A14" })) {
        const svg = renderLedSvg({ color, theme, lit: true, burnt: false, showLabels: false });
        const svgPath = path.join(__dirname, `led-new/out/glow-test/led-${color}-${theme}-lit.svg`);
        fs.mkdirSync(path.dirname(svgPath), { recursive: true });
        fs.writeFileSync(svgPath, svg);
        
        const pngPath = path.join(__dirname, `led-new/out/glow-test/led-${color}-${theme}-lit-${bgName}.png`);
        await sharp(Buffer.from(svg), { density: 384 })
          .resize(960, 880)
          .flatten({ background: bgColor })
          .png()
          .toFile(pngPath);
        
        const { data, info } = await sharp(pngPath).raw().toBuffer({ resolveWithObject: true });
        
        const glowCenterPx = { x: 480, y: 448 };
        const samples = [];
        
        console.log(`\n${color} ${theme} lit on ${bgName}:`);
        console.log("r,alpha");
        
        let prevAlpha = null;
        let maxDrop = 0;
        let alphaIncreased = false;
        let alphaAt100 = null;
        
        for (let r = 0; r <= 100; r += 5) {
          const px = { x: 480 + r * 4, y: 448 };
          if (px.x >= 0 && px.x < 960 && px.y >= 0 && px.y < 880) {
            const idx = (448 * 960 + px.x) * 4;
            const alpha = data[idx + 3] / 255;
            console.log(`${r},${alpha.toFixed(4)}`);
            
            if (prevAlpha !== null) {
              if (alpha > prevAlpha) alphaIncreased = true;
              const drop = prevAlpha - alpha;
              if (drop > maxDrop) maxDrop = drop;
            }
            prevAlpha = alpha;
            
            if (r === 100) alphaAt100 = alpha;
          }
          
          console.log(`  alphaIncreased: ${alphaIncreased}`);
          console.log(`  maxDrop: ${maxDrop.toFixed(4)}`);
          console.log(`  alphaAt100: ${alphaAt100?.toFixed(4)}`);
          
          if (alphaIncreased) console.log(`  FAIL: alpha increases with radius`);
          if (maxDrop > 0.08) console.log(`  FAIL: adjacent-step drop > 0.08 (${maxDrop.toFixed(4)})`);
          if (alphaAt100 !== null && alphaAt100 > 0.02) console.log(`  FAIL: alpha at r=100 > 0.02 (${alphaAt100.toFixed(4)})`);
      }
    }
  }
}

runTests().catch(e => { console.error(e); process.exit(1); });}
