#!/usr/bin/env bash
# 历史长河 · 服务器上的更新部署脚本
#
# 用法（在服务器上以 root 执行）：
#   history-update               更新到 GitHub main 分支最新版本
#   history-update <提交哈希>     发布指定的某个提交
#   history-update list          列出服务器上保留的版本，标出当前版本
#   history-update rollback      回到上一个版本
#   history-update rollback <哈希> 回到指定版本
#
# 做法：在 /var/www/history/src 保留一份代码，拉取最新代码后构建，
# 放进 releases/<短哈希>/，再把 current 软链接指过去（nginx 读 current）。
# 只保留最近 KEEP 个版本，当前版本永远不删。

set -euo pipefail

REPO_URL="https://github.com/esojourn/history.git"
BRANCH="main"
BASE="/var/www/history"
SRC="$BASE/src"
RELEASES="$BASE/releases"
CURRENT="$BASE/current"
KEEP=5
DOMAINS="history.alz-ai.cn lishi.alz-ai.cn"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

current_release() { basename "$(readlink -f "$CURRENT" 2>/dev/null || echo none)"; }

# 原子地切换 current 软链接
switch_to() {
  local rel="$1"
  [ -f "$RELEASES/$rel/index.html" ] || die "版本 $rel 不存在或不完整"
  ln -sfn "$RELEASES/$rel" "$BASE/.current.tmp"
  mv -T "$BASE/.current.tmp" "$CURRENT"
  ok "当前版本已切换为 $rel"
}

# 在本机检查各域名首页是否返回 200
check_site() {
  local failed=0 code
  for d in $DOMAINS; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      --resolve "$d:443:127.0.0.1" "https://$d/" || echo 000)
    if [ "$code" = 200 ]; then ok "$d 访问正常"; else echo "✗ $d 返回 $code"; failed=1; fi
  done
  return $failed
}

# 按时间新旧列出版本目录（新的在前）
list_releases() { ls -1t "$RELEASES" 2>/dev/null | grep -v '\.tmp$' || true; }

cmd_list() {
  local cur; cur=$(current_release)
  say "服务器上的版本（新的在前）："
  list_releases | while read -r r; do
    if [ "$r" = "$cur" ]; then echo "  $r  ← 当前"; else echo "  $r"; fi
  done
}

cmd_rollback() {
  local target="${1:-}" cur; cur=$(current_release)
  if [ -z "$target" ]; then
    target=$(list_releases | grep -vx "$cur" | head -1)
    [ -n "$target" ] || die "没有可回滚的旧版本"
  fi
  say "从 $cur 回滚到 $target"
  switch_to "$target"
  check_site || die "切换后网站检查未通过，请检查 nginx"
}

prune() {
  local cur; cur=$(current_release)
  list_releases | grep -vx "$cur" | tail -n +"$KEEP" | while read -r r; do
    rm -rf "${RELEASES:?}/$r"
    echo "  已清理旧版本 $r"
  done
}

cmd_update() {
  local ref="${1:-origin/$BRANCH}" force="${2:-}"

  if [ ! -d "$SRC/.git" ]; then
    say "首次运行，克隆代码到 $SRC"
    git clone --branch "$BRANCH" "$REPO_URL" "$SRC"
  fi
  cd "$SRC"

  say "从 GitHub 拉取最新代码"
  git fetch --prune origin
  git checkout -q --detach "$ref"
  git reset -q --hard
  git clean -qfdx -e node_modules
  local hash; hash=$(git rev-parse --short=7 HEAD)
  echo "  目标版本 $hash：$(git log -1 --format=%s)"

  if [ "$hash" = "$(current_release)" ] && [ "$force" != "--force" ]; then
    ok "线上已经是 $hash，无需更新（如要重新构建：history-update $hash --force）"
    return 0
  fi

  say "安装依赖"
  npm ci --no-audit --no-fund --loglevel=error

  say "检查数据并构建"
  npm run build

  say "放置新版本 $hash"
  local tmp="$RELEASES/$hash.tmp"
  rm -rf "$tmp"
  mkdir -p "$RELEASES"
  cp -a dist "$tmp"
  rm -rf "${RELEASES:?}/$hash"
  mv "$tmp" "$RELEASES/$hash"

  local prev; prev=$(current_release)
  switch_to "$hash"
  if ! check_site; then
    if [ -d "$RELEASES/$prev" ]; then
      echo "✗ 新版本检查未通过，自动退回 $prev"
      switch_to "$prev"
    fi
    die "更新失败"
  fi

  prune
  ok "更新完成：$prev → $hash"
}

main() {
  [ "$(id -u)" = 0 ] || die "请用 root 执行"
  exec 9>"$BASE/.deploy.lock"
  flock -n 9 || die "另一个更新正在进行，请稍后再试"

  case "${1:-}" in
    list)        cmd_list ;;
    rollback)    cmd_rollback "${2:-}" ;;
    -h|--help)   sed -n '2,13p' "$0" ;;
    "")          cmd_update ;;
    --force)     cmd_update "origin/$BRANCH" --force ;;
    *)           cmd_update "$1" "${2:-}" ;;
  esac
}

# 整个脚本先读完再执行：git 更新会改写本文件，放在函数里可以避免执行到一半读到新内容
main "$@"; exit
