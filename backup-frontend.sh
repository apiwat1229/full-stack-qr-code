#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/.backups}"
LOG_FILE="${LOG_FILE:-$BACKUP_DIR/backup.log}"
TS="$(date +%Y%m%d_%H%M%S)"
NAME="fuse-nextjs_${TS}.tar.gz"
OUT="${BACKUP_DIR}/${NAME}"

mkdir -p "$BACKUP_DIR"

echo "== BACKUP ${TS} ==" | tee -a "$LOG_FILE"
echo "📦 $OUT" | tee -a "$LOG_FILE"

# ตัดของหนัก/ไม่จำเป็นออก และกัน recursion ของ .backups เอง
EXCLUDES=( --exclude=./.git --exclude=./.next --exclude=./.turbo --exclude=./node_modules --exclude=./dist --exclude=./coverage --exclude=./.DS_Store --exclude=./.backups )

# ถ้าต้องการรวม node_modules ให้รันด้วย FULL=1
if [[ "${FULL:-0}" == "1" ]]; then
  EXCLUDES=( --exclude=./.git --exclude=./.next --exclude=./.turbo --exclude=./dist --exclude=./coverage --exclude=./.DS_Store --exclude=./.backups )
  echo "⚠️ FULL=1 -> รวม node_modules" | tee -a "$LOG_FILE"
fi

tar -C "$PROJECT_DIR" -czf "$OUT" "${EXCLUDES[@]}" ./ 2>>"$LOG_FILE"
shasum -a 256 "$OUT" > "${OUT}.sha256"
echo "✅ DONE: $OUT" | tee -a "$LOG_FILE"
