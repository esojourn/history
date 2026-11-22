// 片名与结尾卡：用 HTML 排好，再用 Chrome 截成 1920×1080 的图。
// 输出 out/cards/title.png（透明底，叠在开头的全景上）、out/cards/end.png（结尾卡：手机截图 + 网址 + 二维码）
// 结尾卡要用到 out/stills/mobile.png（record.mjs 的 mobile 镜头）。
// 竖屏版（1080×1920）另出：title-v.png、bg-v.png（上方标题、中间放画面、下方字幕的底板）、
//   end-v.png（结尾卡，二维码和网址打马赛克：小红书等平台不许引导去外站）、end-v-clear.png（不打码的竖屏结尾卡）
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out', 'cards');
const URL_FULL = 'https://lishi.alz-ai.cn/zh/', URL_SHOW = 'lishi.alz-ai.cn';
fs.mkdirSync(OUT, { recursive: true });

const qr = await QRCode.toDataURL(URL_FULL, { errorCorrectionLevel: 'H', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
fs.writeFileSync(path.join(OUT, 'qr.png'), Buffer.from(qr.split(',')[1], 'base64'));
const mobile = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'out', 'stills', 'mobile.png')).toString('base64');

const css = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;overflow:hidden}
  :root{--paper:#EEF1ED;--card:#F9FBF8;--ink:#1B2A31;--ink-2:#55676C;--zhu:#C4472D;--line:#C8D0CB;
    --kai:"STKaiti","KaiTi","楷体",serif;--hei:"Microsoft YaHei","PingFang SC",sans-serif}
  body{font-family:var(--hei);color:var(--ink)}`;

const title = `<style>${css}
  body{background:transparent;display:flex;align-items:center;justify-content:center}
  .plate{padding:46px 110px 50px;border-radius:22px;background:rgba(249,251,248,.93);box-shadow:0 20px 60px rgba(27,42,49,.28);text-align:center}
  h1{font-family:var(--kai);font-size:168px;font-weight:400;letter-spacing:.14em;line-height:1.1;margin-right:-.14em}
  p{margin-top:18px;font-size:44px;color:var(--ink-2);letter-spacing:.12em}
  i{display:block;width:120px;height:5px;background:var(--zhu);margin:22px auto 0;border-radius:3px}
</style><div class="plate"><h1>历史长河</h1><i></i><p>一张图，看懂各国历史</p></div>`;

const end = `<style>${css}
  body{background:radial-gradient(circle at 30% 40%,#F9FBF8 0,#EEF1ED 55%,#E2E7E2 100%);display:flex;align-items:center;justify-content:center;gap:150px}
  .phone{width:410px;height:860px;border-radius:58px;background:#1B2A31;padding:16px;box-shadow:0 30px 70px rgba(27,42,49,.32)}
  .phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:44px;display:block}
  .info{display:flex;flex-direction:column;align-items:flex-start}
  h1{font-family:var(--kai);font-size:132px;font-weight:400;letter-spacing:.12em;line-height:1.1}
  .tag{margin-top:14px;font-size:40px;color:var(--ink-2);letter-spacing:.08em}
  .row{display:flex;align-items:center;gap:52px;margin-top:62px}
  .qr{width:300px;height:300px;padding:10px;background:#fff;border-radius:18px;box-shadow:0 10px 30px rgba(27,42,49,.18)}
  .qr img{width:100%;height:100%;display:block}
  .url{font-size:58px;font-weight:700;letter-spacing:.02em}
  .url small{display:block;margin-top:16px;font-size:34px;font-weight:400;color:var(--ink-2);letter-spacing:.08em}
  .free{display:inline-block;margin-top:30px;padding:10px 26px;border-radius:40px;background:var(--zhu);color:#fff;font-size:32px;letter-spacing:.1em}
</style>
<div class="phone"><img src="${mobile}"></div>
<div class="info">
  <h1>历史长河</h1>
  <div class="tag">一张图，看懂各国历史</div>
  <div class="row">
    <div class="qr"><img src="${qr}"></div>
    <div class="url">${URL_SHOW}<small>扫码或输入网址，电脑手机都能看</small><span class="free">免费开放</span></div>
  </div>
</div>`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, html, transparent] of [['title', title, true], ['end', end, false]]) {
  await page.setContent(`<!doctype html><meta charset="utf-8">${html}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: transparent });
  console.log('生成', path.relative(ROOT, path.join(OUT, name + '.png')));
}

/* ---------- 竖屏版 1080×1920：上方 0–240 标题，中间 240–1680 放画面，下方 1680–1920 字幕 ---------- */
const cssV = css.replace('width:1920px;height:1080px', 'width:1080px;height:1920px');
const titleV = `<style>${cssV}
  body{background:transparent;display:flex;align-items:center;justify-content:center}
  .plate{padding:44px 70px 48px;border-radius:22px;background:rgba(249,251,248,.94);box-shadow:0 20px 60px rgba(27,42,49,.28);text-align:center}
  h1{font-family:var(--kai);font-size:132px;font-weight:400;letter-spacing:.14em;line-height:1.1;margin-right:-.14em}
  p{margin-top:16px;font-size:40px;color:var(--ink-2);letter-spacing:.1em}
  i{display:block;width:110px;height:5px;background:var(--zhu);margin:20px auto 0;border-radius:3px}
</style><div class="plate"><h1>历史长河</h1><i></i><p>一张图，看懂各国历史</p></div>`;
const bgV = `<style>${cssV}
  body{background:var(--paper)}
  header{height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-bottom:1px solid var(--line)}
  h1{font-family:var(--kai);font-size:92px;font-weight:400;letter-spacing:.16em;line-height:1.1;margin-right:-.16em}
  p{margin-top:10px;font-size:34px;color:var(--ink-2);letter-spacing:.12em}
  footer{position:absolute;left:0;right:0;top:1680px;height:240px;border-top:1px solid var(--line);background:#E2E7E2}
</style><header><h1>历史长河</h1><p>一张图，看懂各国历史</p></header><footer></footer>`;
const endV = `<style>${cssV}
  body{background:radial-gradient(circle at 40% 30%,#F9FBF8 0,#EEF1ED 55%,#E2E7E2 100%);display:flex;flex-direction:column;align-items:center;padding-top:110px}
  .phone{width:430px;height:900px;border-radius:60px;background:#1B2A31;padding:16px;box-shadow:0 30px 70px rgba(27,42,49,.32)}
  .phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:46px;display:block}
  h1{margin-top:64px;font-family:var(--kai);font-size:124px;font-weight:400;letter-spacing:.14em;line-height:1.1;margin-right:-.14em}
  .tag{margin-top:12px;font-size:40px;color:var(--ink-2);letter-spacing:.1em}
  .cta{display:flex;align-items:center;gap:36px;margin-top:56px;padding:22px 30px 22px 22px;border-radius:24px}
  .qr{width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18)}
  .qr img{width:100%;height:100%;display:block}
  .url{font-size:50px;font-weight:700}
  .url small{display:block;margin-top:14px;font-size:30px;font-weight:400;color:var(--ink-2);letter-spacing:.06em}
  .free{margin-top:30px;padding:10px 28px;border-radius:40px;background:var(--zhu);color:#fff;font-size:32px;letter-spacing:.1em}
</style>
<div class="phone"><img src="${mobile}"></div>
<h1>历史长河</h1>
<div class="tag">一张图，看懂各国历史</div>
<div class="cta"><div class="qr"><img src="${qr}"></div><div class="url">${URL_SHOW}<small>扫码或输入网址</small></div></div>
<span class="free">电脑手机都能看 · 免费开放</span>`;
await page.setViewportSize({ width: 1080, height: 1920 });
for (const [name, html, transparent] of [['title-v', titleV, true], ['bg-v', bgV, false], ['end-v-clear', endV, false]]) {
  await page.setContent(`<!doctype html><meta charset="utf-8">${html}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: transparent });
  console.log('生成', path.relative(ROOT, path.join(OUT, name + '.png')));
}
// 马赛克：把二维码和网址那一块缩小 28 倍再放大回去（方块边长约 28 像素），二维码扫不出、网址认不出
const b = await page.locator('.cta').boundingBox(), B = 28;
const w = Math.ceil(b.width / B) * B, h = Math.ceil(b.height / B) * B, x = Math.round(b.x - (w - b.width) / 2), y = Math.round(b.y - (h - b.height) / 2);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'end-v-clear.png'), '-filter_complex',
  `[0]split[a][b];[b]crop=${w}:${h}:${x}:${y},scale=${w / B}:${h / B}:flags=area,scale=${w}:${h}:flags=neighbor[m];[a][m]overlay=${x}:${y}`,
  '-frames:v', '1', '-update', '1', path.join(OUT, 'end-v.png')]);
console.log('生成', path.relative(ROOT, path.join(OUT, 'end-v.png')), `（马赛克区域 ${w}×${h} @ ${x},${y}）`);
await browser.close();
