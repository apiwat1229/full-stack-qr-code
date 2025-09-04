#!/usr/bin/env bash



# ./restore-frontend.sh          กู้จาก    “ไฟล์ล่าสุด” ไปยังโฟลเดอร์ใหม่:
# ./restore-frontend.sh --here   กู้จากไฟล์ล่าสุด ทับโปรเจ็กต์ปัจจุบัน:
# ./restore-frontend.sh ./.backups/fuse-nextjs_20250903_090626.tar.gz ~/Desktop/restore-test  ระบุไฟล์/ปลายทางเอง:

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_DIR="$PROJECT_DIR/.backups"

usage() {
  echo "ใช้งาน: $0 [ไฟล์.tar.gz] [TARGET_DIR|--here]"
  echo " - ไม่ระบุไฟล์: จะใช้ไฟล์ล่าสุดใน $DEFAULT_DIR"
  echo " - --here: กู้ทับโปรเจ็กต์ปัจจุบัน (กันลบ .backups/, node_modules/, .next/)"
}

TGZ="${1:-}"
if [[ -z "$TGZ" ]]; then
  TGZ="$(ls -t "$DEFAULT_DIR"/fuse-nextjs_*.tar.gz 2>/dev/null | head -n 1 || true)"
fi
[[ -f "${TGZ:-/nope}" ]] || { echo "❌ ไม่พบไฟล์แบ็กอัพ"; usage; exit 1; }

TS="$(date +%Y%m%d_%H%M%S)"
TARGET_DEFAULT="$(dirname "$PROJECT_DIR")/Fuse-nextjs_restored_${TS}"

ARG2="${2:-}"
if [[ "$ARG2" == "--here" ]]; then
  TARGET="$PROJECT_DIR"
else
  TARGET="${ARG2:-$TARGET_DEFAULT}"
fi

echo "== RESTORE =="
echo "📦 $TGZ"
echo "📂 $TARGET"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# แตกไฟล์ไปที่ TMP
tar -C "$TMP" -xzf "$TGZ"

# ตัวแบ็กอัพเราสร้างจาก -C PROJECT_DIR ./ ดังนั้นของจะอยู่ใต้ "$TMP/."
SRC_DIR="$TMP"
[[ -d "$TMP/." ]] && SRC_DIR="$TMP/."

# โหมดกู้ไปโฟลเดอร์ใหม่
if [[ "$TARGET" != "$PROJECT_DIR" ]]; then
  mkdir -p "$TARGET"
  rsync -a "$SRC_DIR/" "$TARGET/"
  echo "✅ เสร็จแล้วที่: $TARGET"
  echo "➡️ ขั้นต่อไป: cd \"$TARGET\" && npm ci && npm run dev"
  exit 0
fi

# โหมด --here: กู้ทับโปรเจ็กต์ปัจจุบัน (กัน .backups/, node_modules/, .next/)
echo "⚠️ กำลังกู้ทับโปรเจ็กต์ปัจจุบันที่: $PROJECT_DIR"
rsync -a --delete \
  --exclude='.backups' \
  --exclude='node_modules' \
  --exclude='.next' \
  "$SRC_DIR/" "$PROJECT_DIR/"

echo "✅ กู้ทับโปรเจ็กต์เรียบร้อย"
echo "➡️ แนะนำ: npm ci && npm run dev"
