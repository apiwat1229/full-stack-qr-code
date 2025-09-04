// src/app/check-in/checked/components/WeightDialog.tsx
"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import * as React from "react";

export type RubberTypeOpt = { id: string; name: string };

// number <-> comma helpers
function fmtComma(v: number | "" | null | undefined) {
  if (v === "" || v == null || !isFinite(Number(v))) return "";
  return Number(v).toLocaleString("en-US");
}
function onlyDigits(s: string) {
  return s.replace(/[^\d.]/g, "");
}
function parseNumberFromComma(s: string): number | "" {
  const clean = onlyDigits(s);
  if (clean === "") return "";
  const n = Number(clean);
  return isFinite(n) ? n : "";
}

export default function WeightDialog({
  open,
  onClose,
  onSave,
  trailer,
  rubberTypes,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: {
    weight_in?: number | null;
    weight_in_head?: number | null;
    weight_in_trailer?: number | null;
    rubber_type?: string | null;
    rubber_type_head?: string | null;
    rubber_type_trailer?: string | null;
  }) => void;
  trailer: boolean; // true = พ่วง, false = เดี่ยว
  rubberTypes: RubberTypeOpt[];
  initial?: {
    weight_in?: number | null;
    weight_in_head?: number | null;
    weight_in_trailer?: number | null;
    rubber_type?: string | null;
    rubber_type_head?: string | null;
    rubber_type_trailer?: string | null;
  };
}) {
  // พ่วง
  const [wHead, setWHead] = React.useState<string>("");
  const [wTrailer, setWTrailer] = React.useState<string>("");
  const [rtHead, setRtHead] = React.useState<string>("");
  const [rtTrailer, setRtTrailer] = React.useState<string>("");

  // เดี่ยว
  const [wSingle, setWSingle] = React.useState<string>("");
  const [rtSingle, setRtSingle] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) return;
    // init พ่วง
    setWHead(fmtComma(initial?.weight_in_head ?? ""));
    setWTrailer(fmtComma(initial?.weight_in_trailer ?? ""));
    setRtHead(initial?.rubber_type_head || "");
    setRtTrailer(initial?.rubber_type_trailer || "");
    // init เดี่ยว
    setWSingle(fmtComma(initial?.weight_in ?? ""));
    setRtSingle(initial?.rubber_type || "");
  }, [open, initial]);

  const save = () => {
    if (trailer) {
      const head = parseNumberFromComma(wHead);
      const trl = parseNumberFromComma(wTrailer);
      onSave({
        weight_in_head: head === "" ? null : Number(head),
        weight_in_trailer: trl === "" ? null : Number(trl),
        rubber_type_head: rtHead || null,
        rubber_type_trailer: rtTrailer || null,
      });
    } else {
      const single = parseNumberFromComma(wSingle);
      onSave({
        weight_in: single === "" ? null : Number(single),
        rubber_type: rtSingle || null, // ← เดี่ยวส่ง rubber_type เสมอ
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>บันทึก Weight In</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {trailer && (
            <>
              <Typography variant="subtitle2">หัวลาก</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField
                  label="Weight (kg)"
                  size="small"
                  value={wHead}
                  onChange={(e) =>
                    setWHead(
                      fmtComma(parseNumberFromComma(e.target.value) as any)
                    )
                  }
                  inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
                />
                <TextField
                  label="Rubber Type"
                  size="small"
                  select
                  value={rtHead}
                  onChange={(e) => setRtHead(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">- ไม่ระบุ -</MenuItem>
                  {rubberTypes.map((rt) => (
                    <MenuItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Divider flexItem />

              <Typography variant="subtitle2">ลูกพ่วง</Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                <TextField
                  label="Weight (kg)"
                  size="small"
                  value={wTrailer}
                  onChange={(e) =>
                    setWTrailer(
                      fmtComma(parseNumberFromComma(e.target.value) as any)
                    )
                  }
                  inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
                />
                <TextField
                  label="Rubber Type"
                  size="small"
                  select
                  value={rtTrailer}
                  onChange={(e) => setRtTrailer(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">- ไม่ระบุ -</MenuItem>
                  {rubberTypes.map((rt) => (
                    <MenuItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </>
          )}

          {/* ✅ เดี่ยว: โชว์ Rubber Type เสมอ */}
          {!trailer && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                label="Weight (kg)"
                size="small"
                value={wSingle}
                onChange={(e) =>
                  setWSingle(
                    fmtComma(parseNumberFromComma(e.target.value) as any)
                  )
                }
                inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
              />
              <TextField
                label="Rubber Type"
                size="small"
                select
                value={rtSingle}
                onChange={(e) => setRtSingle(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">- ไม่ระบุ -</MenuItem>
                {rubberTypes.map((rt) => (
                  <MenuItem key={rt.id} value={rt.id}>
                    {rt.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          <Typography variant="caption" color="text.secondary">
            ใส่เฉพาะค่าน้ำหนักที่ทราบ (ปล่อยว่างได้) • หน่วยเป็นกิโลกรัม •
            ระบบจะใส่คอมมาให้อัตโนมัติ แต่จะส่งค่าเป็นตัวเลขล้วนไปยังเซิร์ฟเวอร์
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button variant="contained" onClick={save}>
          บันทึก
        </Button>
      </DialogActions>
    </Dialog>
  );
}
