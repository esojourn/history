// 《峡谷之外》韩信一集《悲情韩信：追他回来的人，送他去死》（竖屏 1080×1920）：
//   片头封面 → 开头游戏图片 → 网站手机画幅录屏 → 一处局部地图（井陉、垓下）→ 结尾卡。
// 用法：node promo/heroes/hanxin.mjs [--still] [--music <音乐文件>]
//   先做三件事：仓库根目录 npm run build；按 hanxin.yaml 开头的命令配音；node promo/heroes/map.mjs hanxin-zhan 画地图。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/hanxin/stills/，用来检查位置。
// 成片：promo/out/heroes/hanxin/hanxin.mp4（不进仓库）。封面图另存为 cover.png，可在平台上传封面时用。
// 做法同兰陵王一集（lanling.mjs），通用的部分在 episode.mjs。旁白文字是定稿，这里只对照检查，不改。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, VW, VH, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openPhone,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover,
} from './episode.mjs';

const OUT = path.join(PROMO, 'out', 'heroes', 'hanxin');
const VOICE = path.join(OUT, 'voice');
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '150-bigskin-1.jpg');       // 官方图片（默认造型，横版），不进仓库
const IMG_V = path.join(PROMO, 'out', 'heroes', 'img', '150-mobileskin-1.jpg');   // 官方图片（默认造型，竖版），封面用
const MAP = path.join(PROMO, 'out', 'heroes', 'maps', 'hanxin-zhan.png');
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
// 结尾卡的二维码直接打开韩信的关系图；卡上显示的网址仍是首页
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/han-xin', URL_SHOW = 'lishi.alz-ai.cn';
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
requireFiles([IMG, IMG_V, MAP, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、片尾小字：对照定稿 ---------- */
const SHOTS = loadNarration(path.join(HERE, 'hanxin.yaml'), '## 一、', 13);
const SOURCES = (() => {
  const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8'), i = md.indexOf('## 一、');
  const row = md.slice(i, md.indexOf('配地图：', i)).split('\n').find(l => l.startsWith('|') && l.includes('不念'));
  return row.split('|')[2].trim();
})();
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 hanxin.yaml 要重新配音'); process.exit(1); }

/* ---------- 打开网站 ---------- */
const { server, base: BASE } = await serveDist();
const ph = await openPhone();
const { browser, page, cdp, pinch, tapSel, tapPerson, labelPt, scrollCard, openCard, closeCard, expectFocus, type } = ph;

// 结尾卡里的手机画面：韩信的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/han-xin', { waitUntil: 'networkidle' });
await page.waitForSelector('#mseg [data-map]', { timeout: 15000 });
await sleep(1200);
await page.screenshot({ path: path.join(OUT, 'focus.png') });
await page.goto('about:blank');
await page.goto(BASE + '/zh/', { waitUntil: 'networkidle' });
await page.waitForSelector('#mpeople', { timeout: 15000 });
await sleep(1500);

const tl = makeTimeline({ shot: SHOT, vo: VO, still: STILL, stillDir: path.join(OUT, 'stills'), page });
const { mark, until, snap } = tl;
// 事件卡、人物卡之间来回：卡片里点某个事件
async function goEvent(id, name) {
  await openCard();
  await scrollCard(`sel:[data-goe="${id}"]`, 500, 200); await sleep(150);
  await tapSel(`#msheet [data-goe="${id}"]`); await sleep(1000);
  await expectFocus(name);
  await openCard();
}
// 从事件卡返回刚才的人物
async function back(name) {
  await scrollCard(null, 400); await sleep(150);
  await tapSel('#msheet .d-back'); await sleep(1100);
  await expectFocus(name);
}

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 搜索“韩信”，点第一条，进入他的关系图
  await mark('n02');
  await sleep(500);
  await tapSel('#mfind'); await sleep(500);
  await type('韩信');
  await sleep(500); await snap('02a-search');
  await tapSel('.s-row[data-id="han-xin"]'); await sleep(1200);
  await expectFocus('韩信');
  await snap('02-focus');

  // 3. 人物卡：展开，滚到“项梁渡淮……屡次献策不被采用……中途逃走”
  await mark('n03');
  await sleep(200); await openCard(); await snap('03a-card');
  await sleep(1200); await scrollCard('项梁渡淮时', 1300, 30); await snap('03-taozou');

  // 4. 聚焦萧何：收起卡片，在关系图上放大到前 206 年“举荐”那条线，再点萧何，卡片滚到追回韩信那一句
  await mark('n04');
  await sleep(200); await closeCard(); await sleep(300);
  { const p = await labelPt('举荐'); if (!p) throw new Error('韩信的关系图上没有“举荐”'); await pinch(p[0], p[1], 70, 130, 1100); }
  await sleep(600); await snap('04a-zoom');
  await tapPerson('xiao-he'); await sleep(1200);
  await expectFocus('萧何');
  await sleep(400); await openCard();
  await sleep(500); await scrollCard('韩信逃亡，萧何亲自追回', 1300, 30); await snap('04-zhuihui');

  // 5a. 地图盖在手机画面上半截。点回韩信，卡片滚到“东出陈仓”
  await mark('n05a');
  await closeCard(); await tapPerson('han-xin'); await sleep(1000);
  await expectFocus('韩信');
  await openCard(); await scrollCard('同年八月汉军东出陈仓', 900, 30); await snap('05a-chencang');
  // 5b. 念到“背水列阵”时点开事件“井陉背水一战”；念到“袭取齐国”时换到“垓下之战”
  await mark('n05b');
  await until(fracBefore(SHOT.n05b.say, '背水列阵') - 0.08);
  await goEvent('jingxing', '井陉'); await snap('05b-jingxing');
  await until(fracBefore(SHOT.n05b.say, '袭取齐国'));
  await back('韩信');
  await goEvent('gaixia', '垓下'); await snap('05c-gaixia');

  // 6. 人物卡：回到韩信，滚到“项羽死后，高祖夺其军”
  await mark('n06');
  await back('韩信'); await openCard();
  await scrollCard('项羽死后', 1200, 30); await snap('06-duojun');

  // 7–10. 事件“韩信被杀”：一段一段往下滚
  await mark('n07');
  await goEvent('hanxin-death', '韩信被杀'); await snap('07a-event');
  await sleep(1200); await scrollCard('汉十年陈豨果然反叛', 1200, 30); await snap('07-chenxi');
  await mark('n08');
  await sleep(300); await scrollCard('吕后想召韩信', 1300, 30); await snap('08-shangliang');
  await mark('n09');
  await sleep(1000); await scrollCard('萧何亲自劝韩信', 1000, 60); await snap('09-qiangruhe');
  await mark('n10');
  await sleep(300); await scrollCard('韩信一入宫', 1000, 30); await snap('10-zhongshi');

  // 11. 聚焦刘邦：回到韩信，点“汉高祖”，卡片滚到“异姓诸侯王韩信……相继被废被杀”
  await mark('n11');
  await back('韩信'); await closeCard();
  await tapPerson('liu-bang'); await sleep(1100);
  await expectFocus('汉高祖');
  await openCard(); await sleep(300);
  await scrollCard('在位期间', 1300, 30); await snap('11-liubang');

  // 12. 回到韩信的关系图：韩信、萧何、汉高祖、吕后同屏，放大到“举荐”到“诛杀”这一段
  await mark('n12');
  await back('韩信'); await closeCard();   // 汉高祖的关系图人多，韩信那一条在屏幕外，用卡片上的“返回 韩信”
  await sleep(600);
  { const a = await labelPt('举荐'), b = await labelPt('诛杀'); if (!a || !b) throw new Error('韩信的关系图上找不到“举荐”“诛杀”');
    await pinch(200, (a[1] + b[1]) / 2, 90, 130, 1200); }
  await snap('12-sitong');

  // 13. 结尾卡（合成时盖在上面）
  await mark('n13');
  await mark(null);
}

/* ---------- 录像 ---------- */
const frames = STILL ? null : await startScreencast(cdp);
tl.t0 = Date.now();
try { await act(); } catch (e) { console.error('录制中断：', e.message); await page.screenshot({ path: path.join(OUT, 'stills', 'error.png') }); await browser.close(); server.close(); process.exit(1); }
const TOTAL = (Date.now() - tl.t0) / 1000;
if (STILL) { console.log('截图在', path.join(OUT, 'stills')); await browser.close(); server.close(); process.exit(0); }
await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks;
console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, OUT, 'phone.mp4');

/* ---------- 各张底图：用浏览器画（1080×1920） ---------- */
const at = tl.at;
// 录屏放在 (PX, PY)，大小 PW×PH；上方是标题和字幕
const PW = 700, PH = Math.round(PW * VH / VW), PX = (1080 - PW) / 2, PY = 1920 - PH - 50;
const TITLE = `<div style="position:absolute;left:0;right:0;top:52px;text-align:center;font:700 38px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 韩信</div>`;
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
// 片尾小字太长，在“萧相国世家，”“萧何传，”后面换行
const srcHtml = SOURCES.replace('萧相国世家，', '萧相国世家，<br>').replace('萧何传，', '萧何传，<br>');
await renderPages({
  // 封面：成片第一帧（社交平台上显示的就是它）。竖版官方图片居中，同一张横版图模糊垫底，下方大字片名
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-1000px;top:0;height:1920px;filter:blur(30px) brightness(.55) saturate(.8)">
    <img src="${dataUrl(IMG_V)}" style="position:absolute;left:0;top:170px;width:1080px">
    <div style="position:absolute;left:0;right:0;top:0;height:330px;background:linear-gradient(#0d1216 45%,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1180px;bottom:0;background:linear-gradient(transparent,#0d1216 42%)"></div>
    <div style="position:absolute;left:0;right:0;top:70px;text-align:center;font:400 96px 'STKaiti','KaiTi',serif;letter-spacing:16px;text-indent:16px">峡谷之外</div>
    <div style="position:absolute;left:0;right:0;top:200px;text-align:center;font-size:34px;letter-spacing:8px;color:#d8c9a8">王者荣耀人物的真实历史</div>
    <div style="position:absolute;left:0;right:0;top:1440px;text-align:center;font:700 176px 'STKaiti','KaiTi',serif;letter-spacing:22px;text-indent:22px;color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.6)">悲情韩信</div>
    <div style="position:absolute;left:0;right:0;top:1680px;text-align:center;font:700 60px 'Microsoft YaHei';letter-spacing:4px;color:#e8c27a">追他回来的人，送他去死</div>
    <div style="position:absolute;right:30px;top:1850px;font-size:26px;letter-spacing:1px;color:rgba(241,236,224,.8)">${CREDIT}</div>
  </body>`,
  // 手机外框（中间挖空放录屏）
  frame: `<body style="background:transparent">
    <div style="position:absolute;left:${PX - 16}px;top:${PY - 16}px;width:${PW + 32}px;height:${PH + 32}px;border-radius:64px;
      box-shadow:0 0 0 2000px ${PAPER};border:16px solid #1b2a31;box-sizing:border-box"></div>${TITLE}</body>`,
  // 开头：盖在游戏图片上的字（系列名、这一集的标题、图片出处）；图片本身在合成时放到 y=330–1530
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">
    <div style="position:absolute;left:0;right:0;top:330px;height:90px;background:linear-gradient(#0d1216,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1370px;height:160px;background:linear-gradient(transparent,#0d1216)"></div>
    <div style="position:absolute;left:0;right:0;top:92px;text-align:center;font:400 104px 'STKaiti','KaiTi',serif;letter-spacing:16px;text-indent:16px">峡谷之外</div>
    <div style="position:absolute;left:0;right:0;top:232px;text-align:center;font-size:34px;letter-spacing:8px;color:#d8c9a8">王者荣耀人物的真实历史</div>
    <div style="position:absolute;left:36px;top:1466px;padding:8px 18px;border-radius:8px;background:rgba(0,0,0,.55);font-size:28px;letter-spacing:1px;color:#f1ece0">${CREDIT}</div>
    <div style="position:absolute;left:0;right:0;top:1578px;text-align:center;font:700 50px 'Microsoft YaHei';letter-spacing:3px;color:#e8c27a">悲情韩信：追他回来的人，送他去死</div>
  </body>`,
  // 地图：只盖住手机画面的上半截（关系图那一块），下半截照常露出网站上的事件卡
  mapcard: `<body style="background:transparent">
    <img src="${dataUrl(MAP)}" style="position:absolute;left:40px;top:${PY + 90}px;width:1000px;border-radius:26px;box-shadow:0 14px 40px rgba(27,42,49,.28);border:2px solid #d9cdb4">
  </body>`,
  // 结尾卡：二维码、网址；最下面小字是核实过的史料（只显示、不念）
  end: `<body style="background:${PAPER};font-family:'Microsoft YaHei';color:#1B2A31">${TITLE}
    <div style="position:absolute;left:0;right:0;top:${PY - 60}px;display:flex;flex-direction:column;align-items:center">
      <div style="width:340px;height:690px;border-radius:48px;background:#1B2A31;padding:13px;box-sizing:border-box;box-shadow:0 26px 60px rgba(27,42,49,.3)">
        <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:36px;display:block"></div>
      <div style="margin-top:30px;font:400 108px 'STKaiti','KaiTi',serif;letter-spacing:.14em;margin-right:-.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:8px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:30px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看韩信的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:50px;right:50px;bottom:40px;text-align:center;font-size:27px;line-height:1.5;color:#5f6c6f">${srcHtml}</div>
  </body>`,
}, OUT, ['end', 'cover']);

/* ---------- 开头的游戏图片：模糊的同一张图垫底，中间是人物，缓慢推近 ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=26:4,eq=brightness=-0.3:saturation=0.75[bg];`
  + `[b]crop=794:882:840:0,scale=3176:3528:flags=lanczos,zoompan=z='1+0.1*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1200:fps=30[fg];`
  + `[bg][fg]overlay=0:330[c];[c][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(OUT, 'intro.mp4')]);

/* ---------- 字幕 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01' });

/* ---------- 合成 ---------- */
// 输入：0 底色，1 录屏，2 外框，3 开头，4 地图，5 结尾卡，6… 旁白，最后是音乐
const T = TOTAL.toFixed(3), tMap0 = at('n05a') - 0.1, tMap1 = at('n06') - 0.3, tEnd = at('n13') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${PAPER.slice(1)}:s=1080x1920:r=30:d=${T}`, '-i', 'phone.mp4', '-i', 'frame.png', '-i', 'intro.mp4',
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'mapcard.png', '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
const vf = `[1:v]scale=${PW}:${PH}:flags=lanczos[ph];[0:v][ph]overlay=${PX}:${PY}[a];[a][2:v]overlay=0:0[b];`
  + `[3:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[b][in]overlay=0:0:eof_action=pass[c];`
  + `[4:v]format=rgba,fade=in:st=${tMap0.toFixed(3)}:d=0.35:alpha=1,fade=out:st=${tMap1.toFixed(3)}:d=0.35:alpha=1[mp];[c][mp]overlay=0:0[d];`
  + `[5:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[d][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白：每段在字幕出现后 VOLEAD 秒开始；音乐压低，有人声时再自动让一让（sidechain）
const vo = marks.map((m, i) => `[${6 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
let af = `;${vo.join(';')};${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  const mi = 6 + marks.length;
  af += `;[${mi}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr]loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', 'body.mp4');
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 片头封面 ---------- */
const FULL = prependCover({ outDir: OUT, coverPng: 'cover.png', body: 'body.mp4', out: 'hanxin.mp4', total: TOTAL });
fs.rmSync(path.join(OUT, 'body.mp4'));
console.log('成片：', path.join(OUT, 'hanxin.mp4'), FULL + 's');
