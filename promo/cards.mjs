// 片名与结尾卡：用 HTML 排好，再用 Chrome 截成 1920×1080 的图。
// 输出 out/cards/title.png（透明底，叠在开头的全景上）、out/cards/end.png（结尾卡：手机截图 + 网址 + 二维码）
// 结尾卡要用到 out/stills/mobile.png（record.mjs 的 mobile 镜头）。
import { chromium } from 'playwright-core';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
await browser.close();
