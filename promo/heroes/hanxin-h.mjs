// 《峡谷之外》韩信一集·横版（1920×1080）：内容、旁白、配音与竖版（hanxin.mjs）相同，网站画面换成桌面版。
// 用法：node promo/heroes/hanxin-h.mjs [--still] [--music <音乐文件>]
//   先做三件事：仓库根目录 npm run build；配音沿用竖版的（promo/out/heroes/hanxin/voice/，见 hanxin.yaml 开头）；
//   node promo/heroes/map.mjs hanxin-zhan 画地图（竖版用的同一张）。
//   --still：不录像，每段结束截一张图到 promo/out/heroes/hanxin/h/stills/，用来检查位置。
// 成片：promo/out/heroes/hanxin/hanxin-landscape.mp4（不进仓库）；中间文件都在 promo/out/heroes/hanxin/h/，不碰竖版的文件。
// 视频文件先在系统临时目录里生成，最后复制过来并整段解码检查（E 盘直接写会偶尔写坏，见 episode.mjs 的 checkVideo）。
// 做法同兰陵王横版（lanling-h.mjs）：本机 Chrome 以 1920×1080、字号 1.3 档打开 dist/ 的桌面版，画出假鼠标，一镜到底录下来，
// 每段的长短跟着旁白走；游戏图片、地图、结尾卡是合成时盖在录屏上面的。桌面版的动作在 episode.mjs 的 openDesktop() 里。
// 旁白文字是定稿，这里只对照检查，不改。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';
import {
  HERE, PROMO, DIST, PAPER, CREDIT, VOLEAD, sleep, loadNarration, requireFiles, serveDist, openDesktop, DW as W, DH as H,
  makeTimeline, fracBefore, startScreencast, framesToVideo, renderPages, dataUrl, writeSubs, prependCover, copyChecked,
} from './episode.mjs';

const SRC = path.join(PROMO, 'out', 'heroes', 'hanxin');
const OUT = path.join(SRC, 'h');
const VOICE = path.join(SRC, 'voice');   // 竖版做好的配音，直接复用
const IMG = path.join(PROMO, 'out', 'heroes', 'img', '150-bigskin-1.jpg');   // 官方图片（默认造型，横版 1920×882），不进仓库
const MAP = path.join(PROMO, 'out', 'heroes', 'maps', 'hanxin-zhan.png');
const FINAL = path.join(SRC, 'hanxin-landscape.mp4');
const WORK = path.join(os.tmpdir(), 'xiagu-hanxin-h');   // 录屏、开头、正片、成片先写在这里
const argv = process.argv.slice(2), STILL = argv.includes('--still');
const MUSIC = argv.includes('--music') ? argv[argv.indexOf('--music') + 1] : null;
// 结尾卡的二维码直接打开韩信的关系图；卡上显示的网址仍是首页
const URL_QR = 'https://lishi.alz-ai.cn/zh/#person/han-xin', URL_SHOW = 'lishi.alz-ai.cn';
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
fs.mkdirSync(WORK, { recursive: true });
requireFiles([IMG, MAP, path.join(VOICE, 'timing.json'), path.join(DIST, 'zh', 'index.html')], '见本文件开头的用法');

/* ---------- 旁白、片尾小字：对照定稿（同竖版） ---------- */
const SHOTS = loadNarration(path.join(HERE, 'hanxin.yaml'), '## 一、', 13);
const SOURCES = (() => {
  const md = fs.readFileSync(path.join(HERE, 'scripts.md'), 'utf8'), i = md.indexOf('## 一、');
  const row = md.slice(i, md.indexOf('配地图：', i)).split('\n').find(l => l.startsWith('|') && l.includes('不念'));
  return row.split('|')[2].trim();
})();
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const VO = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(VOICE, 'timing.json'), 'utf8')).shots.map(s => [s.id, s]));
for (const s of SHOTS) if (!VO[s.id]) { console.error('配音里缺少 ' + s.id + '，改了 hanxin.yaml 要重新配音'); process.exit(1); }

/* ---------- 打开网站（桌面版） ---------- */
const { server, base: BASE } = await serveDist();
const dk = await openDesktop();
const { browser, page, cdp, cursor, glide, click, clickSel, wheel, bar, link, scrollCard, pointAt, expectSel, type } = dk;

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
// 卡片里点某个事件（先把它滚到看得见的地方）
async function goEvent(id, ms = 600) {
  await scrollCard(`sel:[data-goe="${id}"]`, 450, 380); await sleep(150);
  await clickSel(`#detail [data-goe="${id}"]`, 90, ms); await sleep(750);
  await expectSel('event/' + id);
}
// 从事件卡返回刚才的人物：卡片回到开头，点左上角“返回”
async function back(id) {
  await scrollCard(null, 300); await sleep(100);
  await clickSel('#detail .d-back', 50, 500); await sleep(750);
  await expectSel('person/' + id);
}
// 时间轴上点某人的生卒条（露在外面的那一段靠左处）
async function clickBar(id, ms = 900) {
  const b = await bar(id); if (b.x2 - b.x1 < 40) throw new Error(id + ' 的生卒条在屏幕外');
  await click(b.x1 + Math.min(80, (b.x2 - b.x1) / 2), b.y, ms); await sleep(800);
  await expectSel('person/' + id);
}

async function act() {
  // 1. 游戏图片（合成时盖在上面），网站停在全貌
  await mark('n01');

  // 2. 搜索“韩信”，点第一条：时间轴飞到秦汉之际，右边出人物卡，关系线连出来
  await mark('n02');
  await cursor(true); await sleep(300);
  await clickSel('#find', null, 650); await sleep(300);
  await type('韩信');
  await sleep(400); await snap('02a-search');
  await clickSel('.search .s-row[data-id="han-xin"]', 110, 500); await sleep(1100);
  await expectSel('person/han-xin');
  await dk.measure();
  await snap('02-focus');

  // 3. 人物卡：项梁、项羽，献策不被采用，投汉，逃走
  await mark('n03');
  await sleep(200); await pointAt('屡次献策不被采用', 900); await snap('03a-card');
  await until(0.55); await pointAt('中途逃走', 900); await snap('03-taozou');

  // 4. 萧何：鼠标移到时间轴上前 206 年“举荐”那条线，滚轮放大；点萧何，卡片滚到追回韩信那一句
  await mark('n04');
  await sleep(200);
  { const [x, y] = await link('xiao-he'); await glide(x, y, 1100); await sleep(250); await wheel(-260, 1500); }
  await sleep(300); await snap('04a-zoom');
  await clickBar('xiao-he', 900);
  await sleep(300); await scrollCard('韩信逃亡，萧何亲自追回', 1300, 60);
  await pointAt('韩信逃亡，萧何亲自追回', 800); await snap('04-zhuihui');

  // 5a. 地图盖在左边的时间轴上（右边人物卡照常露出）。点回韩信，卡片滚到“东出陈仓”
  await mark('n05a');
  await sleep(150);
  await clickBar('han-xin', 700);
  await scrollCard('同年八月汉军东出陈仓', 700, 60); await pointAt('同年八月汉军东出陈仓', 600); await snap('05a-chencang');
  // 5b. 念到“背水列阵”时点开事件“井陉背水一战”；念到“袭取齐国”时换到“垓下之战”
  await mark('n05b');
  await until(fracBefore(SHOT.n05b.say, '背水列阵') - 0.12);
  await goEvent('jingxing', 550); await pointAt('背水列阵', 500); await snap('05b-jingxing');
  await until(fracBefore(SHOT.n05b.say, '袭取齐国'));
  await back('han-xin');
  await goEvent('gaixia', 550); await pointAt('各路军队会于垓下', 500); await snap('05c-gaixia');

  // 6. 回到韩信的人物卡：“项羽死后，高祖夺其军”……“降为淮阴侯”
  await mark('n06');
  await back('han-xin');
  await scrollCard('项羽死后', 1200, 60); await pointAt('高祖夺其军', 800); await snap('06a-duojun');
  await until(0.6); await pointAt('降为淮阴侯', 800); await snap('06-huaiyinhou');

  // 7–10. 事件“韩信被杀”：鼠标跟着旁白一句一句往下指
  await mark('n07');
  await goEvent('hanxin-death', 700); await snap('07a-event');
  await sleep(300); await scrollCard('汉十年陈豨果然反叛', 1200, 60); await pointAt('高祖亲自领兵出征', 800);
  await until(0.5); await pointAt('舍人的弟弟向吕后告发', 800); await snap('07-chenxi');
  await mark('n08');
  await sleep(200); await scrollCard('吕后想召韩信', 1200, 60); await pointAt('吕后想召韩信', 800);
  await until(0.45); await pointAt('谎称高祖那里有使者来', 800); await snap('08-shangliang');
  await mark('n09');
  // “虽疾，”在上一行行尾，鼠标指下一行的“强入贺”
  await until(0.3); await pointAt('强入贺', 800); await snap('09-qiangruhe');
  await mark('n10');
  await sleep(200); await pointAt('韩信一入宫', 800);
  await until(0.45); await pointAt('在长乐宫钟室斩杀', 800); await snap('10-zhongshi');

  // 11. 刘邦：在时间轴上点“汉高祖”，卡片滚到“异姓诸侯王韩信……相继被废被杀”
  await mark('n11');
  await sleep(150);
  await clickBar('liu-bang', 900);
  await sleep(200); await scrollCard('在位期间', 1300, 60); await pointAt('相继被废被杀', 800); await snap('11-liubang');

  // 12. 点回韩信：韩信、汉高祖、吕后、萧何同屏，连线都连在他身上；滚轮放大到“举荐”到“诛杀”这一段。
  //     鼠标先停在前 206 年萧何“举荐”那条线上，念到“骗他进宫”时移到前 196 年“诛杀”那条线上
  await mark('n12');
  await sleep(150);
  await clickBar('han-xin', 900);
  { const a = await link('xiao-he'), b = await link('lv-zhi');
    await glide((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 900); await sleep(200); await wheel(-200, 1300); }
  await sleep(200);
  { const a = await link('xiao-he'); await glide(a[0], a[1], 900); }
  await until(fracBefore(SHOT.n12.say, '骗他进宫'));
  { const b = await link('lv-zhi'); await glide(b[0], b[1], 1000); }
  await snap('12-sitong');

  // 13. 结尾卡（合成时盖在上面）
  await mark('n13');
  await mark(null);
}

/* ---------- 录像 ---------- */
const frames = STILL ? null : await startScreencast(cdp, W, H);
tl.t0 = Date.now();
try { await act(); } catch (e) { console.error('录制中断：', e.message); await page.screenshot({ path: path.join(OUT, 'stills', 'error.png') }); await browser.close(); server.close(); process.exit(1); }
const TOTAL = (Date.now() - tl.t0) / 1000;
if (STILL) { console.log('截图在', path.join(OUT, 'stills')); await browser.close(); server.close(); process.exit(0); }
await cdp.send('Page.stopScreencast');
await browser.close(); server.close();
const marks = tl.marks, at = tl.at;
console.log(`录制 ${TOTAL.toFixed(1)}s，${frames.length} 帧`);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify({ total: TOTAL, marks }, null, 1));
framesToVideo(frames, TOTAL, WORK, 'screen.mp4', W, H);

/* ---------- 各张底图：用浏览器画（1920×1080） ---------- */
// 官方横版图 1920×882，放大到 1080 高（2351 宽），左移 IMGX：人物的脸在画面偏右，左边暗处放字
const IMGX = 230, IMGW = Math.round(1920 * H / 882), DX = dk.detailX;
const qr = await QRCode.toDataURL(URL_QR, { errorCorrectionLevel: 'Q', margin: 2, width: 720, color: { dark: '#1B2A31', light: '#FFFFFF' } });
const KAI = "'STKaiti','KaiTi',serif";
// 片尾小字在“《史记正义》，”后面换行，两行差不多长
const srcHtml = SOURCES.replace('《史记正义》，', '《史记正义》，<br>');
const SHADE = `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,18,22,.92) 0,rgba(13,18,22,.78) 32%,rgba(13,18,22,0) 60%)"></div>`;
const SERIES = `<div style="position:absolute;left:110px;top:150px;font:400 84px ${KAI};letter-spacing:14px">峡谷之外</div>
    <div style="position:absolute;left:114px;top:258px;font-size:32px;letter-spacing:7px;color:#d8c9a8">王者荣耀人物的真实历史</div>`;
const SUBTITLE = `<div style="position:absolute;left:116px;top:690px;font:700 62px 'Microsoft YaHei';letter-spacing:4px;color:#e8c27a">追他回来的人，送他去死</div>`;
const CREDIT_TAG = `<div style="position:absolute;right:30px;bottom:24px;font-size:24px;letter-spacing:1px;color:rgba(241,236,224,.85)">${CREDIT}</div>`;
await renderPages({
  // 封面：成片第一帧（社交平台上显示的就是它）。官方图片铺满，左边压暗放片名
  cover: `<body style="background:#0d1216;color:#fff;font-family:'Microsoft YaHei'">
    <img src="${dataUrl(IMG)}" style="position:absolute;left:-${IMGX}px;top:0;height:${H}px">${SHADE}
    <div style="position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(transparent,rgba(13,18,22,.7))"></div>
    ${SERIES}
    <div style="position:absolute;left:100px;top:420px;font:700 200px ${KAI};letter-spacing:20px;text-shadow:0 6px 30px rgba(0,0,0,.6)">悲情韩信</div>
    ${SUBTITLE}${CREDIT_TAG}
  </body>`,
  // 开头：盖在推近的游戏图片上的字。系列名、副标题、图片出处和封面在同一位置（封面淡入这里时字不重影），大字“悲情韩信”换成第一句旁白的字幕
  intro: `<body style="background:transparent;color:#fff;font-family:'Microsoft YaHei'">${SHADE}
    <div style="position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(transparent,rgba(13,18,22,.8))"></div>
    ${SERIES}${SUBTITLE}${CREDIT_TAG}
  </body>`,
  // 地图：盖住左边的时间轴，右边的人物卡和顶栏照常；字幕在下方。竖版那张 hanxin-zhan（1080×760）放大到 1180 宽
  mapcard: `<body style="background:transparent">
    <div style="position:absolute;left:0;top:58px;width:${DX}px;bottom:0;background:${PAPER}"></div>
    <img src="${dataUrl(MAP)}" style="position:absolute;left:${Math.round((DX - 1180) / 2)}px;top:84px;width:1180px;border-radius:22px;box-shadow:0 14px 40px rgba(27,42,49,.22);border:2px solid #d9cdb4">
  </body>`,
  // 结尾卡：左边电脑画面（韩信的关系图），右边二维码和网址；下面小字是核实过的史料（只显示、不念）；最下面留给字幕
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
    <div style="position:absolute;left:60px;right:60px;top:790px;text-align:center;font-size:26px;line-height:1.5;color:#5f6c6f">${srcHtml}</div>
  </body>`,
}, OUT, ['end', 'cover'], W, H);

/* ---------- 开头的游戏图片：铺满画面，缓慢推近（朝人物的脸） ---------- */
const introLen = at('n02') + 0.6, N = Math.round(introLen * 30);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', '30', '-t', introLen.toFixed(3), '-i', IMG, '-i', path.join(OUT, 'intro.png'), '-filter_complex',
  `[0:v]scale=${IMGW}:${H}:flags=lanczos,crop=${W}:${H}:${IMGX}:0,scale=${W * 2}:${H * 2}:flags=lanczos,`
  + `zoompan=z='1+0.08*on/${N}':x='iw*0.66-(iw/zoom*0.66)':y='ih*0.3-(ih/zoom*0.3)':d=1:s=${W}x${H}:fps=30[fg];`
  + `[fg][1:v]overlay=0:0,format=yuv420p`,
  '-t', introLen.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', path.join(WORK, 'intro.mp4')]);

/* ---------- 字幕：断句和对时同竖版；横版放在画面下方正中 ---------- */
writeSubs({ marks, shot: SHOT, vo: VO, voiceDir: VOICE, total: TOTAL, outDir: OUT, introId: 'n01', landscape: true });

/* ---------- 合成 ---------- */
// 输入：0 录屏，1 开头，2 地图，3 结尾卡，4… 旁白，最后是音乐
const T = TOTAL.toFixed(3), tMap0 = at('n05a') - 0.1, tMap1 = at('n06') - 0.3, tEnd = at('n13') - 0.1, tIntro = at('n02') - 0.15;
const args = ['-y', '-loglevel', 'error', '-i', path.join(WORK, 'screen.mp4'), '-i', path.join(WORK, 'intro.mp4'),
  '-loop', '1', '-framerate', '30', '-t', T, '-i', 'mapcard.png', '-loop', '1', '-framerate', '30', '-t', T, '-i', 'end.png'];
marks.forEach(m => args.push('-i', path.join(VOICE, VO[m.id].file)));
if (MUSIC) args.push('-i', path.resolve(MUSIC));
const vf = `[0:v]fps=30,format=yuv420p[a];`
  + `[1:v]format=rgba,fade=out:st=${tIntro.toFixed(3)}:d=0.45:alpha=1[in];[a][in]overlay=0:0:eof_action=pass[c];`
  + `[2:v]format=rgba,fade=in:st=${tMap0.toFixed(3)}:d=0.35:alpha=1,fade=out:st=${tMap1.toFixed(3)}:d=0.35:alpha=1[mp];[c][mp]overlay=0:0[d];`
  + `[3:v]format=rgba,fade=in:st=${tEnd.toFixed(3)}:d=0.5:alpha=1[end];[d][end]overlay=0:0,subtitles=subs.ass,`
  + `fade=out:st=${(TOTAL - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
// 旁白、音乐的处理同竖版：每段在字幕出现后 VOLEAD 秒开始；音乐压低，有人声时再自动让一让
const vo = marks.map((m, i) => `[${4 + i}:a]aresample=48000,adelay=${Math.round((m.at + VOLEAD) * 1000)}:all=1[v${i}]`);
let af = `;${vo.join(';')};${marks.map((_, i) => `[v${i}]`).join('')}amix=inputs=${marks.length}:normalize=0,apad,atrim=0:${T},asplit=2[narr][key]`;
if (MUSIC) {
  const mi = 4 + marks.length;
  af += `;[${mi}:a]aresample=48000,atrim=0:${T},volume=0.26,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.5).toFixed(3)}:d=2.5[mu]`
    + `;[mu][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]`
    + `;[narr][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
} else af += `;[narr]loudnorm=I=-15:TP=-1.5:LRA=11[au]`;
args.push('-filter_complex', vf + af, '-map', '[v]', '-map', '[au]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-t', T, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', path.join(WORK, 'body.mp4'));
execFileSync('ffmpeg', args, { cwd: OUT });

/* ---------- 片头封面：第一帧就是封面，停 1 秒后淡入正片（同竖版） ---------- */
const FULL = prependCover({ outDir: OUT, coverPng: 'cover.png', body: path.join(WORK, 'body.mp4'), out: path.join(WORK, 'final.mp4'), total: TOTAL });
copyChecked(path.join(WORK, 'final.mp4'), FINAL);
fs.rmSync(WORK, { recursive: true, force: true });
console.log('成片：', FINAL, FULL + 's');
