// 时间长河页面取用的数据：/data/zh.json。构建时由 data/ 与 locales/ 合成。
// 数据量大了以后，在这里按文明、时期切成小块（见 docs/plan.md 第 6 节）。
import { LANGS, build } from '../../lib/dataset.mjs';

export function getStaticPaths() {
  return LANGS.map(l => ({ params: { lang: l.code } }));
}

export function GET({ params }) {
  return new Response(JSON.stringify(build(params.lang)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
