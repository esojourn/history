"""旁白配音：按 narration.yaml 每个镜头合成一段语音，写到 out/voice/。

用法：
  python promo/tts.py                     # 默认引擎见 .env 的 TTS_ENGINE，没有就用 edge（占位）
  python promo/tts.py --engine volc --voice <音色>    # 火山引擎·豆包语音合成大模型
  python promo/tts.py --engine edge --voice zh-CN-YunxiNeural
  python promo/tts.py --sample             # 只合成第一个镜头，用来试听音色（文件名带音色名）
  python promo/tts.py --engine volc --yaml mobile-narration.yaml --out out/mdemo/voice   # 手机版演示的旁白

火山引擎的密钥写在 promo/.env（不提交）：
  VOLC_APPID=...
  VOLC_TOKEN=...
  VOLC_VOICE=...   # 选定的音色，可选
"""
import argparse, asyncio, base64, json, os, pathlib, subprocess, sys, uuid, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / 'out' / 'voice'


def load_env():
    env = {}
    f = ROOT / '.env'
    if f.exists():
        for line in f.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env


def load_shots(name='narration.yaml'):
    # narration.yaml 结构简单，不额外装 pyyaml：交给 node 的 yaml 包解析
    js = "const Y=require('yaml');const fs=require('fs');process.stdout.write(JSON.stringify(Y.parse(fs.readFileSync(process.argv[1],'utf8'))))"
    r = subprocess.run(['node', '-e', js, str(ROOT / name)], cwd=ROOT, capture_output=True, check=True)
    return json.loads(r.stdout.decode('utf-8'))['shots']


def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


async def edge(text, voice, rate, path):
    import edge_tts
    await edge_tts.Communicate(text, voice, rate=rate).save(str(path))


def volc(text, voice, speed, path, env):
    if env.get('api_key'):
        return volc3(text, voice, speed, path, env)
    body = {
        'app': {'appid': env['VOLC_APPID'], 'token': env['VOLC_TOKEN'], 'cluster': env.get('VOLC_CLUSTER', 'volcano_tts')},
        'user': {'uid': 'history-promo'},
        'audio': {'voice_type': voice, 'encoding': 'mp3', 'speed_ratio': speed, 'loudness_ratio': 1.0},
        'request': {'reqid': str(uuid.uuid4()), 'text': text, 'operation': 'query'},
    }
    req = urllib.request.Request('https://openspeech.bytedance.com/api/v1/tts', data=json.dumps(body).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer;' + env['VOLC_TOKEN']})
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.loads(r.read().decode('utf-8'))
    if res.get('code') != 3000 or not res.get('data'):
        sys.exit(f"火山引擎返回错误：{res.get('code')} {res.get('message')}")
    path.write_bytes(base64.b64decode(res['data']))


def volc3(text, voice, speed, path, env):
    """火山引擎新版控制台的 API Key：V3 单向流式接口，逐段返回 base64 音频。
    *_uranus_bigtts 音色属于豆包语音合成 2.0（资源 seed-tts-2.0），其余默认 seed-tts-1.0。"""
    rid = env.get('resource_id') or ('seed-tts-2.0' if 'uranus' in voice else 'seed-tts-1.0')
    rate = round((speed - 1) * 100)   # speech_rate：-50～100，0 为正常语速
    body = {'user': {'uid': 'history-promo'},
            'req_params': {'text': text, 'speaker': voice,
                           'audio_params': {'format': 'mp3', 'sample_rate': 24000, 'speech_rate': rate}}}
    req = urllib.request.Request('https://openspeech.bytedance.com/api/v3/tts/unidirectional', data=json.dumps(body).encode('utf-8'),
                                 headers={'Content-Type': 'application/json', 'X-Api-Key': env['api_key'],
                                          'X-Api-Resource-Id': rid, 'X-Api-Request-Id': str(uuid.uuid4())})
    audio = bytearray()
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            for line in r:
                line = line.strip()
                if not line:
                    continue
                msg = json.loads(line.decode('utf-8'))
                if msg.get('data'):
                    audio += base64.b64decode(msg['data'])
                code = msg.get('code', 0)
                if code not in (0, 20000000):
                    sys.exit(f"火山引擎返回错误：{code} {msg.get('message')}")
    except urllib.error.HTTPError as e:
        sys.exit(f"火山引擎 HTTP {e.code}：{e.read().decode('utf-8', 'replace')[:300]}")
    if not audio:
        sys.exit('火山引擎没有返回音频')
    path.write_bytes(bytes(audio))


def main():
    env = load_env()
    ap = argparse.ArgumentParser()
    ap.add_argument('--engine', default=env.get('TTS_ENGINE', 'edge'), choices=['edge', 'volc'])
    ap.add_argument('--voice')
    ap.add_argument('--rate', default='+8%', help='edge 的语速，如 +8%%')
    ap.add_argument('--speed', type=float, default=1.1, help='火山引擎的语速倍数')
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--yaml', default='narration.yaml', help='旁白稿，相对 promo/')
    ap.add_argument('--out', default='out/voice', help='输出目录，相对 promo/')
    a = ap.parse_args()
    global OUT
    OUT = ROOT / a.out
    voice = a.voice or ((env.get('VOLC_VOICE') or env.get('speak_id')) if a.engine == 'volc' else None) or ('zh-CN-YunxiNeural' if a.engine == 'edge' else None)
    if not voice:
        sys.exit('请用 --voice 指定火山引擎音色')

    OUT.mkdir(parents=True, exist_ok=True)
    shots = load_shots(a.yaml)
    if a.sample:
        shots = shots[:2]
    timing = []
    for s in shots:
        # 行尾没有标点的，念的时候补一个逗号停顿
        text = s.get('say') or ''.join(l if i == len(s['lines']) - 1 or l[-1] in '，。？！；：、—…' else l + '，' for i, l in enumerate(s['lines']))
        name = f"{s['id']}__{voice}.mp3" if a.sample else f"{s['id']}.mp3"
        path = OUT / name
        if a.engine == 'edge':
            asyncio.run(edge(text, voice, a.rate, path))
        else:
            volc(text, voice, a.speed, path, env)
        d = duration(path)
        timing.append({'id': s['id'], 'file': name, 'dur': round(d, 3)})
        print(f"{s['id']}: {d:.2f}s  {text}")
    if not a.sample:
        (OUT / 'timing.json').write_text(json.dumps({'engine': a.engine, 'voice': voice, 'shots': timing}, ensure_ascii=False, indent=1), encoding='utf-8')
        print('合计', round(sum(t['dur'] for t in timing), 2), 's')


if __name__ == '__main__':
    main()
