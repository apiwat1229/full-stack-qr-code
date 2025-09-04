"use client";

import { Box, Divider, Stack, SxProps, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import * as React from "react";

export type TicketViewProps = {
  rubberType: string;
  code: string | number;
  name: string;
  dateText: string;
  timeText: string;
  truck: string;
  bookingCode: string | number;
  queue: string | number;
  width?: number;
  sx?: SxProps;
  hideQR?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
  /** ใช้กำหนดสีพื้นหลังตามวัน — รองรับทั้ง dateObj (ใหม่) และ date (เก็บของเดิม) */
  dateObj?: Date | null;
  date?: Date | null;
};

/* ================= Helpers ================= */
function getDayBgColor(date?: Date | null): string {
  if (!date) return "#F6EAC4"; // fallback เดิม
  const d = date.getDay(); // 0=อาทิตย์ … 6=เสาร์
  switch (d) {
    case 0:
      return "#FFCCCC"; // อาทิตย์ แดง
    case 1:
      return "#FFF6A3"; // จันทร์ เหลือง
    case 2:
      return "#FFCCE5"; // อังคาร ชมพู
    case 3:
      return "#CCFFCC"; // พุธ เขียว
    case 4:
      return "#FFD9B3"; // พฤหัส ส้ม
    case 5:
      return "#CCE5FF"; // ศุกร์ ฟ้า
    case 6:
      return "#E0CCFF"; // เสาร์ ม่วง
    default:
      return "#F6EAC4";
  }
}

export default function TicketView({
  rubberType,
  code,
  name,
  dateText,
  timeText,
  truck,
  bookingCode,
  queue,
  width = 360,
  sx,
  hideQR,
  innerRef,
  dateObj,
  date, // ← เผื่อมีโค้ดเก่าเรียกด้วยชื่อ date
}: TicketViewProps) {
  const WIDTH = width;
  const RADIUS = Math.round(WIDTH * 0.033);

  // ใช้ dateObj ถ้ามี ไม่งั้นลอง date (back-compat)
  const dayColor = getDayBgColor(dateObj ?? date ?? null);

  return (
    <Box
      ref={innerRef}
      sx={{
        width: WIDTH,
        borderRadius: `${RADIUS}px`,
        bgcolor: dayColor, // ✅ พื้นหลังตามวัน
        border: "3px solid #222",
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 0 0 1px rgba(0,0,0,.08) inset",
        ...sx,
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box
          component="img"
          src="/assets/images/logo/logo-dark.png"
          alt="YTRC"
          sx={{ height: Math.round(WIDTH * 0.078), objectFit: "contain" }}
        />
        <Typography
          sx={{ fontWeight: 900, fontSize: Math.round(WIDTH * 0.055) }}
        >
          บัตรคิว {rubberType?.split(" ").slice(-1).join("") || "-"}
        </Typography>
      </Stack>

      <Divider sx={{ my: 1.25, borderColor: "rgba(0,0,0,.2)" }} />

      {/* Content */}
      <Stack spacing={1.2} sx={{ fontSize: Math.round(WIDTH * 0.042) }}>
        <Row label="Code:" value={String(code || "-")} />
        <Row label="Name:" value={name || "-"} />
        <Row label="Date:" value={dateText || "-"} />
        <Row label="Time:" value={timeText || "-"} />
        <Row label="Truck:" value={truck || "-"} />
        <Row label="Type:" value={rubberType || "-"} />
        <Row label="Booking:" value={String(bookingCode || "-")} />

        {/* Queue box */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 0.5 }}
        >
          <Typography sx={{ fontWeight: 900 }}>Queue:</Typography>
          <Box
            sx={{
              bgcolor: "#fff", // ✅ พื้นหลังขาว
              color: "#000",
              borderRadius: 1.25,
              px: 1.75,
              py: 0.75,
              border: "2px solid #000", // ✅ ขอบดำ
              fontWeight: 900,
              fontSize: Math.round(WIDTH * 0.078),
              lineHeight: 1,
              minWidth: Math.round(WIDTH * 0.18),
              textAlign: "center",
            }}
          >
            {queue}
          </Box>
        </Stack>

        {/* Note */}
        <Box sx={{ mt: 2 }}>
          <Typography align="center" sx={{ fontWeight: 700, lineHeight: 1.85 }}>
            สามารถนำรถมาจอดรอหน้าโรงงานได้
            <br />
            ตั้งแต่ 08:30 เป็นต้นไป{" "}
            <Box component="span" sx={{ color: "error.main", fontWeight: 900 }}>
              ( ห้ามมาก่อน )
            </Box>
          </Typography>
          <Typography
            align="center"
            sx={{ mt: 0.75, color: "error.main", fontWeight: 900 }}
          >
            * ห้ามจอดรถบนถนนทางเข้าหน้าโรงงานเด็ดขาด *
          </Typography>
        </Box>

        {/* QR */}
        {!hideQR && (
          <Box sx={{ mt: "auto", display: "flex", justifyContent: "center" }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 1,
                border: "2px solid #111",
                bgcolor: "#fff",
              }}
            >
              <QRCodeSVG
                value={String(bookingCode || "")}
                size={Math.round(WIDTH * 0.36)}
              />
            </Box>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: 8,
        alignItems: "baseline",
      }}
    >
      <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, textAlign: "right" }}>
        {value}
      </Typography>
    </Box>
  );
}
