# 功能介绍短视频

一支 1 分钟以内的网站功能介绍视频（1920×1080，桌面版演示为主，结尾有网址和二维码）。画面是用脚本操作网站实录的，网站更新后可以一条条命令重出片。

## 重出片

需要 Node.js、Python、ffmpeg、本机 Chrome。第一次先在 `promo/` 里运行 `npm install`。

```bash
npm run build                 # 在仓库根目录：先生成最新的 dist/
python promo/tts.py --engine volc   # 1. 旁白配音 → promo/out/voice/
node promo/record.mjs         # 2. 分镜录屏 → promo/out/shots/（只录某几段：node promo/record.mjs s3 s4）
node promo/cards.mjs          # 3. 片名、结尾卡、二维码 → promo/out/cards/
node promo/compose.mjs --music <音乐文件> --out history-promo.mp4   # 4. 合成 → promo/out/
```

### 竖屏版（小红书等）

1080×1920：上方是“历史长河”标题，中间是录屏画面，下方是字幕。结尾卡的二维码和网址打了马赛克（小红书不许引导去外站），用程序确认过扫不出来。

```bash
node promo/record.mjs --portrait     # 竖屏画幅（1200×1600）重录 → promo/out/shots-v/
node promo/cards.mjs                 # 同时生成竖屏的片名、底板、结尾卡（end-v.png 打码，end-v-clear.png 不打码）
node promo/compose.mjs --portrait --music <音乐文件>   # → promo/out/history-promo-vertical.mp4
node promo/compose.mjs --portrait --clear --music <音乐文件>   # 结尾不打码 → promo/out/history-promo-vertical-qr.mp4
```

- 旁白文字和字幕分行在 [narration.yaml](narration.yaml)。改了文字要从第 1 步重来（旁白长短变了，录屏时长跟着变）。
- `node promo/record.mjs --still`：不录像，只截每个镜头的最后一帧到 `out/stills/`，用来检查位置。
- `promo/out/` 是生成的文件，不进仓库。

## 配音

火山引擎·豆包语音合成（新版控制台 API Key，V3 接口）。密钥和音色写在 `promo/.env`（不进仓库）：

```
api_key=...
speak_id=zh_female_meilinvyou_uranus_bigtts
```

`*_uranus_bigtts` 音色属于豆包语音合成 2.0，脚本自动用 `seed-tts-2.0` 资源。没有密钥时可用 `--engine edge`（微软免费语音）做占位。

## 背景音乐

候选曲目都来自 Pixabay Music 的免费曲库，使用条件以 [Pixabay 内容许可](https://pixabay.com/service/license-summary/) 原文为准（发布前请过目一遍）。

| 编号 | 曲目 | 作者 | 时长 | Content ID |
|---|---|---|---|---|
| A | [Documentary](https://pixabay.com/music/corporate-documentary-571649/) | alex-morgan | 0:51（片中接一遍） | 未登记 |
| B | [Inspiring Instrumental](https://pixabay.com/music/upbeat-inspiring-instrumental-291442/) | Kulakovka | 2:11 | 已登记 |
| C | [Upbeat Documentary](https://pixabay.com/music/adventure-upbeat-documentary-116202/) | Lexin_Music | 2:25 | 已登记 |

“Content ID 已登记”的曲子，上传到 YouTube 等使用 Content ID 的平台时可能被自动认领版权，需要到 Pixabay 申请解除；B 站、抖音、视频号等国内平台不受影响。

选定的曲目：C（Lexin_Music《Upbeat Documentary》）。成片：`node promo/compose.mjs --music <C 曲文件> --out history-promo.mp4`。
