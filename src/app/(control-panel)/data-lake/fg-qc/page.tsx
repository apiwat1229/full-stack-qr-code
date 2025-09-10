// src/app/(control-panel)/data-lake/fg-qc/page.tsx
"use client";

import FusePageSimple from "@fuse/core/FusePageSimple";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import ReplayIcon from "@mui/icons-material/Replay";
import SaveIcon from "@mui/icons-material/Save";
import UploadIcon from "@mui/icons-material/Upload";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { motion } from "framer-motion";
import * as React from "react";

/* ========= Types ========= */
type FGQCState = {
  // Environment
  env_temp?: number | "";
  env_humid?: number | "";

  // FG
  fg_white_spot?: boolean;
  fg_defect_weight?: number | "";

  // Lab
  lab_po?: string;

  // Picture (url หรือ blob url)
  pic_white_sheet?: string;
  pic_thin_sheet?: string;
  pic_crack?: boolean;
  pic_crack_sample?: string;

  // Others
  other_lime_amount?: number | "";
};

/* ========= UI helpers ========= */
const RADIUS = 1.25;
const numberInputProps = { inputMode: "decimal" as const, pattern: "[0-9]*" };

const cardFX = {
  component: motion.div,
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
} as const;

const paperLiftSx = {
  p: 2,
  borderRadius: RADIUS,
  transition:
    "box-shadow .16s ease, transform .16s ease, border-color .16s ease",
  "&:hover, &:focus-within": {
    boxShadow: (t: any) => t.shadows[2],
    transform: "translateY(-1px)",
    borderColor: (t: any) => t.palette.divider,
  },
};

/* ========= Small fields ========= */
function NumField({
  label,
  unit,
  value,
  onChange,
  minWidth = 160,
  disabled,
  maxWidth,
}: {
  label: string;
  unit?: string;
  value: number | "" | undefined;
  onChange: (v: number | "") => void;
  minWidth?: number;
  disabled?: boolean;
  maxWidth?: number | string;
}) {
  return (
    <FormControl sx={{ minWidth, width: "100%", maxWidth }} disabled={disabled}>
      <FormLabel>{label}</FormLabel>
      <TextField
        size="small"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange("");
          const n = Number(raw.replace(/[^0-9.]/g, ""));
          onChange(Number.isNaN(n) ? (value ?? "") : n);
        }}
        inputProps={numberInputProps}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
        InputProps={{
          endAdornment: unit ? (
            <Box component="span" sx={{ pl: 1, opacity: 0.7 }}>
              {unit}
            </Box>
          ) : undefined,
        }}
      />
    </FormControl>
  );
}

/** แถวรูปภาพ: ช่อง + ไอคอน Upload/Remove/Preview (Preview โชว์เฉพาะเมื่อมีค่า) */
function PictureRow({
  label,
  value,
  onChange,
  placeholder,
  onUpload,
  onClear,
  onPreview,
  maxWidth = 720,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onUpload: () => void;
  onClear: () => void;
  onPreview?: () => void;
  maxWidth?: number;
}) {
  const hasValue = !!value;
  return (
    <FormControl sx={{ width: "100%" }}>
      <FormLabel>{label}</FormLabel>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ maxWidth, width: "100%" }}
      >
        <TextField
          size="small"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          sx={{
            flex: 1,
            "& .MuiOutlinedInput-root": { borderRadius: 1 },
          }}
        />
        {/* Upload or Remove */}
        {!hasValue ? (
          <Tooltip title="Upload">
            <IconButton
              size="small"
              color="default"
              onClick={onUpload}
              sx={{
                border: (t) => `1px solid ${t.palette.divider}`,
                borderRadius: 1,
              }}
            >
              <UploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title="Remove">
            <IconButton
              size="small"
              color="error"
              onClick={onClear}
              sx={{
                border: (t) => `1px solid ${t.palette.error.light}`,
                borderRadius: 1,
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* Preview (only when has value) */}
        {hasValue && (
          <Tooltip title="Preview">
            <IconButton
              size="small"
              color="primary"
              onClick={onPreview}
              sx={{ borderRadius: 1 }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </FormControl>
  );
}

/** Header ของการ์ด */
function CardHeader({
  title,
  color,
  saved,
  onSaveOrEdit,
  rightExtra,
}: {
  title: string;
  color: string;
  saved: boolean;
  onSaveOrEdit: () => void;
  rightExtra?: React.ReactNode;
}) {
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        <Box sx={{ width: 8, height: 24, bgcolor: color, borderRadius: 1 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {rightExtra}
        <Button
          size="small"
          onClick={onSaveOrEdit}
          startIcon={saved ? <EditIcon /> : <SaveIcon />}
          variant="contained"
          sx={{ borderRadius: 1, ml: 1 }}
        >
          {saved ? "Edit" : "Save"}
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />
    </>
  );
}

/* ========= Page ========= */
export default function FGQCPage() {
  const [f, setF] = React.useState<FGQCState>({
    fg_white_spot: false,
    pic_crack: false,
  });

  const [saved, setSaved] = React.useState<{
    env: boolean;
    fg: boolean;
    lab: boolean;
    pic: boolean;
    other: boolean;
  }>({ env: false, fg: false, lab: false, pic: false, other: false });

  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "info";
  }>({ open: false, msg: "", sev: "success" });

  // Dialog สำหรับ Preview รูป
  const [preview, setPreview] = React.useState<{
    open: boolean;
    url?: string;
    title?: string;
  }>({ open: false });

  // file input refs
  const inputWhiteRef = React.useRef<HTMLInputElement | null>(null);
  const inputThinRef = React.useRef<HTMLInputElement | null>(null);
  const inputCrackRef = React.useRef<HTMLInputElement | null>(null);

  const copyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(f, null, 2));
    setToast({ open: true, msg: "คัดลอก JSON แล้ว", sev: "info" });
  };

  const resetAll = () => {
    [f.pic_white_sheet, f.pic_thin_sheet, f.pic_crack_sample]
      .filter((u) => u?.startsWith("blob:"))
      .forEach((u) => URL.revokeObjectURL(u as string));

    setF({
      fg_white_spot: false,
      pic_crack: false,
    });
    setSaved({ env: false, fg: false, lab: false, pic: false, other: false });
  };

  const quickSave = (key: keyof typeof saved) => {
    setSaved((p) => ({ ...p, [key]: true }));
    const list = JSON.parse(
      localStorage.getItem("ytrc_fgqc_drafts") || "[]"
    ) as any[];
    list.unshift({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload: f,
    });
    localStorage.setItem("ytrc_fgqc_drafts", JSON.stringify(list.slice(0, 20)));
    setToast({ open: true, msg: "บันทึก Draft เรียบร้อย", sev: "success" });
  };

  const whiteOn = !!f.fg_white_spot;

  // upload helpers
  const handleUpload = (ref: React.RefObject<HTMLInputElement>) => () =>
    ref.current?.click();

  const onFileChange =
    (key: "pic_white_sheet" | "pic_thin_sheet" | "pic_crack_sample") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const prev = f[key];
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      const url = URL.createObjectURL(file);
      setF((p) => ({ ...p, [key]: url }));
    };

  const clearImage = (
    key: "pic_white_sheet" | "pic_thin_sheet" | "pic_crack_sample"
  ) => {
    const prev = f[key];
    if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    setF((p) => ({ ...p, [key]: "" }));
  };

  const openPreview = (url?: string, title?: string) => {
    if (!url) return;
    setPreview({ open: true, url, title });
  };

  return (
    <>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Environment / FG Data
              </Typography>
              <Chip size="small" color="primary" label="YTRC Data Lake" />
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Copy JSON">
                <IconButton onClick={copyJSON}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset all">
                <IconButton onClick={resetAll}>
                  <ReplayIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            {/* ===== 2 คอลัมน์สำหรับทุกกลุ่ม ===== */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
              }}
            >
              {/* ===== Environment ===== */}
              <Paper variant="outlined" sx={paperLiftSx} {...cardFX}>
                <CardHeader
                  title="Environment"
                  color="#1E88E5"
                  saved={saved.env}
                  onSaveOrEdit={() => quickSave("env")}
                />
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                  <NumField
                    label="อุณหภูมิ​ในห้อง (°C)"
                    unit="°C"
                    value={f.env_temp ?? ""}
                    onChange={(v) => setF((p) => ({ ...p, env_temp: v }))}
                    maxWidth={300}
                  />
                  <NumField
                    label="ความชื้นสัมพัทธ์ในห้อง (%)"
                    unit="%"
                    value={f.env_humid ?? ""}
                    onChange={(v) => setF((p) => ({ ...p, env_humid: v }))}
                    maxWidth={300}
                  />
                </Stack>
              </Paper>

              {/* ===== FG (Defect | Lab) ===== */}
              <Paper variant="outlined" sx={paperLiftSx} {...cardFX}>
                <CardHeader
                  title="FG"
                  color="#8E24AA"
                  saved={saved.fg}
                  onSaveOrEdit={() => quickSave("fg")}
                />

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  {/* ซ้าย = Defect */}
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                      Defect
                    </Typography>

                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Switch
                          checked={whiteOn}
                          onChange={(e) =>
                            setF((p) => ({
                              ...p,
                              fg_white_spot: e.target.checked,
                              fg_defect_weight: e.target.checked
                                ? p.fg_defect_weight
                                : "",
                            }))
                          }
                        />
                        <Typography variant="body2">
                          White Spot{" "}
                          <span style={{ opacity: 0.6 }}>( No / Yes )</span>
                        </Typography>
                      </Stack>

                      {/* แสดงเฉพาะเมื่อเปิดสวิตช์ */}
                      {whiteOn && (
                        <NumField
                          label="น้ำหนัก Defect"
                          unit="kg"
                          value={f.fg_defect_weight ?? ""}
                          onChange={(v) =>
                            setF((p) => ({ ...p, fg_defect_weight: v }))
                          }
                          maxWidth={420}
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* ขวา = Lab */}
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
                      Lab ( PO )
                    </Typography>
                    <FormControl
                      sx={{ minWidth: 160, width: "100%", maxWidth: 420 }}
                    >
                      <TextField
                        size="small"
                        value={f.lab_po ?? ""}
                        placeholder="Input PO"
                        onChange={(e) =>
                          setF((p) => ({ ...p, lab_po: e.target.value }))
                        }
                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                      />
                    </FormControl>
                  </Box>
                </Box>
              </Paper>

              {/* ===== Picture ===== */}
              <Paper variant="outlined" sx={paperLiftSx} {...cardFX}>
                <CardHeader
                  title="Picture"
                  color="#00897B"
                  saved={saved.pic}
                  onSaveOrEdit={() => quickSave("pic")}
                />

                {/* hidden file inputs */}
                <input
                  ref={inputWhiteRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onFileChange("pic_white_sheet")}
                />
                <input
                  ref={inputThinRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onFileChange("pic_thin_sheet")}
                />
                <input
                  ref={inputCrackRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onFileChange("pic_crack_sample")}
                />

                <Stack spacing={1.25}>
                  <PictureRow
                    label="รูปแผ่นขาว"
                    value={f.pic_white_sheet}
                    onChange={(v) =>
                      setF((p) => ({ ...p, pic_white_sheet: v }))
                    }
                    placeholder="อัพโหลดรูปแผ่นขาว"
                    onUpload={handleUpload(inputWhiteRef)}
                    onClear={() => clearImage("pic_white_sheet")}
                    onPreview={() =>
                      openPreview(f.pic_white_sheet, "รูปแผ่นขาว")
                    }
                  />

                  <PictureRow
                    label="รูปแผ่นบาง"
                    value={f.pic_thin_sheet}
                    onChange={(v) => setF((p) => ({ ...p, pic_thin_sheet: v }))}
                    placeholder="อัพโหลดรูปแผ่นบาง"
                    onUpload={handleUpload(inputThinRef)}
                    onClear={() => clearImage("pic_thin_sheet")}
                    onPreview={() =>
                      openPreview(f.pic_thin_sheet, "รูปแผ่นบาง")
                    }
                  />

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      checked={!!f.pic_crack}
                      onChange={(e) =>
                        setF((p) => ({ ...p, pic_crack: e.target.checked }))
                      }
                    />
                    <Typography variant="body2">
                      ยางแตก <span style={{ opacity: 0.6 }}>( No / Yes )</span>
                    </Typography>
                  </Stack>

                  {/* แสดง “รูปงานแตก (Sample)” เฉพาะเมื่อเปิดสวิตช์ยางแตก */}
                  {f.pic_crack && (
                    <PictureRow
                      label="รูปงานแตก"
                      value={f.pic_crack_sample}
                      onChange={(v) =>
                        setF((p) => ({ ...p, pic_crack_sample: v }))
                      }
                      placeholder="อัพโหลดรูปงานแตก (Sample)"
                      onUpload={handleUpload(inputCrackRef)}
                      onClear={() => clearImage("pic_crack_sample")}
                      onPreview={() =>
                        openPreview(f.pic_crack_sample, "รูปงานแตก")
                      }
                    />
                  )}
                </Stack>
              </Paper>

              {/* ===== Others ===== */}
              <Paper variant="outlined" sx={paperLiftSx} {...cardFX}>
                <CardHeader
                  title="Others"
                  color="#546E7A"
                  saved={saved.other}
                  onSaveOrEdit={() => quickSave("other")}
                />
                <NumField
                  label="ปริมาณปูนขาวที่ใช้ที่บ่อ Shredder 2"
                  value={f.other_lime_amount ?? ""}
                  onChange={(v) =>
                    setF((p) => ({ ...p, other_lime_amount: v }))
                  }
                  maxWidth={360}
                />
              </Paper>
            </Box>

            {/* ===== Hint / footer ===== */}
            <Paper
              variant="outlined"
              sx={{ ...paperLiftSx, mt: 2 }}
              {...cardFX}
            >
              <Alert severity="info" sx={{ borderRadius: 1 }}>
                ทุกกลุ่มมีปุ่ม <b>Save/Edit</b> แยกกันที่มุมขวาบนของการ์ด
                สามารถบันทึกเฉพาะส่วนที่กรอกเสร็จแล้วได้
              </Alert>
            </Paper>

            <Snackbar
              open={toast.open}
              autoHideDuration={2200}
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

      {/* ===== Dialog Preview ===== */}
      <Dialog
        open={preview.open}
        onClose={() => setPreview({ open: false })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          <Typography variant="subtitle2" component="div" sx={{ flexGrow: 1 }}>
            {preview.title || "Preview"}
          </Typography>
          <IconButton onClick={() => setPreview({ open: false })}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {preview.url ? (
            <Box
              component="img"
              src={preview.url}
              alt={preview.title || "preview"}
              sx={{
                display: "block",
                maxWidth: "100%",
                width: "100%",
                height: "auto",
                borderRadius: 1,
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              ไม่พบรูปภาพสำหรับพรีวิว
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
