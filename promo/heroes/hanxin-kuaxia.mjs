// 《峡谷之外》韩信“胯下之辱”一篇《韩信：忍过胯下之辱的将军》（竖屏 1080×1920）：
//   第一屏标题画面 → 开头游戏图片 → 网站手机画幅录屏（人物卡、关系图）+ 史书原文的文字卡 → 结尾卡。不配地图。
// 用法：node promo/heroes/hanxin-kuaxia.mjs [--still] [--music <音乐文件>]
//   先做两件事：仓库根目录 npm run build；按 hanxin-kuaxia.yaml 开头的命令配音。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/006-hanxin-kuaxia/stills/，用来检查位置；同时画出各张底图和文字卡。
// 成片：promo/out/heroes/006-hanxin-kuaxia/hanxin-kuaxia.mp4（不进仓库）。第一屏另存为 cover.png，可在平台上传封面时用。
// 做法照兰陵王第二篇（lanling2.mjs），通用的部分在 episode.mjs。旁白文字是定稿，这里只对照检查，不改。
// 网站韩信条目里没有漂母、亭长、封中尉这些事（条目不改），画面主要靠史书原文的文字卡，
// 引文与 scripts.md 第六篇核实记录里的原文逐字一致（开录前自动对照）。龙且那一张出自《汉书》，其余出自《史记》。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, VW, VH, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openPhone,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const OUT = path.join(PROMO, 'out', 'heroes', '006-hanxin-kuaxia');
const WORK = path.join(os.tmpdir(), 'xiagu-hanxin-kuaxia');   // 录屏、开头、正片、成片先写在这里（E 盘直接写偶尔写坏，见 episode.mjs checkVideo）
const VOICE = path.join(OUT, 'voice');
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '150-bigskin-1.jpg');       // 官方图片（默认造型，横版），不进仓库
const IMG_V = path.join(PROMO, 'out', 'heroes', 'img', '150-mobileskin-1.jpg');   // 官方图片（默认造型，竖版），第一屏用
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
// 结尾卡的二维码直接打开韩信的关系图；卡上显示的网址仍是首页
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/han-xin', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片）
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, IMG_V, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、片尾小字：对照定稿 ---------- */
const SHOTS = loadNarration(path.join(HERE, 'hanxin-kuaxia.yaml'), '## 六、', 12, '不配地图');
const SEC = (() => { const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8').replace(/\r\n/g, '\n'), i = md.indexOf('## 六、'); return md.slice(i, md.indexOf('\n---', i)); })();
const notRead = SEC.slice(0, SEC.indexOf('不配地图')).split('\n').filter(l => l.startsWith('|') && l.includes('不念')).map(l => l.split('|')[2].trim());
const [TITLE_ROW, SOURCES] = notRead;
if (TITLE_ROW !== '峡谷之外的真实历史 / 忍过胯下之辱的将军 / 韩信') { console.error('scripts.md 第六篇的第一屏文字变了，先改本脚本的第一屏'); process.exit(1); }
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 hanxin-kuaxia.yaml 要重新配音'); process.exit(1); }

/* ---------- 史书原文的文字卡 ---------- */
// on：在哪一段、念到哪几个字时出现（不给字就是这一段一开始）；一直显示到下一张出现，或 off 那一段开始。
// book：卡上标的书名。text 里【】括起来的字用红色突出，/ 是手动换行（免得一行只剩一两个字）；去掉【】和 / 后必须是核实记录“原文”一栏里的原话（里面的单引号换成了双引号）。
// 每张卡的原文照 scripts.md 第六篇“画面”一栏；结尾“我忍了，才有今天”不配原文卡（不是另一句原话）。
const SJ = '《史记》淮阴侯列传原文', HS = '《汉书》韩信传原文';
const QUOTES = [
  { on: ['n02', '常到别人家'], book: SJ, text: '常从人【寄食饮】，【人多厌之者】' },
  { on: ['n03'], book: SJ, text: '亭长妻患之，乃【晨炊蓐食】。食时信往，【不为具食】' },
  { on: ['n04'], book: SJ, text: '有一母见信饥，/【饭信】，竟漂【数十日】' },
  { on: ['n04', '大娘却生气了'], book: SJ, text: '吾哀王孙而进食，【岂望报乎！】' },
  { on: ['n05', '你不怕死'], book: SJ, text: '信能死，【刺我】；/不能死，【出我袴下】' },
  { on: ['n06'], book: SJ, text: '信【孰视之】，【俛出袴下】，蒲伏。/一市人皆笑信，【以为怯】', off: 'n07' },
  { on: ['n07', '《汉书》记载'], book: HS, text: '受辱于跨下，/【无兼人之勇】，【不足畏也】' },
  { on: ['n08', '龙且大喜'], book: SJ, text: '龙且果喜曰：“【固知信怯也。】”遂追信渡水' },
  { on: ['n08', '韩信扒开'], book: SJ, text: '信使人【决壅囊】，【水大至】', off: 'n09' },
  { on: ['n09', '给他饭吃'], book: SJ, text: '召所从食漂母，【赐千金】。/及下乡南昌亭长，【赐百钱】' },
  { on: ['n10'], book: SJ, text: '召辱己之少年令出胯下者/以为【楚中尉】' },
  { on: ['n11'], book: SJ, text: '此壮士也。方辱我时，/我宁不能杀之邪？/【杀之无名，故忍而就于此】', off: 'n12' },
];
{
  const rec = SEC.slice(SEC.indexOf('### 核实记录')).replace(/[‘’]/g, m => (m === '‘' ? '“' : '”'));
  for (const q of QUOTES) {
    const plain = q.text.replace(/[【】/]/g, '');
    if (!rec.includes(plain)) { console.error('文字卡上的原文在核实记录里找不到：' + plain); process.exit(1); }
    // 《汉书》的卡：核实记录里这句原文前面最近的书名要是《汉书》（不是《史记》）
    const fromHS = l => { const pre = l.slice(0, l.indexOf(plain)); return pre.lastIndexOf('《汉书》') > pre.lastIndexOf('《史记》'); };
    if (q.book === HS && !rec.split('\n').some(l => l.includes(plain) && fromHS(l))) { console.error('这张卡标的是《汉书》，核实记录里对不上：' + plain); process.exit(1); }
  }
  console.log(`文字卡 ${QUOTES.length} 张，原文都与核实记录一致`);
}

/* ---------- 打开网站 ---------- */
const { server, base: BASE } = await serveDist();
const ph = await openPhone();
const { browser, page, cdp, pinch, tapSel, labelPt, scrollCard, openCard, closeCard, expectFocus, type } = ph;

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
const { mark, snap } = tl;

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 搜索“韩信”，点第一条，进入他的关系图；展开人物卡，停在第一段（文字卡盖在上半截）
  await mark('n02');
  await sleep(300);
  await tapSel('#mfind'); await sleep(450);
  await type('韩信', 200);
  await sleep(400); await snap('02a-search');
  await tapSel('.s-row[data-id="han-xin"]'); await sleep(1000);
  await expectFocus('韩信');
  await openCard(); await snap('02-card');

  // 3–4. 亭长、漂母：网站条目里没有，卡片不动，文字卡轮换
  await mark('n03'); await snap('03');
  await mark('n04'); await snap('04');

  // 5–6. 胯下：卡片滚到“曾受过淮阴少年让他从胯下钻过的侮辱”
  await mark('n05');
  await sleep(200); await scrollCard('他早年贫困', 1200, 30); await snap('05-kuaxia');
  await mark('n06'); await snap('06');

  // 7. 几年后成了大将：收起卡片，在关系图上放大到前 206 年“举荐”那条线。
  //    《汉书》的文字卡只盖住关系图顶上一截，“举荐”那条线在它下面照常露出，这一段卡片不展开
  await mark('n07');
  await sleep(100); await closeCard(); await sleep(200);
  { const p = await labelPt('举荐'); if (!p) throw new Error('韩信的关系图上没有“举荐”'); await pinch(p[0], p[1], 70, 130, 1100); }
  await sleep(300); await snap('07-jujian');
  // 8. 念到“两军隔着潍水”时展开卡片，滚到“在潍水击杀楚将龙且”
  await mark('n08');
  await sleep(100); await openCard(); await scrollCard('汉四年他袭破齐国', 1000, 30); await snap('08-weishui');

  // 9–11. 当了楚王：卡片滚到“项羽死后，高祖夺其军，改封他为楚王”
  await mark('n09');
  await sleep(200); await scrollCard('项羽死后', 1200, 30); await snap('09-chuwang');
  await mark('n10'); await snap('10');
  await mark('n11'); await snap('11');

  // 12. 结尾卡（合成时盖在上面）
  await mark('n12');
  await mark(null);
}

/* ---------- 录像 ---------- */
const frames = STILL ? null : await startScreencast(cdp);
tl.t0 = Date.now();
try { await act(); } catch (e) { console.error('录制中断：', e.message); await page.screenshot({ path: path.join(OUT, 'stills', 'error.png') }); await browser.close(); server.close(); process.exit(1); }
const TOTAL = (Date.now() - tl.t0) / 1000;
if (!STILL) await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks, at = tl.at;

/* ---------- 各张底图：用浏览器画（1080×1920） ---------- */
// 录屏放在 (PX, PY)，大小 PW×PH；上方是标题和字幕
const PW = 700, PH = Math.round(PW * VH / VW), PX = (1080 - PW) / 2, PY = 1920 - PH - 50;
const KAI = "'STKaiti','KaiTi',serif";
const TITLE = `<div style="position:absolute;left:0;right:0;top:52px;text-align:center;font:700 38px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 韩信</div>`;
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
// 文字卡：盖在手机画面上半截（关系图那一块），下半截照常露出网站上的人物卡
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:60px;right:60px;top:${PY + 170}px;padding:40px 48px 46px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 30px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">${q.book}</div>
    <div style="margin-top:22px;font:400 58px/1.5 ${KAI};color:#1B2A31;letter-spacing:2px">${q.text.replace(/\//g, '<br>').replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>')}</div>
  </div></body>`;
// 系列标题（第一屏和开头同一位置，第一屏淡入开头时不重影）——“朱红印章”刊头，同横版（项目方 2026-11-28 选定）：
// 系列名用宋体（主标题是楷体），“峡谷之外的”浅米色，“真实历史”白字反衬在朱红色的印章块里
const SERIF = "'Noto Serif SC','Source Han Serif SC','SimSun',serif";
const SERIES = `<div style="position:absolute;left:0;right:0;top:104px;display:flex;justify-content:center;align-items:center;font-family:${SERIF};white-space:nowrap">`
  + `<span style="font-size:66px;font-weight:500;letter-spacing:12px;color:#e8dcc0;text-shadow:0 4px 16px rgba(0,0,0,.6)">峡谷之外的</span>`
  + `<span style="margin-left:8px;padding:6px 10px 8px 22px;background:#b3392b;border-radius:4px;font-size:72px;font-weight:900;letter-spacing:12px;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.35)">真实历史</span></div>`;
const pages = {
  // 第一屏（成片第一帧，也是平台上的预览图）：照制作标准的标题画面（版式同兰陵王第二篇）。竖版图居中，同一造型的横版图模糊垫底；
  // 大标题“忍过胯下之辱的将军”太长，分两行：“忍过 / 胯下之辱的将军”，后一行金色（不让“的”字起行，“胯下之辱”整个在金色里）
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-1000px;top:0;height:1920px;filter:blur(30px) brightness(.55) saturate(.8)">
    <img src="${dataUrl(IMG_V)}" style="position:absolute;left:0;top:300px;width:1080px;
      -webkit-mask-image:linear-gradient(transparent 0,rgba(0,0,0,.55) 110px,#000 300px,#000 900px,transparent 1300px)">
    <div style="position:absolute;left:0;right:0;top:0;height:520px;background:linear-gradient(rgba(13,18,22,.92) 0,rgba(13,18,22,.75) 200px,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1100px;bottom:0;background:linear-gradient(transparent,rgba(13,18,22,.9) 300px,#0d1216 520px)"></div>
    ${SERIES}
    <div style="position:absolute;left:0;right:0;top:1340px;text-align:center;font:700 132px/1.22 ${KAI};letter-spacing:10px;text-indent:10px;text-shadow:0 6px 30px rgba(0,0,0,.7)">忍过<br><span style="color:#f2c96b">胯下之辱的将军</span></div>
    <div style="position:absolute;left:0;right:0;top:1720px;text-align:center;font-size:36px;letter-spacing:10px;text-indent:10px;color:rgba(241,236,224,.75)">韩信</div>
    <div style="position:absolute;right:30px;bottom:30px;font-size:24px;color:rgba(241,236,224,.7)">${CREDIT}</div>
  </body>`,
  // 手机外框（中间挖空放录屏）
  frame: `<body style="background:transparent">
    <div style="position:absolute;left:${PX - 16}px;top:${PY - 16}px;width:${PW + 32}px;height:${PH + 32}px;border-radius:64px;
      box-shadow:0 0 0 2000px ${PAPER};border:16px solid #1b2a31;box-sizing:border-box"></div>${TITLE}</body>`,
  // 开头：盖在游戏图片上的字（系列名、这一集的标题、图片出处）；图片本身在合成时放到 y=330–1530
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">
    <div style="position:absolute;left:0;right:0;top:330px;height:90px;background:linear-gradient(#0d1216,transparent)"></div>
    <div style="position:absolute;left:0;right:0;top:1370px;height:160px;background:linear-gradient(transparent,#0d1216)"></div>
    ${SERIES}
    <div style="position:absolute;left:0;right:0;top:256px;text-align:center;font:700 46px ${KAI};letter-spacing:6px;text-indent:6px;color:#f1ece0;text-shadow:0 3px 14px rgba(0,0,0,.6)">韩信：忍过胯下之辱的将军</div>
    <div style="position:absolute;left:36px;top:1466px;padding:8px 18px;border-radius:8px;background:rgba(0,0,0,.55);font-size:28px;letter-spacing:1px;color:#f1ece0">${CREDIT}</div>
  </body>`,
  // 结尾卡：二维码、网址；最下面小字是核实过的史料（只显示、不念）
  end: `<body style="background:${PAPER};font-family:'Microsoft YaHei';color:#1B2A31">${TITLE}
    <div style="position:absolute;left:0;right:0;top:${PY - 60}px;display:flex;flex-direction:column;align-items:center">
      <div style="width:340px;height:690px;border-radius:48px;background:#1B2A31;padding:13px;box-sizing:border-box;box-shadow:0 26px 60px rgba(27,42,49,.3)">
        <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:36px;display:block"></div>
      <div style="margin-top:30px;font:400 108px ${KAI};letter-spacing:.14em;margin-right:-.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:8px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:30px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看韩信的关系图</div>
          <div style="display:inline-block;margin-top:20px;padding:8px 22px;border-radius:40px;background:#C4472D;color:#fff;font-size:26px;font-weight:400;letter-spacing:.08em">电脑手机都能看 · 免费开放</div></div>
      </div>
    </div>
    <div style="position:absolute;left:50px;right:50px;bottom:40px;text-align:center;font-size:27px;line-height:1.5;color:#5f6c6f">${SOURCES}</div>
  </body>`,
};
QUOTES.forEach((q, i) => { pages['quote' + i] = quoteHtml(q); });
await renderPages(pages, OUT, ['end', 'cover']);
if (STILL) { console.log('截图在', path.join(OUT, 'stills'), '；底图、文字卡在', OUT); process.exit(0); }

console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'phone.mp4');

/* ---------- 开头的游戏图片：模糊的同一张图垫底，中间是人物，缓慢推近（裁切位置同韩信第一篇） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,boxblur=26:4,eq=brightness=-0.3:saturation=0.75[bg];`
  + `[b]crop=794:882:840:0,scale=3176:3528:flags=lanczos,zoompan=z='1+0.1*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1200:fps=30[fg];`
  + `[bg][fg]overlay=0:330[c];[c][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 字幕 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01' });

/* ---------- 文字卡的出现、消失时间 ---------- */
const tOf = ([id, snip]) => (snip ? at(id) + VOLEAD + VO[id].dur * fracBefore(SHOT[id].say, snip) - 0.15 : at(id));
const qt = QUOTES.map((q, i) => {
  const a = tOf(q.on), nx = QUOTES[i + 1];
  const b = q.off ? at(q.off) - 0.1 : nx ? tOf(nx.on) : at('n12') - 0.1;
  return { a, b, cross: !q.off && !!nx };   // cross：紧接着下一张，和下一张交叉淡入淡出
});
fs.writeFileSync(path.join(OUT, 'quotes.txt'), QUOTES.map((q, i) => `${qt[i].a.toFixed(2)} → ${qt[i].b.toFixed(2)}  ${q.book}  ${q.text.replace(/\//g, '')}`).join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 底色，1 录屏，2 外框，3 开头，4 结尾卡，5… 文字卡，再后是旁白，最后是音乐
const T = TOTAL.toFixed(3), tEnd = at('n12') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x${PAPER.slice(1)}:s=1080x1920:r=30:d=${T}`, '-i', path.join(WORK, 'phone.mp4'), '-i', 'frame.png', '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
QUOTES.forEach((_, i) => args.push('-loop', '1', '-framerate', '30', '-t', T, '-i', `quote${i}.png`));
const Q0 = 5, A0 = Q0 + QUOTES.length;
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
let vf = `[1:v]scale=${PW}:${PH}:flags=lanczos[ph];[0:v][ph]overlay=${PX}:${PY}[a];[a][2:v]overlay=0:0[b];`
  + `[3:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[b][in]overlay=0:0:eof_action=pass[q0];`;
QUOTES.forEach((_, i) => {
  const { a, b, cross } = qt[i];
  // 紧接下一张的：在下一张淡入的同时淡出（两张卡高矮不一，不淡出的话旧卡的下沿会露出来）
  const outF = `,fade=out:st=${(cross ? b : b - 0.3).toFixed(3)}:d=0.3:alpha=1`;
  vf += `[${Q0 + i}:v]format=rgba,fade=in:st=${a.toFixed(3)}:d=0.3:alpha=1${outF}[qq${i}];`
    + `[q${i}][qq${i}]overlay=0:0:enable='between(t,${a.toFixed(3)},${(cross ? b + 0.3 : b).toFixed(3)})'[q${i + 1}];`;
});
vf += `[4:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[q${QUOTES.length}][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白：每段在字幕出现后 VOLEAD 秒开始；音乐压低，有人声时再自动让一让（sidechain）
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
copyChecked(path.join(WORK, 'final.mp4'), path.join(OUT, 'hanxin-kuaxia.mp4'));
console.log('成片：', path.join(OUT, 'hanxin-kuaxia.mp4'), FULL + 's');
