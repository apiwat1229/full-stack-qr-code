// src/app/(control-panel)/cuplump-received/[id]/page.tsx
"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
// Grid v2 (รองรับ prop `size`)
import Grid from "@mui/material/Grid";

import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/* ===== helpers ===== */
const show = (v: any) =>
  v === null || v === undefined || v === "" ? "-" : String(v);

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const fmtPct = (v: any) => {
  const n = toNum(v);
  return n === null ? "--%" : `${n.toFixed(2)}%`;
};
const fmtKg = (v: any) => {
  const n = toNum(v);
  return n === null ? "-" : n.toLocaleString();
};

const isTrailer = (truckType?: string) => {
  const t = (truckType || "").toLowerCase();
  return t.includes("พ่วง") || t.includes("trailer");
};

function weightBreakText({
  head,
  trailer,
  single,
}: {
  head?: number | null;
  trailer?: number | null;
  single?: number | null;
}) {
  const h = toNum(head);
  const t = toNum(trailer);
  const s = toNum(single);
  if (h != null || t != null) {
    return `${h != null ? h.toLocaleString() : "-"} / ${
      t != null ? t.toLocaleString() : "-"
    }`;
  }
  if (s != null) return s.toLocaleString();
  return "-";
}

function sumOut({
  head,
  trailer,
  single,
}: {
  head?: any;
  trailer?: any;
  single?: any;
}) {
  const h = toNum(head);
  const t = toNum(single);
  const s = toNum(trailer);
  if (t != null) return t;
  if (h != null || s != null) return (h ?? 0) + (s ?? 0);
  return null;
}

/** parse "123" หรือ "8000/3500" → {a: number|null, b: number|null} */
function parsePair(text?: string): { a: number | null; b: number | null } {
  const s = (text || "").trim();
  if (!s) return { a: null, b: null };
  const parts = s.split("/").map((x) => toNum(x));
  if (parts.length === 1) return { a: parts[0], b: null };
  return { a: parts[0], b: parts[1] };
}

/* Small UI helpers */
const KV = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Stack
    direction="row"
    spacing={1}
    alignItems="baseline"
    sx={{ minWidth: 220 }}
  >
    <Typography variant="body2" color="text.secondary">
      {label} :
    </Typography>
    <Typography variant="body2" fontWeight={600}>
      {value}
    </Typography>
  </Stack>
);

const Section = ({
  title,
  children,
  dense,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  dense?: boolean;
}) => (
  <Paper variant="outlined" sx={{ p: dense ? 2 : 3, mb: 2.5, borderRadius: 2 }}>
    <Box sx={{ mb: dense ? 1.5 : 2 }}>{title}</Box>
    <Divider sx={{ mb: dense ? 1.5 : 2 }} />
    {children}
  </Paper>
);

/** การ์ดสรุป (รองรับปรับความสูงและโทนสี) */
const StatCard = ({
  title,
  value,
  hint,
  highlight = false,
  highlightVariant = "success",
  order,
  height = 156, // ค่า default เพื่อให้ทั้งสามการ์ดสูงเท่ากัน
  align = "right",
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  highlight?: boolean;
  /** success = เขียวอ่อน (เดิม), neutral = เทาอ่อน */
  highlightVariant?: "success" | "neutral";
  order?: { xs?: number; md?: number };
  height?: number;
  align?: "left" | "right";
}) => (
  <Grid
    size={{ xs: 12, sm: 4, md: 4 }}
    sx={{ order: { xs: order?.xs, md: order?.md } }}
  >
    <Paper
      variant="outlined"
      sx={(t) => {
        const isNeutral = highlight && highlightVariant === "neutral";
        const border = isNeutral ? t.palette.divider : t.palette.success.main;
        const bgNeutral =
          t.palette.mode === "dark" ? t.palette.grey[800] : t.palette.grey[200];
        const bgSuccess =
          t.palette.mode === "dark"
            ? t.palette.success.dark
            : t.palette.success.light;

        return {
          p: 2,
          minHeight: height,
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: align === "right" ? "flex-end" : "flex-start",
          textAlign: align === "right" ? "right" : "left",
          borderColor: highlight ? border : t.palette.divider,
          bgcolor: highlight
            ? isNeutral
              ? bgNeutral
              : bgSuccess
            : "transparent",
        };
      }}
    >
      <Typography
        variant="overline"
        sx={{ letterSpacing: 0.5, opacity: 0.8 }}
        display="block"
      >
        {title}
      </Typography>
      <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.1 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography
          variant="caption"
          sx={{
            opacity: 0.8,
            whiteSpace: "pre-line" /* รองรับ \n ให้ขึ้นบรรทัด */,
          }}
        >
          {hint}
        </Typography>
      ) : (
        <Box sx={{ height: 18 }} />
      )}
    </Paper>
  </Grid>
);

/* ===== page ===== */
export default function CuplumpDetailPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [data, setData] = React.useState<any | null>(null);

  React.useEffect(() => {
    // 1) จากหน้า List (sessionStorage)
    let fromSS: any = {};
    try {
      const ss = sessionStorage.getItem("cuplump_selected");
      if (ss) {
        const p = JSON.parse(ss);
        // gross/net จากหน้า list อาจเป็น "a/b" หรือ "a"
        const g = parsePair(p.grossWeight);
        const n = parsePair(p.netWeight);

        let weightIn: number | null = null;
        let weightInHead: number | null = null;
        let weightInTrailer: number | null = null;
        let weightOut: number | null = null;
        let weightOutHead: number | null = null;
        let weightOutTrailer: number | null = null;

        if (g.b !== null || n.b !== null) {
          // พ่วง (หัว/หาง)
          weightInHead = g.a ?? 0;
          weightInTrailer = g.b ?? 0;
          const netHead = n.a ?? 0;
          const netTrailer = n.b ?? 0;
          weightOutHead = (weightInHead ?? 0) - netHead;
          weightOutTrailer = (weightInTrailer ?? 0) - netTrailer;
          weightIn = (weightInHead ?? 0) + (weightInTrailer ?? 0);
          weightOut = (weightOutHead ?? 0) + (weightOutTrailer ?? 0);
        } else {
          // คันเดี่ยว
          const inSingle = g.a ?? 0;
          const netSingle = n.a ?? 0;
          weightIn = inSingle;
          weightOut = inSingle - netSingle;
        }

        fromSS = {
          dateISO: p.dateISO,
          dateText: p.dateText,
          supplier: p.supplier,
          rubberType: p.rubberType,
          truckRegister: p.truckRegisters?.[0] || "",
          truckType: p.truckTypes?.[0] || "",
          lotNumber: p.lotNumber ?? "-",
          source: p.source ?? "-",

          weightIn,
          weightInHead,
          weightInTrailer,
          weightOut,
          weightOutHead,
          weightOutTrailer,

          // ค่าคุณภาพ (ถ้ามี)
          moisture: toNum(p.moisture),
          cpPercent: toNum(p.cpPercent),
          drcEstimate: toNum(p.drcEstimate),
          drcRequested: toNum(p.drcRequested),
          drcActual: toNum(p.drcActual),
        };
      }
    } catch {}

    // 2) จาก URL (fallback)
    const q = (k: string) => sp.get(k);
    const fromSP = {
      dateISO: q("date"),
      dateText: q("date")
        ? dayjs(q("date") as string).format("DD-MMM-YYYY")
        : undefined,
      supplier: q("supplier")
        ? decodeURIComponent(q("supplier") as string)
        : undefined,
      rubberType: q("rubberType")
        ? decodeURIComponent(q("rubberType") as string)
        : undefined,
      truckRegister: q("truckRegister") || undefined,
      truckType: q("truckType") || undefined,
    };

    // 3) ค่าพื้นฐาน
    const fallback = {
      dateISO: dayjs().format("YYYY-MM-DD"),
      dateText: dayjs().format("DD-MMM-YYYY"),
      supplier: "N/A",
      rubberType: "N/A",
      truckRegister: "N/A",
      truckType: "N/A",
      bookingCode: "N/A",
      sequence: null,
      userName: "N/A",
      startTime: null,
      endTime: null,
      checkInTime: null,
      drainStartTime: null,
      drainStopTime: null,
      lotNumber: "-",
      source: "-",
      moisture: null,
      cpPercent: null,
      drcEstimate: null,
      drcRequested: null,
      drcActual: null,
      weightIn: null,
      weightInHead: null,
      weightInTrailer: null,
      weightOut: null,
      weightOutHead: null,
      weightOutTrailer: null,
    };

    const merged = { ...fallback, ...fromSP, ...fromSS };
    setData(merged);
  }, [sp]);

  const trailer = React.useMemo(() => isTrailer(data?.truckType), [data]);

  // สร้าง hint หลายบรรทัด (ถ้าเป็นพ่วง)
  const headTrailerHint = React.useCallback((pair: string) => {
    if (!pair.includes("/")) return undefined;
    const [head, trailer] = pair.split("/").map((s) => s.trim());
    return `Head = ${head}\nTrailer = ${trailer}`;
  }, []);

  const kgs = React.useMemo(() => {
    if (!data) return null;
    const inPair = weightBreakText({
      head: data.weightInHead,
      trailer: data.weightInTrailer,
      single: data.weightIn,
    });
    const outPair = weightBreakText({
      head: data.weightOutHead,
      trailer: data.weightOutTrailer,
      single: data.weightOut,
    });
    const outSum = sumOut({
      head: data.weightOutHead,
      trailer: data.weightOutTrailer,
      single: data.weightOut,
    });
    const net =
      data.weightIn != null && outSum != null
        ? Math.max(0, data.weightIn - outSum)
        : null;
    return {
      inPair,
      outPair,
      outSum,
      net,
      inHint: trailer ? headTrailerHint(inPair) : undefined,
      outHint: trailer ? headTrailerHint(outPair) : undefined,
    };
  }, [data, trailer, headTrailerHint]);

  if (!data || !kgs) {
    return (
      <Box className="p-6 flex justify-center items-center">
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography>Loading details...</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box className="p-6">
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.back()}
          color="inherit"
          variant="outlined"
        >
          Back
        </Button>
        <Typography variant="h5" fontWeight={800}>
          Cuplump Detail
        </Typography>
      </Stack>

      {/* ===== Overview: ซ้าย = วันที่แบบ Chip, ขวา = Lot Number ===== */}
      <Section
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip label={data.dateText} variant="outlined" />
            <Box sx={{ flexGrow: 1 }} />
            <TextField
              label="Create Lot Number"
              size="small"
              value={data.lotNumber ?? ""}
              onChange={(e) =>
                setData((prev: any) => ({ ...prev, lotNumber: e.target.value }))
              }
              sx={{ minWidth: 220 }}
            />
          </Box>
        }
      >
        <Grid container spacing={1}>
          {/* ผู้ขาย & รถ */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, height: "100%" }}
            >
              <Typography
                variant="subtitle2"
                sx={{ opacity: 0.7 }}
                gutterBottom
              ></Typography>
              <Stack spacing={0.5}>
                <KV label="Supplier" value={show(data.supplier)} />
                <KV label="ทะเบียน" value={show(data.truckRegister)} />
                <KV label="ประเภท" value={show(data.truckType)} />
              </Stack>
            </Paper>
          </Grid>

          {/* ประเภทยาง */}
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, height: "100%" }}
            >
              <Typography
                variant="subtitle2"
                sx={{ opacity: 0.7 }}
                gutterBottom
              ></Typography>
              <Stack spacing={0.5}>
                <KV label="Rubber Type" value={show(data.rubberType)} />
                <KV label="Rubber Source" value={show(data.source)} />
              </Stack>
            </Paper>
          </Grid>

          {/* น้ำหนัก — ให้สูงเท่ากัน + NET เป็นเทาอ่อน */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Grid container spacing={1}>
              <StatCard
                title="WEIGHT IN (KG.)"
                value={fmtKg(data.weightIn)}
                hint={kgs.inHint}
                height={156}
                align="right"
              />
              <StatCard
                title="WEIGHT OUT (KG.)"
                value={fmtKg(kgs.outSum)}
                hint={kgs.outHint}
                height={156}
                align="right"
              />
              <StatCard
                title="NET WEIGHT (KG.)"
                value={fmtKg(kgs.net)}
                hint="Total In - Total Out"
                highlight
                highlightVariant="neutral" // 👈 ใช้เทาอ่อนแทนเขียว
                height={156}
                align="right"
              />
            </Grid>
          </Grid>

          {/* Quality Input */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ opacity: 0.7 }}
                gutterBottom
              >
                Quality Input
              </Typography>

              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="Moisture"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.moisture ?? ""}
                    onChange={(e) =>
                      setData((p: any) => ({ ...p, moisture: e.target.value }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="%CP"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.cpPercent ?? ""}
                    onChange={(e) =>
                      setData((p: any) => ({ ...p, cpPercent: e.target.value }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="DRC Estimate"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.drcEstimate ?? ""}
                    onChange={(e) =>
                      setData((p: any) => ({
                        ...p,
                        drcEstimate: e.target.value,
                      }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="DRC Requested"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.drcRequested ?? ""}
                    onChange={(e) =>
                      setData((p: any) => ({
                        ...p,
                        drcRequested: e.target.value,
                      }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                  <TextField
                    label="DRC Actual"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.drcActual ?? ""}
                    onChange={(e) =>
                      setData((p: any) => ({ ...p, drcActual: e.target.value }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* ปุ่มบันทึกในบรรทัดเดียวกัน */}
                <Grid
                  size={{ xs: 12, sm: 6, md: 2 }}
                  display="flex"
                  justifyContent="flex-end"
                >
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => {
                      console.log("Saving Quality Input", {
                        moisture: data.moisture,
                        cpPercent: data.cpPercent,
                        drcEstimate: data.drcEstimate,
                        drcRequested: data.drcRequested,
                        drcActual: data.drcActual,
                      });
                    }}
                  >
                    Save
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Section>

      {/* ===== Saved list (ตัวอย่างข้อมูล mock) ===== */}
      <Section
        title={
          <Typography variant="subtitle1" fontWeight={700}>
            รายการที่บันทึกแล้ว
          </Typography>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>No</TableCell>
              <TableCell>Before Press</TableCell>
              <TableCell>Basket</TableCell>
              <TableCell>Cuplump</TableCell>
              <TableCell>After Press</TableCell>
              <TableCell>%CP</TableCell>
              <TableCell>Before Baking 1</TableCell>
              <TableCell>Before Baking 2</TableCell>
              <TableCell>Before Baking 3</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              {
                no: 1,
                beforePress: 12.54,
                basket: 1.4,
                cuplump: 11.14,
                afterPress: 10.18,
                cp: 31.07,
                b1: 0.2,
                b2: 0.195,
                b3: 0.155,
              },
            ].map((r) => (
              <TableRow key={r.no}>
                <TableCell>{r.no}</TableCell>
                <TableCell>{r.beforePress}</TableCell>
                <TableCell>{r.basket}</TableCell>
                <TableCell>{r.cuplump}</TableCell>
                <TableCell>{r.afterPress}</TableCell>
                <TableCell>{r.cp}</TableCell>
                <TableCell>{r.b1}</TableCell>
                <TableCell>{r.b2}</TableCell>
                <TableCell>{r.b3}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      {/* ===== Add form ===== */}
      <Section
        title={
          <Typography variant="subtitle1" fontWeight={700}>
            เพิ่มรายการรับเศษยาง
          </Typography>
        }
        dense
      >
        <Grid container spacing={2}>
          {[
            "Before Press",
            "Basket",
            "Cuplump",
            "After Press",
            "%CP",
            "Before Baking 1",
            "Before Baking 2",
            "Before Baking 3",
          ].map((label, idx) => (
            <Grid key={label} size={{ xs: 12, sm: 6, md: 2 }}>
              <TextField
                label={label}
                variant="outlined"
                size="small"
                fullWidth
                type={label.includes("%") ? "number" : "text"}
                InputProps={
                  label.includes("%")
                    ? {
                        endAdornment: (
                          <InputAdornment position="end">%</InputAdornment>
                        ),
                      }
                    : undefined
                }
              />
            </Grid>
          ))}
        </Grid>

        <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 2 }}>
          บันทึก
        </Button>
      </Section>
    </Box>
  );
}
