// src/app/(control-panel)/data-lake/machine/page.tsx
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
  FormLabel,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { motion } from "framer-motion";
import * as React from "react";

/* ========= Types ========= */
type CreperKey =
  | "in_rpm"
  | "line_speed"
  | "upper_rpm"
  | "lower_rpm"
  | "shear_ratio"
  | "belt_speed";

type MachineForm = {
  creper: Record<number, Partial<Record<CreperKey, number | "">>>;
  shredder1: { current?: number | ""; screen_mesh?: number | "" };
  shredder2: { current?: number | ""; screen_mesh?: number | "" };
  dryer: {
    drc_before?: number | "";
    temp: {
      A: { burner1?: number | ""; burner2?: number | "" };
      B: { burner1?: number | ""; burner2?: number | "" };
      C: { burner1?: number | ""; burner2?: number | "" };
    };
  };
};

/* ========= UI helpers ========= */
const RADIUS = 1.5;
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

/** ไม่มี hover/focus-within */
const paperStaticSx = (disabled?: boolean) => ({
  p: 2,
  borderRadius: RADIUS,
  transition: "opacity .15s ease",
  opacity: disabled ? 0.9 : 1,
});

/* ========= Page ========= */
export default function MachineEntryPage() {
  const [f, setF] = React.useState<MachineForm>(() => {
    const creper: MachineForm["creper"] = {};
    for (let i = 1; i <= 6; i++) creper[i] = {};
    return {
      creper,
      shredder1: { current: "", screen_mesh: "" },
      shredder2: { current: "", screen_mesh: "" },
      dryer: {
        drc_before: "",
        temp: {
          A: { burner1: "", burner2: "" },
          B: { burner1: "", burner2: "" },
          C: { burner1: "", burner2: "" },
        },
      },
    };
  });

  // โหมดแก้ไขต่อ Group
  const [edit, setEdit] = React.useState({ g1: true, g2: true, dryer: true });

  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({ open: false, msg: "", sev: "success" });

  const copyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(f, null, 2));
    setToast({ open: true, msg: "คัดลอก JSON แล้ว", sev: "info" });
  };

  const reset = () => {
    const creper: MachineForm["creper"] = {};
    for (let i = 1; i <= 6; i++) creper[i] = {};
    setF({
      creper,
      shredder1: { current: "", screen_mesh: "" },
      shredder2: { current: "", screen_mesh: "" },
      dryer: {
        drc_before: "",
        temp: {
          A: { burner1: "", burner2: "" },
          B: { burner1: "", burner2: "" },
          C: { burner1: "", burner2: "" },
        },
      },
    });
    setEdit({ g1: true, g2: true, dryer: true });
  };

  const saveDraftAll = () => {
    const key = "ytrc_machine_drafts";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.unshift({
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload: f,
    });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
    setToast({ open: true, msg: "บันทึก Draft ทั้งหน้าแล้ว", sev: "success" });
  };

  const setCreper = (no: number, key: CreperKey, val: number | "") =>
    setF((p) => ({
      ...p,
      creper: { ...p.creper, [no]: { ...(p.creper[no] || {}), [key]: val } },
    }));

  /* ===== Save / Edit ต่อ Group ===== */
  const onSaveG1 = () => {
    const payload = {
      creper: { 1: f.creper[1], 2: f.creper[2], 3: f.creper[3] },
      shredder1: f.shredder1,
    };
    localStorage.setItem("ytrc_machine_group1", JSON.stringify(payload));
    setEdit((s) => ({ ...s, g1: false }));
    setToast({ open: true, msg: "บันทึก Line Group 1 แล้ว", sev: "success" });
  };
  const onSaveG2 = () => {
    const payload = {
      creper: { 4: f.creper[4], 5: f.creper[5], 6: f.creper[6] },
      shredder2: f.shredder2,
    };
    localStorage.setItem("ytrc_machine_group2", JSON.stringify(payload));
    setEdit((s) => ({ ...s, g2: false }));
    setToast({ open: true, msg: "บันทึก Line Group 2 แล้ว", sev: "success" });
  };
  const onSaveDryer = () => {
    const payload = f.dryer;
    localStorage.setItem("ytrc_machine_dryer", JSON.stringify(payload));
    setEdit((s) => ({ ...s, dryer: false }));
    setToast({ open: true, msg: "บันทึก Dryer แล้ว", sev: "success" });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Machine • Data Entry
              </Typography>
              <Chip size="small" color="primary" label="YTRC Data Lab" />
              <Box sx={{ flexGrow: 1 }} />
              <Tooltip title="Copy JSON ทั้งหน้า">
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
                onClick={saveDraftAll}
                startIcon={<SaveIcon />}
                variant="contained"
                sx={{ borderRadius: RADIUS }}
              >
                Save Draft (All)
              </Button>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6 space-y-6">
            {/* ===== Line Group 1 ===== */}
            <Paper variant="outlined" sx={paperStaticSx(!edit.g1)} {...card}>
              <SectionHeader
                title="Line Group 1 (Creper 1–3 • Shredder 1)"
                color="#2979FF"
                rightSlot={
                  edit.g1 ? (
                    <Button size="small" variant="contained" onClick={onSaveG1}>
                      Save
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setEdit((s) => ({ ...s, g1: true }))}
                    >
                      Edit
                    </Button>
                  )
                }
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <CreperBlock
                  no={1}
                  values={f.creper[1]}
                  onChange={(k, v) => setCreper(1, k, v)}
                  disabled={!edit.g1}
                />
                <CreperBlock
                  no={2}
                  values={f.creper[2]}
                  onChange={(k, v) => setCreper(2, k, v)}
                  disabled={!edit.g1}
                />
                <CreperBlock
                  no={3}
                  values={f.creper[3]}
                  onChange={(k, v) => setCreper(3, k, v)}
                  disabled={!edit.g1}
                />
                <ShredderCard
                  title="Shredder 1"
                  current={f.shredder1.current ?? ""}
                  mesh={f.shredder1.screen_mesh ?? ""}
                  onChangeCurrent={(v) =>
                    setF((p) => ({
                      ...p,
                      shredder1: { ...(p.shredder1 || {}), current: v },
                    }))
                  }
                  onChangeMesh={(v) =>
                    setF((p) => ({
                      ...p,
                      shredder1: { ...(p.shredder1 || {}), screen_mesh: v },
                    }))
                  }
                  disabled={!edit.g1}
                />
              </Box>
            </Paper>

            {/* ===== Line Group 2 ===== */}
            <Paper variant="outlined" sx={paperStaticSx(!edit.g2)} {...card}>
              <SectionHeader
                title="Line Group 2 (Creper 4–6 • Shredder 2)"
                color="#6A1B9A"
                rightSlot={
                  edit.g2 ? (
                    <Button size="small" variant="contained" onClick={onSaveG2}>
                      Save
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setEdit((s) => ({ ...s, g2: true }))}
                    >
                      Edit
                    </Button>
                  )
                }
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <CreperBlock
                  no={4}
                  values={f.creper[4]}
                  onChange={(k, v) => setCreper(4, k, v)}
                  disabled={!edit.g2}
                />
                <CreperBlock
                  no={5}
                  values={f.creper[5]}
                  onChange={(k, v) => setCreper(5, k, v)}
                  disabled={!edit.g2}
                />
                <CreperBlock
                  no={6}
                  values={f.creper[6]}
                  onChange={(k, v) => setCreper(6, k, v)}
                  disabled={!edit.g2}
                />
                <ShredderCard
                  title="Shredder 2"
                  current={f.shredder2.current ?? ""}
                  mesh={f.shredder2.screen_mesh ?? ""}
                  onChangeCurrent={(v) =>
                    setF((p) => ({
                      ...p,
                      shredder2: { ...(p.shredder2 || {}), current: v },
                    }))
                  }
                  onChangeMesh={(v) =>
                    setF((p) => ({
                      ...p,
                      shredder2: { ...(p.shredder2 || {}), screen_mesh: v },
                    }))
                  }
                  disabled={!edit.g2}
                />
              </Box>
            </Paper>

            {/* ===== Dryer ===== */}
            <Paper variant="outlined" sx={paperStaticSx(!edit.dryer)} {...card}>
              <SectionHeader
                title="Dryer"
                color="#00C853"
                rightSlot={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CompactNumField
                      label="DRC ก่อนเข้าเตา"
                      unit="%"
                      value={f.dryer.drc_before ?? ""}
                      onChange={(v) =>
                        setF((p) => ({
                          ...p,
                          dryer: { ...p.dryer, drc_before: v },
                        }))
                      }
                      disabled={!edit.dryer}
                    />
                    {edit.dryer ? (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={onSaveDryer}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setEdit((s) => ({ ...s, dryer: true }))}
                      >
                        Edit
                      </Button>
                    )}
                  </Stack>
                }
              />

              {/* การ์ด 3 คอลัมน์ */}
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                }}
              >
                <DryerLaneCard
                  lane="A"
                  burner1={f.dryer.temp.A.burner1 ?? ""}
                  burner2={f.dryer.temp.A.burner2 ?? ""}
                  onChange={(which, v) =>
                    setF((p) => ({
                      ...p,
                      dryer: {
                        ...p.dryer,
                        temp: {
                          ...p.dryer.temp,
                          A: { ...p.dryer.temp.A, [which]: v },
                        },
                      },
                    }))
                  }
                  disabled={!edit.dryer}
                />
                <DryerLaneCard
                  lane="B"
                  burner1={f.dryer.temp.B.burner1 ?? ""}
                  burner2={f.dryer.temp.B.burner2 ?? ""}
                  onChange={(which, v) =>
                    setF((p) => ({
                      ...p,
                      dryer: {
                        ...p.dryer,
                        temp: {
                          ...p.dryer.temp,
                          B: { ...p.dryer.temp.B, [which]: v },
                        },
                      },
                    }))
                  }
                  disabled={!edit.dryer}
                />
                <DryerLaneCard
                  lane="C"
                  burner1={f.dryer.temp.C.burner1 ?? ""}
                  burner2={f.dryer.temp.C.burner2 ?? ""}
                  onChange={(which, v) =>
                    setF((p) => ({
                      ...p,
                      dryer: {
                        ...p.dryer,
                        temp: {
                          ...p.dryer.temp,
                          C: { ...p.dryer.temp.C, [which]: v },
                        },
                      },
                    }))
                  }
                  disabled={!edit.dryer}
                />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={paperStaticSx()} {...card}>
              <Alert severity="info" sx={{ borderRadius: RADIUS }}>
                ใช้ปุ่ม Save/Edit ของแต่ละกลุ่มเพื่อบันทึกแยกส่วนได้ — หรือกด{" "}
                <b>Save Draft (All)</b> ที่แถบด้านบนเพื่อบันทึกทั้งหน้า
              </Alert>
            </Paper>

            <Snackbar
              open={toast.open}
              autoHideDuration={2400}
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

/* ========= Small UI pieces ========= */

function SectionHeader({
  title,
  color,
  rightSlot,
}: {
  title: string;
  color: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <>
      <Box
        sx={{
          mb: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ width: 8, height: 24, bgcolor: color, borderRadius: 1 }} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {rightSlot}
      </Box>
      <Divider sx={{ mb: 2 }} />
    </>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit?: string;
  value: number | "" | undefined;
  onChange: (v: number | "") => void;
  disabled?: boolean;
}) {
  return (
    <FormControl
      sx={{ minWidth: 180, width: "100%", opacity: disabled ? 0.8 : 1 }}
    >
      <FormLabel>{label}</FormLabel>
      <TextField
        size="small"
        disabled={!!disabled}
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
            <InputAdornment position="end">{unit}</InputAdornment>
          ) : undefined,
        }}
      />
    </FormControl>
  );
}

/** ช่องเล็กสำหรับ header ขวา (เช่น DRC) */
function CompactNumField({
  label,
  unit,
  value,
  onChange,
  disabled,
}: {
  label: string;
  unit?: string;
  value: number | "" | undefined;
  onChange: (v: number | "") => void;
  disabled?: boolean;
}) {
  return (
    <FormControl
      sx={{
        minWidth: 140,
        width: 180,
        "& .MuiFormLabel-root": { fontSize: 12, lineHeight: 1.1 },
        opacity: disabled ? 0.8 : 1,
      }}
    >
      <FormLabel>{label} (%)</FormLabel>
      <TextField
        size="small"
        disabled={!!disabled}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange("");
          const n = Number(raw.replace(/[^0-9.]/g, ""));
          onChange(Number.isNaN(n) ? (value ?? "") : n);
        }}
        inputProps={numberInputProps}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1, height: 36 } }}
        InputProps={{
          endAdornment: unit ? (
            <InputAdornment position="end">{unit}</InputAdornment>
          ) : undefined,
        }}
      />
    </FormControl>
  );
}

/** Creper: 2 แถว × 3 คอลัมน์ (ไม่มี hover) */
function CreperBlock({
  no,
  values,
  onChange,
  disabled,
}: {
  no: number;
  values: Partial<Record<CreperKey, number | "">> | undefined;
  onChange: (k: CreperKey, v: number | "") => void;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        border: (t) => `1px dashed ${t.palette.divider}`,
        p: 1.75,
        borderRadius: RADIUS,
        transition: "opacity .15s",
        opacity: disabled ? 0.95 : 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Creper {no}
      </Typography>

      {/* บรรทัดบน */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1.25,
          mb: 1.25,
        }}
      >
        <NumField
          label="รอบบ่อเกิดเข้า (rpm)"
          value={(values?.in_rpm as any) ?? ""}
          onChange={(v) => onChange("in_rpm", v)}
          disabled={disabled}
        />
        <NumField
          label="Line speed"
          unit="m/min"
          value={(values?.line_speed as any) ?? ""}
          onChange={(v) => onChange("line_speed", v)}
          disabled={disabled}
        />
        <NumField
          label="รอบลูกกลิ้งบน (rpm)"
          value={(values?.upper_rpm as any) ?? ""}
          onChange={(v) => onChange("upper_rpm", v)}
          disabled={disabled}
        />
      </Box>

      {/* บรรทัดล่าง */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1.25,
        }}
      >
        <NumField
          label="รอบลูกกลิ้งล่าง (rpm)"
          value={(values?.lower_rpm as any) ?? ""}
          onChange={(v) => onChange("lower_rpm", v)}
          disabled={disabled}
        />
        <NumField
          label="Shear Ratio"
          value={(values?.shear_ratio as any) ?? ""}
          onChange={(v) => onChange("shear_ratio", v)}
          disabled={disabled}
        />
        <NumField
          label="ความเร็วสายพานออกจาก Creper"
          unit="m/min"
          value={(values?.belt_speed as any) ?? ""}
          onChange={(v) => onChange("belt_speed", v)}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
}

/** Shredder card (ไม่มี hover) */
function ShredderCard({
  title,
  current,
  mesh,
  onChangeCurrent,
  onChangeMesh,
  disabled,
}: {
  title: string;
  current: number | "" | undefined;
  mesh: number | "" | undefined;
  onChangeCurrent: (v: number | "") => void;
  onChangeMesh: (v: number | "") => void;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        border: (t) => `1px dashed ${t.palette.divider}`,
        p: 1.75,
        borderRadius: RADIUS,
        transition: "opacity .15s",
        opacity: disabled ? 0.95 : 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack spacing={1.25}>
        <NumField
          label={`${title} — กระแส (A)`}
          value={current ?? ""}
          onChange={onChangeCurrent}
          disabled={disabled}
        />
        <NumField
          label={`${title} — ตะแกรง (mesh)`}
          value={mesh ?? ""}
          onChange={onChangeMesh}
          disabled={disabled}
        />
      </Stack>
    </Box>
  );
}

/** Dryer lane (ไม่มี hover) */
function DryerLaneCard({
  lane,
  burner1,
  burner2,
  onChange,
  disabled,
}: {
  lane: "A" | "B" | "C";
  burner1: number | "" | undefined;
  burner2: number | "" | undefined;
  onChange: (which: "burner1" | "burner2", v: number | "") => void;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        border: (t) => `1px dashed ${t.palette.divider}`,
        p: 1.75,
        borderRadius: RADIUS,
        transition: "opacity .15s",
        opacity: disabled ? 0.95 : 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
        Dryer {lane}
      </Typography>
      <Stack spacing={1.25}>
        <NumField
          label={`อุณหภูมิ Burner 1 – Dryer ${lane} (°C)`}
          value={burner1 ?? ""}
          onChange={(v) => onChange("burner1", v)}
          disabled={disabled}
        />
        <NumField
          label={`อุณหภูมิ Burner 2 – Dryer ${lane} (°C)`}
          value={burner2 ?? ""}
          onChange={(v) => onChange("burner2", v)}
          disabled={disabled}
        />
      </Stack>
    </Box>
  );
}
