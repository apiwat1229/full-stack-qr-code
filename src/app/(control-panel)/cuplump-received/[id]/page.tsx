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
  Grid,
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
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/* ===== helpers ===== */
const show = (v: any) =>
  v === null || v === undefined || v === "" ? "-" : String(v);

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
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

const StatCard = ({
  title,
  value,
  hint,
  highlight = false,
  order,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  highlight?: boolean;
  order?: { xs?: number; md?: number };
}) => (
  <Grid
    size={{ xs: 12, sm: 4, md: 4 }}
    sx={{ order: { xs: order?.xs, md: order?.md } }}
  >
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        borderRadius: 2,
        borderColor: (t) => (highlight ? "success.main" : t.palette.divider),
        bgcolor: (t) =>
          highlight
            ? t.palette.mode === "dark"
              ? "success.dark"
              : "success.light"
            : "transparent",
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
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
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
        fromSS = {
          dateISO: p.dateISO,
          dateText: p.dateText,
          supplier: p.supplier,
          rubberType: p.rubberType,
          truckRegister: p.truckRegisters?.[0] || "",
          truckType: p.truckTypes?.[0] || "",
          bookingCode: p.bookingCode,
          sequence: p.sequence,
          userName: p.userName,
          startTime: p.startTime,
          endTime: p.endTime,
          checkInTime:
            typeof p.checkInTime === "string"
              ? { $date: p.checkInTime }
              : p.checkInTime,
          drainStartTime: p.drainStartTime,
          drainStopTime: p.drainStopTime,
          lotNumber: p.lotNumber,
          source: p.source,
          moisture: toNum(p.moisture),
          cpPercent: toNum(p.cpPercent),
          drcEstimate: toNum(p.drcEstimate),
          drcRequested: toNum(p.drcRequested),
          drcActual: toNum(p.drcActual),
          weightIn: toNum(p.weightIn),
          weightInHead: toNum(p.weightInHead),
          weightInTrailer: toNum(p.weightInTrailer),
          weightOut: toNum(p.weightOut),
          weightOutHead: toNum(p.weightOutHead),
          weightOutTrailer: toNum(p.weightOutTrailer),
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

      bookingCode: q("bookingCode") || undefined,
      sequence: toNum(q("sequence")),
      userName: q("userName") || undefined,
      startTime: q("startTime") || undefined,
      endTime: q("endTime") || undefined,
      checkInTime: q("checkInTime")
        ? { $date: q("checkInTime") as string }
        : undefined,
      drainStartTime: q("drainStartTime") || undefined,
      drainStopTime: q("drainStopTime") || undefined,

      lotNumber: q("lotNumber") || undefined,
      source: q("source") || undefined,
      moisture: toNum(q("moisture")),
      cpPercent: toNum(q("cp") || q("cpPercent")),
      drcEstimate: toNum(q("drcEstimate")),
      drcRequested: toNum(q("drcRequested")),
      drcActual: toNum(q("drcActual")),

      weightIn: toNum(q("weightIn")),
      weightInHead: toNum(q("weightInHead")),
      weightInTrailer: toNum(q("weightInTrailer")),
      weightOut: toNum(q("weightOut")),
      weightOutHead: toNum(q("weightOutHead")),
      weightOutTrailer: toNum(q("weightOutTrailer")),
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
    return { inPair, outPair, outSum, net };
  }, [data]);

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

      {/* ===== Overview: ซ้ายเป็นวันที่แบบ Chip, ขวาเป็น Lot Number ===== */}
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
          {/* Supplier & Truck */}
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

          {/* Rubber */}
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

          {/* Weights */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Grid container spacing={1}>
              <StatCard
                title="WEIGHT IN (KG.)"
                value={fmtKg(data.weightIn)}
                hint={trailer ? `Head / Trailer = ${kgs.inPair}` : undefined}
                order={{ xs: 2, md: 2 }}
              />
              <StatCard
                title="WEIGHT OUT (KG.)"
                value={fmtKg(kgs.outSum)}
                hint={trailer ? `Head / Trailer = ${kgs.outPair}` : undefined}
                order={{ xs: 2, md: 2 }}
              />
              <StatCard
                title="NET (KG.)"
                value={fmtKg(kgs.net)}
                hint="= Total In - Total Out"
                highlight
                order={{ xs: 3, md: 3 }}
              />
            </Grid>
          </Grid>

          {/* Quality Input (มาตรฐานฟอร์ม) */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{ opacity: 0.7 }}
                gutterBottom
              >
                Quality Input
              </Typography>
              <Grid container spacing={2}>
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
                      setData((prev: any) => ({
                        ...prev,
                        moisture: e.target.value,
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
                    label="%CP"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.cpPercent ?? ""}
                    onChange={(e) =>
                      setData((prev: any) => ({
                        ...prev,
                        cpPercent: e.target.value,
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
                    label="DRC Estimate"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={data.drcEstimate ?? ""}
                    onChange={(e) =>
                      setData((prev: any) => ({
                        ...prev,
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
                      setData((prev: any) => ({
                        ...prev,
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
                      setData((prev: any) => ({
                        ...prev,
                        drcActual: e.target.value,
                      }))
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">%</InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Section>

      {/* ===== Saved list ===== */}
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
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="Before Press"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="Basket"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="Cuplump"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="After Press"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="%CP"
              variant="outlined"
              size="small"
              fullWidth
              type="number"
              inputProps={{ step: "0.01" }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="Before Baking 1"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="Before Baking 2"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 as any }}>
            <TextField
              label="Before Baking 3"
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
        </Grid>

        <Button variant="contained" startIcon={<SaveIcon />} sx={{ mt: 2 }}>
          บันทึก
        </Button>
      </Section>
    </Box>
  );
}
