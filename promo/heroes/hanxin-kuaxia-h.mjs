// 《峡谷之外》韩信“胯下之辱”一篇·横版（1920×1080）：内容、旁白、配音、史书原文文字卡与竖版（hanxin-kuaxia.mjs）相同，网站画面换成桌面版。
// 用法：node promo/heroes/hanxin-kuaxia-h.mjs [--still] [--music <音乐文件>]
//   先做两件事：仓库根目录 npm run build；配音沿用竖版的（promo/out/heroes/006-hanxin-kuaxia/voice/，见 hanxin-kuaxia.yaml 开头）。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/006-hanxin-kuaxia/h/stills/，同时画出第一屏、文字卡、结尾卡，用来检查位置。
// 成片：promo/out/heroes/006-hanxin-kuaxia/hanxin-kuaxia-h.mp4（不进仓库）；中间文件都在 promo/out/heroes/006-hanxin-kuaxia/h/，不碰竖版的文件。
// 视频文件先在系统临时目录里生成，最后复制过来并整段解码检查（E 盘直接写会偶尔写坏，见 episode.mjs 的 checkVideo）。
// 做法同兰陵王第二篇横版（lanling2-h.mjs）：桌面版网站、假鼠标、一镜到底，每段的长短跟着旁白走；游戏图片、文字卡、结尾卡是合成时盖上去的。
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

const SRC = path.join(PROMO, 'out', 'heroes', '006-hanxin-kuaxia');
const OUT = path.join(SRC, 'h');
const VOICE = path.join(SRC, 'voice');   // 竖版做好的配音，直接复用
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '150-bigskin-1.jpg');   // 官方图片（默认造型，横版 1920×882），不进仓库
const FINAL = path.join(SRC, 'hanxin-kuaxia-h.mp4');
const WORK = path.join(os.tmpdir(), 'xiagu-hanxin-kuaxia-h');
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/han-xin', URL_SHOW = 'lishi.alz-ai.cn';
const COVER_SEC = 1.6;   // 第一屏停留秒数（含 0.4 秒淡入正片），同竖版
for (const d of [path.join(OUT, 'stills'), WORK]) fs.mkdirSync(d, { recursive: true });
requireFiles([IMG, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、第一屏、片尾小字、文字卡原文：对照定稿（同竖版） ---------- */
const SHOTS = loadNarration(path.join(HERE, 'hanxin-kuaxia.yaml'), '## 六、', 12, '不配地图');
const SEC = (() => { const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8').replace(/\r\n/g, '\n'), i = md.indexOf('## 六、'); return md.slice(i, md.indexOf('\n---', i)); })();
const [TITLE_ROW, SOURCES] = SEC.slice(0, SEC.indexOf('不配地图')).split('\n').filter(l => l.startsWith('|') && l.includes('不念')).map(l => l.split('|')[2].trim());
if (TITLE_ROW !== '峡谷之外的真实历史 / 忍过胯下之辱的将军 / 韩信') { console.error('scripts.md 第六篇的第一屏文字变了，先改本脚本的第一屏'); process.exit(1); }
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 hanxin-kuaxia.yaml 要重新配音'); process.exit(1); }

// 文字卡：同竖版（hanxin-kuaxia.mjs）。【】里的字用红色突出，/ 是手动换行；去掉【】和 / 后必须是核实记录“原文”一栏里的原话
const SJ = '《史记》淮阴侯列传原文', HS = '《汉书》韩信传原文';
const QUOTES = [
  { on: ['n02', '常到别人家'], book: SJ, text: '常从人【寄食饮】，【人多厌之者】' },
  { on: ['n03'], book: SJ, text: '亭长妻患之，乃【晨炊蓐食】。/食时信往，【不为具食】' },
  { on: ['n04'], book: SJ, text: '有一母见信饥，【饭信】，竟漂【数十日】' },
  { on: ['n04', '大娘却生气了'], book: SJ, text: '吾哀王孙而进食，【岂望报乎！】' },
  { on: ['n05', '你不怕死'], book: SJ, text: '信能死，【刺我】；不能死，【出我袴下】' },
  { on: ['n06'], book: SJ, text: '信【孰视之】，【俛出袴下】，蒲伏。/一市人皆笑信，【以为怯】', off: 'n07' },
  // 这一张放在下方（top），上面露出时间轴上韩信、萧何和“举荐”那条线（念这句之前刚放大到那里）
  { on: ['n07', '《汉书》记载'], book: HS, text: '受辱于跨下，【无兼人之勇】，【不足畏也】', top: 690 },
  { on: ['n08', '龙且大喜'], book: SJ, text: '龙且果喜曰：“【固知信怯也。】”/遂追信渡水' },
  { on: ['n08', '韩信扒开'], book: SJ, text: '信使人【决壅囊】，【水大至】', off: 'n09' },
  { on: ['n09', '给他饭吃'], book: SJ, text: '召所从食漂母，【赐千金】。/及下乡南昌亭长，【赐百钱】' },
  { on: ['n10'], book: SJ, text: '召辱己之少年令出胯下者以为【楚中尉】' },
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

/* ---------- 打开网站（桌面版） ---------- */
const { server, base: BASE } = await serveDist();
const dk = await openDesktop();
const { browser, page, cdp, cursor, glide, clickSel, wheel, link, scrollCard, pointAt, expectSel, type } = dk;

// 结尾卡里的电脑画面：韩信的关系图（先截下来，再回到首页开始录）
await page.goto(BASE + '/zh/#person/han-xin', { waitUntil: 'networkidle' });
await page.waitForSelector('#river [data-p="han-xin"]', { timeout: 15000 });
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

  // 2. 搜索“韩信”，点第一条：时间轴飞到秦汉之际，右边出人物卡；鼠标指着“他早年贫困”（文字卡盖在左边）
  await mark('n02');
  await cursor(true); await sleep(200);
  await clickSel('#find', null, 600); await sleep(300);
  await type('韩信', 200);
  await sleep(350); await snap('02a-search');
  await clickSel('.search .s-row[data-id="han-xin"]', 110, 450); await sleep(1100);
  await expectSel('person/han-xin');
  await dk.measure();
  await sleep(200); await pointAt('他早年贫困', 900); await snap('02-card');

  // 3–4. 亭长、漂母：网站条目里没有，卡片不动，文字卡轮换
  await mark('n03'); await snap('03');
  await mark('n04'); await snap('04');

  // 5–6. 胯下：鼠标指着“曾受过淮阴少年让他从胯下钻过的侮辱”
  await mark('n05');
  await sleep(200); await pointAt('曾受过淮阴少年', 900); await snap('05-kuaxia');
  await mark('n06'); await snap('06');

  // 7. 几年后成了大将：时间轴露出来，鼠标移到前 206 年萧何“举荐”那条线上，滚轮放大
  await mark('n07');
  await sleep(100);
  { const [x, y] = await link('xiao-he'); await glide(x, y, 1000); await sleep(200); await wheel(-260, 1400); }
  await sleep(300); await snap('07-jujian');

  // 8. 念到“两军隔着潍水”：卡片滚到“在潍水击杀楚将龙且”，鼠标指过去
  await mark('n08');
  await sleep(100); await scrollCard('汉四年他袭破齐国', 1100, 60); await pointAt('在潍水击杀楚将龙且', 800); await snap('08-weishui');

  // 9–11. 当了楚王：卡片滚到“项羽死后，高祖夺其军，改封他为楚王”
  await mark('n09');
  await sleep(200); await scrollCard('项羽死后', 1200, 60); await pointAt('改封他为楚王', 800); await snap('09-chuwang');
  await mark('n10'); await snap('10');
  await mark('n11'); await snap('11');

  // 12. 结尾卡（合成时盖在上面）
  await mark('n12');
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
// 官方横版图 1920×882，放大到 1080 高（2351 宽），左移 IMGX（同韩信第一篇横版）：人物的脸在画面偏右，左边压暗放字
const IMGX = 230, IMGW = Math.round(1920 * H / 882), DX = dk.detailX;
const KAI = "'STKaiti','KaiTi',serif";
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const SHADE = `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.94) 0,rgba(13,18,22,.8) 36%,rgba(13,18,22,0) 62%)"></div>`;
// 系列标题（第一屏和开头同一位置）。项目方 2026-11-28 要求加大、“真实历史”更明显：“峡谷之外的”米色，“真实历史”更大、加粗、金色
const SERIES = `<div style="position:absolute;left:106px;top:110px;font-family:${KAI};color:#e8dcc0;letter-spacing:8px;white-space:nowrap;text-shadow:0 4px 20px rgba(0,0,0,.6)">`
  + `<span style="font-size:76px">峡谷之外的</span><span style="font-size:102px;font-weight:700;color:#f2c96b">真实历史</span></div>`;
const CREDIT_TAG = `<div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>`;
// 文字卡：盖在左边的时间轴上（顶栏、右边的人物卡照常露出），底下留给字幕
const quoteHtml = q => `<body style="background:transparent">
  <div style="position:absolute;left:90px;width:${DX - 180}px;top:${q.top || 200}px;box-sizing:border-box;padding:46px 60px 54px;border-radius:26px;background:#fbf7ee;border:2px solid #d9cdb4;box-shadow:0 14px 40px rgba(27,42,49,.28)">
    <div style="font:700 32px 'Microsoft YaHei';letter-spacing:4px;color:#8a5a2b">${q.book}</div>
    <div style="margin-top:26px;font:400 66px/1.55 ${KAI};color:#1B2A31;letter-spacing:3px">${q.text.replace(/\//g, '<br>').replace(/【/g, '<b style="color:#C4472D">').replace(/】/g, '</b>')}</div>
  </div></body>`;
const pages = {
  // 第一屏：照样张 title-h.png。横图铺满，人物偏右，左边压暗放字；大标题分两行“忍过 / 胯下之辱的将军”，后一行金色（同竖版）
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei';overflow:hidden">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-${IMGX}px;top:0;height:${H}px">${SHADE}
    ${SERIES}
    <div style="position:absolute;left:100px;top:330px;font:700 124px/1.24 ${KAI};letter-spacing:10px;text-shadow:0 6px 30px rgba(0,0,0,.7)">忍过<br><span style="color:#f2c96b">胯下之辱的将军</span></div>
    <div style="position:absolute;left:112px;top:680px;font-size:36px;letter-spacing:10px;color:rgba(241,236,224,.75)">韩信</div>
    ${CREDIT_TAG}
  </body>`,
  // 开头：盖在推近的游戏图片上的字。系列标题、出处和第一屏同一位置；大字换成一行集标题，下方留给第一句旁白的字幕
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">${SHADE}
    <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(transparent,rgba(13,18,22,.8))"></div>
    ${SERIES}
    <div style="position:absolute;left:110px;top:262px;font:700 52px ${KAI};letter-spacing:6px;color:#f1ece0;text-shadow:0 3px 14px rgba(0,0,0,.6)">韩信：忍过胯下之辱的将军</div>
    ${CREDIT_TAG}
  </body>`,
  // 结尾卡：左边电脑画面（韩信的关系图），右边二维码和网址；下面小字是核实过的史料（只显示、不念）
  end: `<body style="background:radial-gradient(circle at 30% 40%,#f7f3ea 0,${PAPER} 55%,#e4dccb 100%);font-family:'Microsoft YaHei';color:#1B2A31">
    <div style="position:absolute;left:0;right:0;top:44px;text-align:center;font:700 34px 'Microsoft YaHei';letter-spacing:6px;color:#8a5a2b">峡谷之外 · 韩信</div>
    <div style="position:absolute;left:110px;top:150px;width:900px;height:506px;padding:14px;border-radius:22px;background:#1B2A31;box-shadow:0 26px 60px rgba(27,42,49,.3)">
      <img src="${dataUrl(path.join(OUT, 'focus.png'))}" style="width:100%;height:100%;display:block;border-radius:10px"></div>
    <div style="position:absolute;left:500px;top:684px;width:120px;height:26px;background:#1B2A31;border-radius:0 0 8px 8px"></div>
    <div style="position:absolute;left:1110px;top:150px">
      <div style="font:400 112px ${KAI};letter-spacing:.14em;line-height:1.1">历史长河</div>
      <div style="margin-top:10px;font-size:36px;color:#55676C;letter-spacing:.1em">一张图，看懂各国历史</div>
      <div style="display:flex;align-items:center;gap:36px;margin-top:40px">
        <div style="width:250px;height:250px;padding:10px;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(27,42,49,.18);box-sizing:border-box"><img src="${qr}" style="width:100%;height:100%;display:block"></div>
        <div style="font-size:50px;font-weight:700">${URL_SHOW}<div style="margin-top:14px;font-size:30px;font-weight:400;color:#55676C;letter-spacing:.06em">扫码看韩信的关系图</div>
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

/* ---------- 开头的游戏图片：铺满画面（位置同第一屏），朝人物的脸缓慢推近（同韩信第一篇横版） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]scale=${IMGW}:${H}:flags=lanczos,crop=${W}:${H}:${IMGX}:0,scale=${W * 2}:${H * 2}:flags=lanczos,`
  + `zoompan=z='1+0.08*on/${N}':x='iw*0.66-(iw/zoom*0.66)':y='ih*0.3-(ih/zoom*0.3)':d=1:s=${W}x${H}:fps=30[fg];`
  + `[fg][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 字幕：断句和对时同竖版；横版放在画面下方正中 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01', landscape: true });

/* ---------- 文字卡的出现、消失时间（同竖版） ---------- */
const tOf = ([id, snip]) => (snip ? at(id) + VOLEAD + VO[id].dur * fracBefore(SHOT[id].say, snip) - 0.15 : at(id));
const qt = QUOTES.map((q, i) => {
  const a = tOf(q.on), nx = QUOTES[i + 1];
  const b = q.off ? at(q.off) - 0.1 : nx ? tOf(nx.on) : at('n12') - 0.1;
  return { a, b, cross: !q.off && !!nx };
});
fs.writeFileSync(path.join(OUT, 'quotes.txt'), QUOTES.map((q, i) => `${qt[i].a.toFixed(2)} → ${qt[i].b.toFixed(2)}  ${q.book}  ${q.text.replace(/\//g, '')}`).join('\n'));

/* ---------- 合成 ---------- */
// 输入：0 录屏，1 开头，2 结尾卡，3… 文字卡，再后是旁白，最后是音乐
const T = TOTAL.toFixed(3), tEnd = at('n12') - 0.1, tIntro = at('n02') - 0.15;
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
