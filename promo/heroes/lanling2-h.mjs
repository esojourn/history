// 《峡谷之外》兰陵王第二篇·横版（1920×1080）：内容、旁白、配音、史书原文文字卡与竖版（lanling2.mjs）相同，网站画面换成桌面版。
// 用法：node promo/heroes/lanling2-h.mjs [--still] [--music <音乐文件>]
//   先做两件事：仓库根目录 npm run build；配音沿用竖版的（promo/out/heroes/lanling2/voice/，见 lanling2.yaml 开头）。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/lanling2/h/stills/，同时画出第一屏、文字卡、结尾卡，用来检查位置。
// 成片：promo/out/heroes/lanling2/lanling2-h.mp4（不进仓库）；中间文件都在 promo/out/heroes/lanling2/h/，不碰竖版的文件。
// 视频文件先在系统临时目录里生成，最后复制过来并整段解码检查（E 盘直接写会偶尔写坏，见 episode.mjs 的 checkVideo）。
// 做法同韩信横版（hanxin-h.mjs）：桌面版网站、假鼠标、一镜到底，每段的长短跟着旁白走；游戏图片、文字卡、结尾卡是合成时盖上去的。
// 文字卡盖在左边的时间轴上，右边的人物卡照常露出。旁白、原文都是定稿，这里只对照检查，不改。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openDesktop, DW as W, DH as H,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const SRC = path.join(PROMO, 'out', 'heroes', 'lanling2');
const OUT = path.join(SRC, 'h');
const VOICE = path.join(SRC, 'voice');   // 竖版做好的配音，直接复用
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '153-bigskin-1.jpg');   // 官方图片（默认造型，横版 1920×882），不进仓库
const FINAL = path.join(SRC, 'lanling2-h.mp4');
const WORK = path.join(os.tmpdir(), 'xiagu-lanling2-h');
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/gao-changgong', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片），同竖版
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、片尾小字、文字卡原文：对照定稿（同竖版） ---------- */
const SHOTS = loadNarration(path.join(HERE, 'lanling2.yaml'), '## 四、', 13, '不配地图');
const SEC = (() => { const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8'); return md.slice(md.indexOf('## 四、')); })();
const [TITLE_ROW, SOURCES] = SEC.slice(0, SEC.indexOf('不配地图')).split('\n').filter(l => l.startsWith('|') && l.includes('不念')).map(l => l.split('|')[2].trim());
if (TITLE_ROW !== '峡谷之外的真实历史 / 历史中的阳光大男孩 / 兰陵王') { console.error('scripts.md 第四篇的第一屏文字变了，先改本脚本的第一屏'); process.exit(1); }
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 lanling2.yaml 要重新配音'); process.exit(1); }

// 文字卡：同竖版（lanling2.mjs）。【】里的字用红色突出；去掉【】后必须是核实记录“原文”一栏里的原话
const QUOTES = [
  { on: ['n03', '得了好吃的'], text: '每得甘美，【虽一瓜数果，必与将士共之】' },
  { on: ['n04'], text: '尝入朝而【仆从尽散】，唯有一人，长恭独还，【无所谴罚】' },
  { on: ['n05', '史书说他'], text: '历司州牧、青瀛二州，【颇受财货】' },
  { on: ['n05', '部下尉相愿'], text: '其属尉相愿谓曰：“王既受朝寄，【何得如此贪残？】”' },
  { on: ['n06'], text: '初在瀛州，行参军阳士深【表列其赃，免官】' },
  { on: ['n07'], text: '及讨定阳，士深在军，【恐祸及】' },
  { on: ['n08'], text: '长恭闻之曰：“【吾本无此意。】”乃求小失，【杖士深二十】以安之' },
  { on: ['n09'], text: '长恭闻之曰：“吾本无此意。”乃求小失，杖士深二十【以安之】', off: 'n10' },
  { on: ['n11'], text: '与段韶讨栢谷，又攻定阳。【韶病，长恭总其众】', off: 'n12' },
  { on: ['n12', '部下问他'], text: '相愿曰：“岂不由芒山大捷，恐以威武见忌，【欲自秽乎？】”长恭曰：“【然。】”', off: 'n13' },
];
{
  const rec = SEC.slice(SEC.indexOf('### 核实记录')).replace(/[‘’]/g, m => (m === '‘' ? '“' : '”'));
  for (const q of QUOTES) { const plain = q.text.replace(/[【】]/g, ''); if (!rec.includes(plain)) { console.error('文字卡上的原文在核实记录里找不到：' + plain); process.exit(1); } }
  console.log(`文字卡 ${QUOTES.length} 张，原文都与核实记录一致`);
}

/* ---------- 打开网站（桌面版） ---------- */
const { server, base: BASE } = await serveDist();
const dk = await openDesktop();
const { browser, page, cdp, cursor, glide, clickSel, wheel, bar, scrollCard, pointAt, expectSel, type } = dk;

// 结尾卡里的电脑画面：兰陵王的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/gao-changgong', { waitUntil: 'networkidle' });
await page.waitForSelector('#river [data-p="gao-changgong"]', { timeout: 15000 });
await sleep(1500);
await cursor(false);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#river g', { timeout: 15000 });
await sleep(1500);
await cursor(false);

const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, until, snap } = tl;

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 搜索“兰陵王”，点第一条：时间轴飞到南北朝，右边出人物卡
  await mark('n02');
  await cursor(true); await sleep(200);
  await clickSel('#find', null, 600); await sleep(300);
  await type('兰陵王', 200);
  await sleep(350); await snap('02a-search');
  await clickSel('.search .s-row[data-id="gao-changgong"]', 110, 450); await sleep(1100);
  await expectSel('person/gao-changgong');
  await dk.measure();
  await snap('02-focus');

  // 3–4. 好的一面：人物卡停在开头（文字卡盖在左边），鼠标指着名字
  await mark('n03');
  await sleep(300); await pointAt('高长恭，一名孝瓘', 1000); await snap('03-card');
  await mark('n04'); await snap('04-card');

  // 5–9. 不好的一面：卡片滚到“有意收受财物以自污……部下尉相愿”
  await mark('n05');
  await sleep(200); await scrollCard('后主曾对他说', 1400, 60); await pointAt('有意收受财物以自污', 900); await snap('05-ziwu');
  await until(fracBefore(SHOT.n05.say, '部下尉相愿')); await pointAt('部下尉相愿', 800); await snap('05b-weixiangyuan');
  await mark('n06'); await snap('06');
  await mark('n07'); await snap('07');
  await mark('n08'); await snap('08');
  await mark('n09'); await snap('09');

  // 10–11. 后人的理解、段韶（网站上没有段韶）：时间轴露出来，鼠标移到他的生卒条上，滚轮放大
  await mark('n10');
  await sleep(300);
  { const b = await bar('gao-changgong'); await glide((b.x1 + b.x2) / 2, b.y, 1200); await sleep(1500); await wheel(-260, 2200); }
  await snap('10-graph');
  await mark('n11'); await snap('11');

  // 12. 邙山大功之后：卡片滚到河清三年（邙山）那一段，念到“部下问他”时回到自污那一句
  await mark('n12');
  await sleep(200); await scrollCard('河清三年', 1300, 60); await pointAt('率五百骑兵冲入周军阵中', 900); await snap('12a-mangshan');
  await until(fracBefore(SHOT.n12.say, '部下问他') - 0.06);
  await scrollCard('后主曾对他说', 1200, 60); await pointAt('有意收受财物以自污', 800); await snap('12-zihui');

  // 13. 结尾卡（合成时盖在上面）
  await mark('n13');
  await mark(null);
}

/* ---------- 录像 ---------- */
const frames = STILL ? null : await startScreencast(cdp, W, H);
tl.t0 = Date.now();
try { await act(); } catch (e) { console.error('录制中断：', e.message); await page.screenshot({ path: path.join(OUT, 'stills', 'error.png') }); await browser.close(); server.close(); process.exit(1); }
const TOTAL = (Date.now() - tl.t0) / 1000;
if (!STILL) await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks, at = tl.at;

/* ---------- 各张底图：用浏览器画（1920×1080） ---------- */
// 官方横版图 1920×882，放大到 1080 高（2351 宽），左边留出 IMGL 像素（压暗的底色）：人物的脸在大标题右边，不被字压住
// （样张 title-h.png 图片靠右放，大标题正好压在脸上，这里往右挪了）
const IMGW = Math.round(1920 * H / 882), IMGL = 100, DX = dk.detailX;
const KAI = "'STKaiti','KaiTi',serif";
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const SHADE = `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.94) 0,rgba(13,18,22,.78) 34%,rgba(13,18,22,0) 60%)"></div>`;
const SERIES = `<div style="position:absolute;left:110px;top:150px;font:400 56px ${KAI};letter-spacing:10px;color:#e8dcc0">峡谷之外的真实历史</div>`;
const CREDIT_TAG = `<div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>`;
// 文字卡：盖在左边的时间轴上（顶栏、右边的人物卡照常露出），底下留给字幕
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:90px;width:${DX - 180}px;top:200px;box-sizing:border-box;padding:46px 60px 54px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 32px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">《北齐书》本传原文</div>
    <div style="margin-top:26px;font:400 66px/1.55 ${KAI};color:#1B2A31;letter-spacing:3px">${q.text.replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>')}</div>
  </div></body>`;
const pages = {
  // 第一屏：照样张 title-h.png。横图铺满，人物偏右，左边压暗放字
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei';overflow:hidden">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:${IMGL}px;top:0;height:${H}px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 260px)">${SHADE}
    ${SERIES}
    <div style="position:absolute;left:104px;top:330px;font:700 140px/1.2 ${KAI};letter-spacing:12px;text-shadow:0 6px 30px rgba(0,0,0,.7)">历史中的<br><span style="color:#f2c96b">阳光大男孩</span></div>
    <div style="position:absolute;left:114px;top:720px;font-size:34px;letter-spacing:10px;color:rgba(241,236,224,.75)">兰陵王</div>
    ${CREDIT_TAG}
  </body>`,
  // 开头：盖在推近的游戏图片上的字。系列标题、出处和第一屏同一位置；大字换成一行集标题，下方留给第一句旁白的字幕
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">${SHADE}
    <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(transparent,rgba(13,18,22,.8))"></div>
    ${SERIES}
    <div style="position:absolute;left:112px;top:250px;font:700 52px ${KAI};letter-spacing:6px;color:#f2c96b">兰陵王：历史中的阳光大男孩</div>
    ${CREDIT_TAG}
  </body>`,
  // 结尾卡：左边电脑画面（兰陵王的关系图），右边二维码和网址；下面小字是核实过的史料（只显示、不念）
  end: `<body style="background:radial-gradient(circle at 30% 40%,#f7f3ea 0,${PAPER} 55%,#e4dccb 100%);font-family:'Microsoft YaHei';color:#1B2A31">
    <div style="position:absolute;left:0;right:0;top:44px;text-align:center;font:700 34px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 兰陵王</div>
    <div style="position:absolute;left:110px;top:150px;width:900px;height:506px;padding:14px;border-radius:22px;background:#1B2A31;box-shadow:0 26px 60px rgba(27,42,49,.3)">
      <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;display:block;border-radius:10px"></div>
    <div style="position:absolute;left:500px;top:684px;width:120px;height:26px;background:#1B2A31;border-radius:0 0 8px 8px"></div>
    <div style="position:absolute;left:1110px;top:150px">
      <div style="font:400 112px ${KAI};letter-spacing:.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:10px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:40px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看兰陵王的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:60px;right:60px;top:800px;text-align:center;font-size:26px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
QUOTES.forEach((q, i) => { pages['quote' + i] = quoteHtml(q); });
await renderPages(pages, OUT, ['end', 'cover'], W, H);
if (STILL) { console.log('截图在', path.join(OUT, 'stills'), '；底图、文字卡在', OUT); process.exit(0); }

console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'screen.mp4', W, H);

/* ---------- 开头的游戏图片：铺满画面（位置同第一屏），朝人物的脸缓慢推近 ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]scale=${IMGW}:${H}:flags=lanczos,pad=${IMGW + IMGL}:${H}:${IMGL}:0:color=0x0d1216,crop=${W}:${H}:0:0,scale=${W * 2}:${H * 2}:flags=lanczos,`
  + `zoompan=z='1+0.08*on/${N}':x='iw*0.62-(iw/zoom*0.62)':y='ih*0.3-(ih/zoom*0.3)':d=1:s=${W}x${H}:fps=30[fg];`
  + `[fg][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 字幕：断句和对时同竖版；横版放在画面下方正中 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01', landscape: true });

/* ---------- 文字卡的出现、消失时间（同竖版） ---------- */
const tOf = ([id, snip]) => (snip ? at(id) + VOLEAD + VO[id].dur * fracBefore(SHOT[id].say, snip) - 0.15 : at(id));
const qt = QUOTES.map((q, i) => {
  const a = tOf(q.on), nx = QUOTES[i + 1];
  const b = q.off ? at(q.off) - 0.1 : nx ? tOf(nx.on) : at('n13') - 0.1;
  return { a, b, cross: !q.off && !!nx };
});
fs.writeFileSync(path.join(OUT, 'quotes.txt'), QUOTES.map((q, i) => `${qt[i].a.toFixed(2)} → ${qt[i].b.toFixed(2)}  ${q.text}`).join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 录屏，1 开头，2 结尾卡，3… 文字卡，再后是旁白，最后是音乐
const T = TOTAL.toFixed(3), tEnd = at('n13') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'screen.mp4'), '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
QUOTES.forEach((_, i) => args.push('-loop', '1', '-framerate', '30', '-t', T, '-i', `quote${i}.png`));
const Q0 = 3, A0 = Q0 + QUOTES.length;
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
let vf = `[0:v]fps=30,format=yuv420p[a];`
  + `[1:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[a][in]overlay=0:0:eof_action=pass[q0];`;
QUOTES.forEach((_, i) => {
  const { a, b, cross } = qt[i];
  // 紧接下一张的：在下一张淡入的同时淡出（两张卡高矮不一，不淡出的话旧卡的下沿会露出来）
  const outF = `,fade=out:st=${(cross ? b : b - 0.3).toFixed(3)}:d=0.3:alpha=1`;
  vf += `[${Q0 + i}:v]format=rgba,fade=in:st=${a.toFixed(3)}:d=0.3:alpha=1${outF}[qq${i}];`
    + `[q${i}][qq${i}]overlay=0:0:enable='between(t,${a.toFixed(3)},${(cross ? b + 0.3 : b).toFixed(3)})'[q${i + 1}];`;
});
vf += `[2:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[q${QUOTES.length}][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
const vo = marks.map((m, i) => `[${A0 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
let af = `;${vo.join(';')};${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  const mi = A0 + marks.length;
  af += `;[${mi}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr]loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', path.join(WORK, 'body.mp4'));
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 第一屏 ---------- */
const FULL = prependCover({ outDir: OUT, coverPng: 'cover.png', body: path.join(WORK, 'body.mp4'), out: path.join(WORK, 'final.mp4'), total: TOTAL, cover: COVER_SEC });
copyChecked(path.join(WORK, 'final.mp4'), FINAL);
fs.rmSync(WORK, { recursive: true, force: true });
console.log('成片：', FINAL, FULL + 's');
