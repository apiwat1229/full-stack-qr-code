// src/app/(control-panel)/data-lake/raw-material/page.tsx
"use client";

import FusePageSimple from "@fuse/core/FusePageSimple";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplayIcon from "@mui/icons-material/Replay";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DatePicker,
  LocalizationProvider,
  TimePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { motion } from "framer-motion";
import * as React from "react";

/* ================= Helper / Types ================= */
type Shift = "1st" | "2nd" | "24h";
type FormState = {
  date: Dayjs | null;
  shift: Shift | null;
  startTime: Dayjs | null;
  endTime: Dayjs | null;
  fgGrade: string;

  // Cuplump
  cu_ratio?: number | "";
  cu_pri?: number | "";
  cu_moisture_in?: number | "";
  cu_drc?: number | "";
  cu_aging?: number | "";

  // USS
  uss_ratio?: number | "";
  uss_pri?: number | "";
  uss_drc?: number | "";
  uss_note?: string;

  // Blanket
  bl_ratio?: number | "";
  bl_pri?: number | "";
  bl_drc?: number | "";
  bl_aging_day?: number | "";
};

const FG_GRADES = [
  "P0263",
  "P0264",
  "P0265",
  "STR20",
  "RSS3",
  "Compound-A",
  "Compound-B",
];

const RADIUS = 1;
const card = {
  component: motion.div,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
} as const;

const numberInputProps = {
  inputMode: "decimal" as const,
  pattern: "[0-9]*",
};

function toNum(v: number | "" | undefined) {
  return v === "" || v == null || Number.isNaN(Number(v))
    ? undefined
    : Number(v);
}
function clamp(n: number | undefined, min: number, max: number) {
  if (n == null) return n;
  return Math.min(max, Math.max(min, n));
}
/** ตรวจค่าพื้นฐาน (return รายการข้อผิดพลาด) */
function validate(payload: FormState) {
  const errs: Record<string, string> = {};
  if (!payload.date) errs.date = "กรุณาเลือกวันที่";
  if (!payload.shift) errs.shift = "กรุณาเลือกกะ";
  if (!payload.startTime) errs.startTime = "กรุณาเลือกเวลาเริ่ม";
  if (!payload.endTime) errs.endTime = "กรุณาเลือกเวลาเลิก";
  if (!payload.fgGrade?.trim()) errs.fgGrade = "เลือกเกรด FG";

  // จำกัดช่วงค่าพื้นฐาน
  const pctFields: Array<[keyof FormState, string]> = [
    ["cu_ratio", "สัดส่วน CL"],
    ["uss_ratio", "สัดส่วน USS"],
    ["bl_ratio", "สัดส่วน Blanket"],
    ["cu_moisture_in", "ความชื้นเข้า CL"],
    ["cu_drc", "DRC CL"],
    ["uss_drc", "DRC USS"],
    ["bl_drc", "DRC Blanket"],
  ];
  pctFields.forEach(([k, label]) => {
    const n = toNum(payload[k] as any);
    if (n != null && (n < 0 || n > 100))
      errs[k as string] = `${label} ต้องอยู่ระหว่าง 0–100`;
  });

  const nonNeg: Array<[keyof FormState, string]> = [
    ["cu_pri", "PRI CL"],
    ["cu_aging", "อายุก้อนดิบ CL"],
    ["uss_pri", "PRI USS"],
    ["bl_pri", "PRI Blanket"],
    ["bl_aging_day", "Blanket Aging (Day)"],
  ];
  nonNeg.forEach(([k, label]) => {
    const n = toNum(payload[k] as any);
    if (n != null && n < 0) errs[k as string] = `${label} ต้องไม่ติดลบ`;
  });

  // เวลาเริ่ม-เลิก
  if (payload.startTime && payload.endTime) {
    const s = payload.startTime.valueOf();
    const e = payload.endTime.valueOf();
    if (e <= s) errs.endTime = "เวลาเลิกต้องมากกว่าเวลาเริ่ม";
  }

  return errs;
}

/** ======= พรีเซ็ตแบบคงที่สำหรับคำนวณอัตโนมัติ ======= */
type Presets = {
  firstStart: { h: number; m: number };
  firstEnd: { h: number; m: number };
  secondStart: { h: number; m: number };
  secondEnd: { h: number; m: number }; // ถ้า end ≤ start จะถือว่าสิ้นสุดวันถัดไป
};
const DEFAULT_PRESETS: Presets = {
  firstStart: { h: 8, m: 0 },
  firstEnd: { h: 16, m: 0 },
  secondStart: { h: 16, m: 0 },
  secondEnd: { h: 0, m: 0 },
};

function buildTime(base: Dayjs, h: number, m: number) {
  return base.hour(h).minute(m).second(0).millisecond(0);
}
function applyPresetToDate(date: Dayjs, p: Presets, shift: Shift) {
  const base = date.startOf("day");
  if (shift === "1st") {
    const start = buildTime(base, p.firstStart.h, p.firstStart.m);
    let end = buildTime(base, p.firstEnd.h, p.firstEnd.m);
    if (end.valueOf() <= start.valueOf()) end = end.add(1, "day");
    return { start, end };
  }
  if (shift === "2nd") {
    const start = buildTime(base, p.secondStart.h, p.secondStart.m);
    let end = buildTime(base, p.secondEnd.h, p.secondEnd.m);
    if (end.valueOf() <= start.valueOf()) end = end.add(1, "day");
    return { start, end };
  }
  // 24h
  const start = buildTime(base, 0, 0);
  const end = buildTime(base, 0, 0).add(1, "day");
  return { start, end };
}

/* ================= Page ================= */
export default function RawMaterialEntryPage() {
  // ===== ฟอร์มหลัก =====
  const [f, setF] = React.useState<FormState>(() => {
    const d = dayjs();
    const t = applyPresetToDate(d, DEFAULT_PRESETS, "1st");
    return {
      date: d,
      shift: "1st",
      startTime: t.start,
      endTime: t.end,
      fgGrade: "",
    };
  });

  const [errs, setErrs] = React.useState<Record<string, string>>({});
  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({
    open: false,
    msg: "",
    sev: "success",
  });

  // เปลี่ยนวันที่ → จัดเวลาเริ่ม/เลิกตามกะเดิม (ใช้ DEFAULT_PRESETS)
  const onDateChange = (v: Dayjs | null) => {
    setF((prev) => {
      const date = v;
      if (!date || !prev.shift) return { ...prev, date };
      const { start, end } = applyPresetToDate(
        date,
        DEFAULT_PRESETS,
        prev.shift
      );
      return { ...prev, date, startTime: start, endTime: end };
    });
  };

  // เปลี่ยนกะ → ใช้ค่า DEFAULT_PRESETS
  const onShiftChange = (_: any, v: Shift | null) => {
    setF((prev) => {
      const shift = v;
      if (!shift) return { ...prev, shift: null };
      const baseDate = prev.date ?? dayjs();
      const { start, end } = applyPresetToDate(
        baseDate,
        DEFAULT_PRESETS,
        shift
      );
      return { ...prev, shift, startTime: start, endTime: end };
    });
  };

  // รีเซ็ตฟอร์ม
  const reset = () => {
    const d = dayjs();
    const t = applyPresetToDate(d, DEFAULT_PRESETS, "1st");
    setF({
      date: d,
      shift: "1st",
      startTime: t.start,
      endTime: t.end,
      fgGrade: "",
    });
    setErrs({});
  };

  const saveDraft = () => {
    const payload = toSaveJSON(f);
    const key = "ytrc_raw_material_drafts";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.unshift({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload,
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
    setToast({ open: true, msg: "บันทึก Draft เรียบร้อย", sev: "success" });
  };

  const submit = () => {
    const v = validate(f);
    setErrs(v);
    if (Object.keys(v).length > 0) {
      setToast({
        open: true,
        msg: "กรอกข้อมูลให้ครบและถูกต้องก่อน",
        sev: "error",
      });
      return;
    }
    // TODO: call backend API แทนการเก็บ localStorage
    saveDraft();
  };

  const copyJSON = async () => {
    const json = JSON.stringify(toSaveJSON(f), null, 2);
    await navigator.clipboard.writeText(json);
    setToast({ open: true, msg: "คัดลอก JSON แล้ว", sev: "info" });
  };

  // รวม JSON ที่จะส่งออก/บันทึก
  function toSaveJSON(state: FormState) {
    return {
      date: state.date?.format("YYYY-MM-DD"),
      shift: state.shift,
      start_time: state.startTime?.format("HH:mm"),
      end_time: state.endTime?.format("HH:mm"),
      fg_grade: state.fgGrade?.trim(),

      cuplump: {
        ratio_pct: clamp(toNum(state.cu_ratio), 0, 100),
        pri: toNum(state.cu_pri),
        moisture_in_pct: clamp(toNum(state.cu_moisture_in), 0, 100),
        drc_pct: clamp(toNum(state.cu_drc), 0, 100),
        aging_day: toNum(state.cu_aging),
      },
      uss: {
        ratio_pct: clamp(toNum(state.uss_ratio), 0, 100),
        pri: toNum(state.uss_pri),
        drc_pct: clamp(toNum(state.uss_drc), 0, 100),
        note: state.uss_note?.trim() || undefined,
      },
      blanket: {
        ratio_pct: clamp(toNum(state.bl_ratio), 0, 100),
        pri: toNum(state.bl_pri),
        drc_pct: clamp(toNum(state.bl_drc), 0, 100),
        aging_day: toNum(state.bl_aging_day),
      },
    };
  }

  const headerDate = f.date?.isValid() ? f.date.format("DD-MMM-YYYY") : "";

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Raw Material
              </Typography>
              <Chip size="small" color="primary" label={headerDate || "—"} />
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Copy JSON (ส่งให้ทีม BE ทดลอง)">
                <IconButton onClick={copyJSON}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset form">
                <IconButton onClick={reset}>
                  <ReplayIcon />
                </IconButton>
              </Tooltip>
              <Button
                onClick={saveDraft}
                startIcon={<SaveIcon />}
                variant="outlined"
                sx={{ borderRadius: RADIUS }}
              >
                Save Draft
              </Button>
              <Button
                onClick={submit}
                startIcon={<SaveIcon />}
                variant="contained"
                sx={{ borderRadius: RADIUS }}
              >
                Submit
              </Button>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6 space-y-6">
            {/* ===== Header / รอบงาน ===== */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS }}
              {...card}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                รอบงาน
              </Typography>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.25}
                alignItems="flex-start"
              >
                <FormControl sx={{ width: 200 }} error={!!errs.date}>
                  <FormLabel>วันที่</FormLabel>
                  <DatePicker
                    value={f.date}
                    onChange={(v: Dayjs | null) => onDateChange(v)}
                    format="DD-MMM-YYYY"
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { "& .MuiOutlinedInput-root": { borderRadius: 1 } },
                      },
                      popper: { disablePortal: true },
                    }}
                  />
                  {errs.date && <FormHelperText>{errs.date}</FormHelperText>}
                </FormControl>

                <FormControl>
                  <FormLabel>กะทำงาน</FormLabel>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={f.shift}
                    onChange={onShiftChange}
                  >
                    <ToggleButton value="1st">1st</ToggleButton>
                    <ToggleButton value="2nd">2nd</ToggleButton>
                    <ToggleButton value="24h">24h</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    เวลา: {f.startTime ? f.startTime.format("HH:mm") : "--:--"}{" "}
                    ถึง {f.endTime ? f.endTime.format("HH:mm") : "--:--"}
                  </Typography>
                  {errs.shift && (
                    <FormHelperText error>{errs.shift}</FormHelperText>
                  )}
                </FormControl>

                <FormControl error={!!errs.startTime}>
                  <FormLabel>เวลาเริ่ม</FormLabel>
                  <TimePicker
                    value={f.startTime}
                    onChange={(v: Dayjs | null) =>
                      setF((p) => ({ ...p, startTime: v }))
                    }
                    ampm={false}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { "& .MuiOutlinedInput-root": { borderRadius: 1 } },
                      },
                    }}
                  />
                  {errs.startTime && (
                    <FormHelperText>{errs.startTime}</FormHelperText>
                  )}
                </FormControl>

                <FormControl error={!!errs.endTime}>
                  <FormLabel>เวลาเลิก</FormLabel>
                  <TimePicker
                    value={f.endTime}
                    onChange={(v: Dayjs | null) =>
                      setF((p) => ({ ...p, endTime: v }))
                    }
                    ampm={false}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: { "& .MuiOutlinedInput-root": { borderRadius: 1 } },
                      },
                    }}
                  />
                  {errs.endTime && (
                    <FormHelperText>{errs.endTime}</FormHelperText>
                  )}
                </FormControl>

                <FormControl sx={{ minWidth: 220 }} error={!!errs.fgGrade}>
                  <FormLabel>Select Grade (FG)</FormLabel>
                  <Select
                    size="small"
                    displayEmpty
                    value={f.fgGrade}
                    onChange={(e) =>
                      setF((p) => ({
                        ...p,
                        fgGrade: (e.target.value as string) || "",
                      }))
                    }
                    renderValue={(val) => (val ? (val as string) : "เลือกเกรด")}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                  >
                    <MenuItem value="">
                      <em>เลือกเกรด</em>
                    </MenuItem>
                    {FG_GRADES.map((g) => (
                      <MenuItem key={g} value={g}>
                        {g}
                      </MenuItem>
                    ))}
                  </Select>
                  {errs.fgGrade && (
                    <FormHelperText>{errs.fgGrade}</FormHelperText>
                  )}
                </FormControl>
              </Stack>
            </Paper>

            {/* ===== Cuplump ===== */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS }}
              {...card}
            >
              <SectionHeader title="Cuplump" color="#2979FF" />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                <NumField
                  label="สัดส่วน CL"
                  unit="%"
                  value={f.cu_ratio}
                  error={errs.cu_ratio}
                  onChange={(v) => setF((p) => ({ ...p, cu_ratio: v }))}
                />
                <NumField
                  label="PRI CL"
                  value={f.cu_pri}
                  error={errs.cu_pri}
                  onChange={(v) => setF((p) => ({ ...p, cu_pri: v }))}
                />
                <NumField
                  label="ความชื้นเข้า CL"
                  unit="%"
                  value={f.cu_moisture_in}
                  error={errs.cu_moisture_in}
                  onChange={(v) => setF((p) => ({ ...p, cu_moisture_in: v }))}
                />
                <NumField
                  label="DRC CL"
                  unit="%"
                  value={f.cu_drc}
                  error={errs.cu_drc}
                  onChange={(v) => setF((p) => ({ ...p, cu_drc: v }))}
                />
                <NumField
                  label="อายุก้อนดิบ CL"
                  unit="day"
                  value={f.cu_aging}
                  error={errs.cu_aging}
                  onChange={(v) => setF((p) => ({ ...p, cu_aging: v }))}
                />
              </Stack>
            </Paper>

            {/* ===== USS ===== */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS }}
              {...card}
            >
              <SectionHeader title="USS" color="#6A1B9A" />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                <NumField
                  label="สัดส่วน USS"
                  unit="%"
                  value={f.uss_ratio}
                  error={errs.uss_ratio}
                  onChange={(v) => setF((p) => ({ ...p, uss_ratio: v }))}
                />
                <NumField
                  label="PRI USS"
                  value={f.uss_pri}
                  error={errs.uss_pri}
                  onChange={(v) => setF((p) => ({ ...p, uss_pri: v }))}
                />
                <NumField
                  label="DRC USS"
                  unit="%"
                  value={f.uss_drc}
                  error={errs.uss_drc}
                  onChange={(v) => setF((p) => ({ ...p, uss_drc: v }))}
                />
                <FormControl sx={{ minWidth: 260, flex: 1 }}>
                  <FormLabel>หมายเหตุ USS</FormLabel>
                  <TextField
                    size="small"
                    placeholder="เช่น ยางติดขอบ ฯลฯ"
                    value={f.uss_note || ""}
                    onChange={(e) =>
                      setF((p) => ({ ...p, uss_note: e.target.value }))
                    }
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                  />
                </FormControl>
              </Stack>
            </Paper>

            {/* ===== Blanket ===== */}
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS }}
              {...card}
            >
              <SectionHeader title="Blanket" color="#00C853" />
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                <NumField
                  label="สัดส่วน Blanket"
                  unit="%"
                  value={f.bl_ratio}
                  error={errs.bl_ratio}
                  onChange={(v) => setF((p) => ({ ...p, bl_ratio: v }))}
                />
                <NumField
                  label="PRI Blanket"
                  value={f.bl_pri}
                  error={errs.bl_pri}
                  onChange={(v) => setF((p) => ({ ...p, bl_pri: v }))}
                />
                <NumField
                  label="DRC Blanket"
                  unit="%"
                  value={f.bl_drc}
                  error={errs.bl_drc}
                  onChange={(v) => setF((p) => ({ ...p, bl_drc: v }))}
                />
                <NumField
                  label="Blanket Aging (Day)"
                  unit="day"
                  value={f.bl_aging_day}
                  error={errs.bl_aging_day}
                  onChange={(v) => setF((p) => ({ ...p, bl_aging_day: v }))}
                />
              </Stack>
            </Paper>

            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: RADIUS }}
              {...card}
            >
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                หลังจากกด <b>Submit</b> ข้อมูลจะถูกตรวจสอบขั้นต้นและบันทึกเป็น
                Draft ในเครื่องชั่วคราว (รอเชื่อมต่อ API จริง) — สามารถกด{" "}
                <b>Copy JSON</b> เพื่อดู payload ที่จะส่งไป BE
              </Alert>
            </Paper>

            <Snackbar
              open={toast.open}
              autoHideDuration={2500}
              onClose={() => setToast((t) => ({ ...t, open: false }))}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              sx={{ mt: 8, mr: 2 }}
            >
              <Alert
                severity={toast.sev}
                variant="filled"
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                sx={{ color: "#fff", "& .MuiAlert-icon": { color: "#fff" } }}
              >
                {toast.msg}
              </Alert>
            </Snackbar>
          </Box>
        }
      />
    </LocalizationProvider>
  );
}

/* ================= Small UI pieces ================= */
function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 8, height: 24, bgcolor: color, borderRadius: 1 }} />
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />
    </>
  );
}

function NumField({
  label,
  unit,
  value,
  error,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number | "" | undefined;
  error?: string;
  onChange: (v: number | "") => void;
}) {
  return (
    <FormControl sx={{ minWidth: 180 }} error={!!error}>
      <FormLabel>{label}</FormLabel>
      <TextField
        size="small"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange("");
          const n = Number(raw.replace(/[^0-9.]/g, ""));
          onChange(isNaN(n) ? (value ?? "") : n);
        }}
        inputProps={numberInputProps}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
        InputProps={{
          endAdornment: unit ? (
            <InputAdornment position="end">{unit}</InputAdornment>
          ) : undefined,
        }}
      />
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
