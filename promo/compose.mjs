// 合成成片：镜头交叉淡化、开头叠片名、结尾卡、烧录字幕、旁白按镜头对齐、背景音乐（旁白时自动压低）。
// 用法：node promo/compose.mjs [--music 音乐文件] [--out 文件名]
// 输入：out/shots/*.mp4（record.mjs）、out/voice/*.mp3 + timing.json（tts.py）、out/cards/*.png（cards.mjs）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MUSIC = arg('--music'), NAME = arg('--out') || 'history-promo.mp4';
const XF = 0.3, LEAD = 0.15;   // 转场时长；每段旁白比画面晚开始多少秒

const nar = YAML.parse(fs.readFileSync(path.join(ROOT, 'narration.yaml'), 'utf8')).shots;
const timing = JSON.parse(fs.readFileSync(path.join(OUT, 'voice', 'timing.json'), 'utf8')).shots;
const shots = nar.map(s => { const t = timing.find(x => x.id === s.id); return { ...s, voice: path.join(OUT, 'voice', t.file), vdur: t.dur, D: t.dur + s.pad + LEAD }; });
let acc = 0;
for (const s of shots) { s.S = acc; acc += s.D; }
const TOTAL = acc;
const probe = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();

/* ---------- 字幕（ASS）：每段旁白按字数分配各行的时间 ---------- */
const ts = t => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = (t % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${s}`; };
const weight = l => l.replace(/[，。；：！？、——…“”]/g, '').length + 0.6;   // 标点处有停顿，略加一点
const ev = [];
for (const s of shots) {
  const W = s.lines.reduce((a, l) => a + weight(l), 0);
  let t = s.S + LEAD;
  s.lines.forEach((l, k) => {
    const d = (s.vdur * weight(l)) / W, last = k === s.lines.length - 1;
    // 同一段里前后两行首尾相接，不重叠（重叠会叠成两行）；每段最后一行多停一会儿
    ev.push(`Dialogue: 0,${ts(t)},${ts(t + d + (last ? Math.min(0.35, s.pad) : 0))},Sub,,0,0,0,,${l.replace(/——$/, '—')}`);
    t += d;
  });
}
fs.writeFileSync(path.join(OUT, 'subs.ass'), `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,52,&H00FFFFFF,&H00FFFFFF,&H5A1B2A31,&H5A1B2A31,1,0,0,0,100,100,2,0,3,14,0,2,80,80,64,134

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join('\n')}
`);

/* ---------- 视频 ---------- */
const inputs = [], f = [];
const add = (...a) => { inputs.push(...a); return inputs.filter(x => x === '-i').length - 1; };
const vid = { 's1-hook': 's1-hook', 's2-zoom': 's2-zoom', 's3-person': 's3-person', 's4-parallel': 's4-parallel', 's6-search': 's6-search' };
const labels = [];
shots.forEach((s, i) => {
  const L = s.D + (i < shots.length - 1 ? XF : 0);
  if (s.id === 's5-event') {
    const a = add('-i', path.join(OUT, 'shots', 's5a-event.mp4')), b = add('-i', path.join(OUT, 'shots', 's5b-page.mp4'));
    const la = probe(path.join(OUT, 'shots', 's5a-event.mp4')) - 0.3;
    f.push(`[${a}:v]trim=0:${la.toFixed(3)},setpts=PTS-STARTPTS,fps=30,format=yuv420p[s5a]`, `[${b}:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p[s5b]`,
      `[s5a][s5b]xfade=transition=fade:duration=${XF}:offset=${(la - XF).toFixed(3)},trim=0:${L.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
  } else if (s.id === 's7-end') {
    const e = add('-loop', '1', '-framerate', '30', '-t', L.toFixed(3), '-i', path.join(OUT, 'cards', 'end.png'));
    // 结尾卡缓慢推近一点点，不至于死板
    f.push(`[${e}:v]scale=2112:1188,zoompan=z='1+0.035*on/${Math.round(L * 30)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30,format=yuv420p,trim=0:${L.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
  } else {
    const v = add('-i', path.join(OUT, 'shots', vid[s.id] + '.mp4'));
    const have = probe(path.join(OUT, 'shots', vid[s.id] + '.mp4'));
    // 录得比需要的短，就把最后一帧停住补足
    const pad = Math.max(0, L - have + 0.05);
    f.push(`[${v}:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p${pad > 0 ? `,tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)}` : ''},trim=0:${L.toFixed(3)},setpts=PTS-STARTPTS[v${i}${s.id === 's1-hook' ? 'raw' : ''}]`);
    if (s.id === 's1-hook') {
      const t = add('-loop', '1', '-framerate', '30', '-t', L.toFixed(3), '-i', path.join(OUT, 'cards', 'title.png'));
      const st = Math.min(1.9, s.D - 1.6);
      f.push(`[${t}:v]format=rgba,fade=in:st=${st.toFixed(2)}:d=0.45:alpha=1[ttl]`, `[v${i}raw][ttl]overlay=0:0:format=auto,format=yuv420p[v${i}]`);
    }
  }
  labels.push(`v${i}`);
});
// xfade 要求两边都是恒定帧率、同一时基
labels.forEach((l, i) => f.push(`[${l}]fps=30,settb=AVTB,setsar=1[c${i}]`));
let cur = 'c0';
for (let i = 1; i < labels.length; i++) {
  const o = i === labels.length - 1 ? 'vcat' : `x${i}`;
  f.push(`[${cur}][c${i}]xfade=transition=fade:duration=${XF}:offset=${shots[i].S.toFixed(3)}[${o}]`);
  cur = o;
}
f.push(`[vcat]fade=in:st=0:d=0.4,fade=out:st=${(TOTAL - 0.7).toFixed(3)}:d=0.7,subtitles=subs.ass[vout]`);

/* ---------- 音频 ---------- */
const va = shots.map((s, i) => {
  const a = add('-i', s.voice), ms = Math.round((s.S + LEAD) * 1000);
  f.push(`[${a}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[n${i}]`);
  return `[n${i}]`;
});
f.push(`${va.join('')}amix=inputs=${va.length}:normalize=0,apad,atrim=0:${TOTAL.toFixed(3)},volume=1.0[narr]`);
if (MUSIC) {
  // 曲子比片子短：接一遍自己，接缝处交叉淡化 2.5 秒，不会听出硬接
  const md = probe(path.resolve(MUSIC)), m = add('-i', path.resolve(MUSIC));
  let src = `[${m}:a]aresample=48000,aformat=channel_layouts=stereo`;
  if (md < TOTAL + 0.5) { const m2 = add('-i', path.resolve(MUSIC)); f.push(`${src}[ma]`, `[${m2}:a]aresample=48000,aformat=channel_layouts=stereo[mb]`); src = `[ma][mb]acrossfade=d=2.5`; }
  f.push(`[narr]asplit=2[nk][nm]`,
    `${src},atrim=0:${TOTAL.toFixed(3)},volume=0.32,afade=in:st=0:d=1,afade=out:st=${(TOTAL - 2.2).toFixed(3)}:d=2.2[mu]`,
    `[mu][nk]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=450:makeup=1[duck]`,
    `[nm][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[aout]`);
} else {
  f.push(`[narr]loudnorm=I=-15:TP=-1.5:LRA=11[aout]`);
}

const out = path.join(OUT, NAME);
fs.writeFileSync(path.join(OUT, 'filter.txt'), f.join(';\n'));
console.log(`镜头 ${shots.length} 段，总长 ${TOTAL.toFixed(2)}s${MUSIC ? '，背景音乐 ' + path.basename(MUSIC) : '，无背景音乐'}`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex_script', 'filter.txt', '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart', '-t', TOTAL.toFixed(3), out], { cwd: OUT, stdio: 'inherit' });
console.log('成片 →', path.relative(process.cwd(), out), '时长', probe(out).toFixed(2), 's');
