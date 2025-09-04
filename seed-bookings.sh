#!/usr/bin/env bash
set -euo pipefail

# ===== Config =====
BACKEND="https://database-system.ytrc.co.th"
BASE="$BACKEND/api/bookings"

# ใส่ token ได้ถ้ามี (ถ้าไม่มีก็ปล่อยว่าง)
AUTH_HEADER=""
# AUTH_HEADER="Authorization: Bearer YOUR_TOKEN_HERE"

# วันที่ทดสอบ: วันนี้ + พรุ่งนี้ + มะรืน
if date -v +1d +%Y-%m-%d >/dev/null 2>&1; then
  # macOS
  DATES=("$(date +%Y-%m-%d)" "$(date -v +1d +%Y-%m-%d)" "$(date -v +2d +%Y-%m-%d)")
else
  # Linux
  DATES=("$(date +%Y-%m-%d)" "$(date -d '+1 day' +%Y-%m-%d)" "$(date -d '+2 day' +%Y-%m-%d)")
fi

# ช่วงเวลาเริ่ม (ปลายชั่วโมงจะ map ด้วย end_of ด้านล่าง)
SLOTS=("08:00" "09:00" "10:00" "11:00" "13:00")

# ===== Known IDs ในฐานข้อมูลจริง =====
SUP01="68ac0481f799c478c7cd124f"   # นายสมชาย ใจดี
RT_EUDR_CL="68abeb20ebd40ba3a07b164b"

SUP03="68ac0924b1c4d56b570737e1"   # นายอนุชา ปิ่นทอง
RT_FSC_CL="68abeb20ebd40ba3a07b164e"

SUP04="68ac0924b1c4d56b570737e4"   # น.ส.ปวีณา รัตนกุล
RT_NE_CL="68abeb20ebd40ba3a07b1650"

SUP05="68ac0924b1c4d56b570737e7"   # นายพรชัย บุญมาก
RT_REG_CL="68abeb20ebd40ba3a07b1651"

SUP07="68ac0924b1c4d56b570737ed"   # บริษัทสยาม อุตสาหกรรม
# ใช้ได้ทั้ง RT_EUDR_CL / RT_REG_CL

# วนคู่ supplier/rubber type ไปเรื่อยๆ
SUPS=("$SUP01" "$SUP03" "$SUP04" "$SUP05" "$SUP07")
RTS=("$RT_EUDR_CL" "$RT_FSC_CL" "$RT_NE_CL" "$RT_REG_CL" "$RT_EUDR_CL")

# ===== Helpers =====
pad2(){ printf "%02d" "$1"; }

yymmdd(){
  if date -j -f %Y-%m-%d "$1" +%y%m%d >/dev/null 2>&1; then
    date -j -f %Y-%m-%d "$1" +%y%m%d
  else
    date -d "$1" +%y%m%d
  fi
}

# map แบบชัดๆ กันงอแงข้าม shell
end_of(){
  case "$1" in
    "08:00") echo "09:00" ;;
    "09:00") echo "10:00" ;;
    "10:00") echo "11:00" ;;
    "11:00") echo "12:00" ;;
    "13:00") echo "14:00" ;;
    *) echo "09:00" ;;
  esac
}

next_seq(){
  local d="$1" st="$2"
  curl -sS "$BASE/next-sequence?date=$d&start_time=$st" \
    -H "Accept: application/json" | jq -r '.next_sequence // .sequence // 1'
}

# ===== Run seeding =====
i=0
for d in "${DATES[@]}"; do
  YYMMDD=$(yymmdd "$d")
  echo "=== Date $d ==="
  for st in "${SLOTS[@]}"; do
    en=$(end_of "$st")

    # สร้าง 2 คิวต่อ slot ให้เห็นลำดับ
    for k in 1 2; do
      idx=$(( i % ${#SUPS[@]} ))
      supplier="${SUPS[$idx]}"
      rubber="${RTS[$idx]}"

      seq=$(next_seq "$d" "$st")
      code="${YYMMDD}${st/:/}-$(pad2 "$seq")"

      payload=$(jq -n --arg d "$d" --arg st "$st" --arg en "$en" \
        --arg code "$code" --argjson seq "$seq" \
        --arg user "Seeder" \
        --arg plate "TEST-$((RANDOM%900+100))" \
        --arg ttype "6 ล้อ" \
        --arg sup "$supplier" \
        --arg rty "$rubber" '
        {
          date: $d,
          start_time: $st,
          end_time: $en,
          booking_code: $code,
          sequence: $seq,
          user_name: $user,
          truck_register: $plate,
          truck_type: $ttype,
          supplier: $sup,
          rubber_type: $rty
        }')

      echo " -> POST $d $st seq=$seq code=$code (sup=$supplier rty=$rubber)"
      curl -sS -X POST "$BASE" \
        -H "Content-Type: application/json" \
        ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
        -d "$payload" | jq .

      i=$((i+1))
    done
  done
done

echo "==== Verify via events ===="
for d in "${DATES[@]}"; do
  echo "# $d"
  curl -sS "$BASE/events?date=$d" \
    | jq '. | map({id, start, "seq": .extendedProps.sequence, "code": .extendedProps.booking_code})'
done