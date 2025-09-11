// src/app/cuplump-received/page.tsx
"use client";

import FusePageSimple from "@fuse/core/FusePageSimple";
import PrintIcon from "@mui/icons-material/Print";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import * as React from "react";

/* ========== CONFIG ========== */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "/api";
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const EVENTS_API = (dateISO: string) =>
  api(`/bookings/events?date=${encodeURIComponent(dateISO)}`);

// ⭐️ ADDED: Key สำหรับบันทึกวันที่ใน localStorage
const LOCAL_STORAGE_DATE_KEY = "cuplump_received_list_date";

/* ========== TYPES ========== */
type EventRaw = any;

type Row = {
  id: string;
  dateISO: string;
  supplierLabel: string;
  date: string;
  rubberType: string;
  grossWeight: string; // รวม หรือ "หัว/หาง"
  netWeight: string; // รวม หรือ "หัว/หาง"
  truckRegisters: string[];
  truckTypes: string[];
};

/* ========== UTILS ========== */
function getStoredToken(): string | undefined {
  try {
    if (typeof window !== "undefined") {
      const fromLS = window.localStorage.getItem("backend_access_token");
      if (fromLS) return fromLS;
      const m = document.cookie
        ?.split(";")
        ?.map((s) => s.trim())
        ?.find((s) => s.startsWith("backend_access_token="));
      if (m) return decodeURIComponent(m.split("=")[1]);
    }
  } catch {}
  return process.env.NEXT_PUBLIC_DEV_BACKEND_TOKEN || undefined;
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const bearer = getStoredToken();
  if (bearer && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${bearer}`);
  }
  if (!headers.has("Content-Type") && !!init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers,
  });
  const text = await res.text().catch(() => "");
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return ct.includes("application/json") ? (JSON.parse(text) as T) : ({} as T);
}

function firstDefined<T>(
  ...cands: Array<T | null | undefined | "">
): T | undefined {
  for (const c of cands)
    if (c !== undefined && c !== null && c !== "") return c as T;
  return undefined;
}

function asDayjs(v: unknown, fallback?: Dayjs | null) {
  const d = v ? dayjs(v as any) : null;
  if (d && d.isValid()) return d;
  return fallback ?? dayjs();
}

/* ========== NORMALIZE EVENT ========== */
function normalizeEvent(raw: EventRaw) {
  const xp = raw?.extendedProps ?? {};
  const supplierCode =
    firstDefined(
      xp?.supplier_code,
      xp?.supplierCode,
      raw?.supplier_code,
      raw?.supplierCode
    ) || "";
  const supplierName =
    firstDefined(
      xp?.supplier_name,
      xp?.supplierName,
      raw?.supplier_name,
      raw?.supplierName
    ) || "";
  const supplierLabel =
    supplierCode || supplierName
      ? `${supplierCode || "-"} : ${supplierName || "-"}`
      : "-";

  const rubberTypeName =
    firstDefined(
      xp?.rubber_type_name,
      xp?.rubberTypeName,
      raw?.rubberTypeName,
      raw?.rubber_type
    ) || "-";

  const startISO =
    firstDefined<string>(raw?.start, xp?.start, raw?.date, xp?.date) ||
    dayjs().toISOString();
  const dateISO = startISO.slice(0, 10);

  const truckRegister =
    firstDefined(xp?.truck_register, raw?.truck_register, raw?.truckRegister) ||
    "";
  const truckType =
    firstDefined(xp?.truck_type, xp?.truck_type_name, raw?.truckType) || "";

  // น้ำหนักเข้า
  const inSingle = firstDefined<number>(
    xp?.weight_in,
    raw?.weight_in,
    raw?.weightIn
  );
  const inHead = firstDefined<number>(
    xp?.weight_in_head,
    raw?.weight_in_head,
    raw?.weightInHead
  );
  const inTrailer = firstDefined<number>(
    xp?.weight_in_trailer,
    raw?.weight_in_trailer,
    raw?.weightInTrailer
  );

  // น้ำหนักออก
  const outSingle = firstDefined<number>(
    xp?.weight_out,
    raw?.weight_out,
    raw?.weightOut
  );
  const outHead = firstDefined<number>(
    xp?.weight_out_head,
    raw?.weight_out_head,
    raw?.weightOutHead
  );
  const outTrailer = firstDefined<number>(
    xp?.weight_out_trailer,
    raw?.weight_out_trailer,
    raw?.weightOutTrailer
  );

  return {
    supplierLabel,
    dateISO,
    rubberTypeName,
    truckRegister: (truckRegister || "").trim(),
    truckType: (truckType || "").trim(),
    inSingle,
    inHead,
    inTrailer,
    outSingle,
    outHead,
    outTrailer,
  };
}

/* ========== AGGREGATE ========== */
function aggregateRows(items: ReturnType<typeof normalizeEvent>[]): Row[] {
  const rows: Row[] = [];

  for (const it of items) {
    let gross: string;
    let net: string;

    if (it.truckType.includes("พ่วง")) {
      // 10 ล้อ (พ่วง) → แสดงหัว/หาง
      const inHead = it.inHead ?? 0;
      const inTrailer = it.inTrailer ?? 0;
      const outHead = it.outHead ?? 0;
      const outTrailer = it.outTrailer ?? 0;

      gross = `${inHead.toLocaleString()}/${inTrailer.toLocaleString()}`;
      net = `${(inHead - outHead).toLocaleString()}/${(
        inTrailer - outTrailer
      ).toLocaleString()}`;
    } else {
      const inSum =
        typeof it.inSingle === "number"
          ? it.inSingle
          : (it.inHead ?? 0) + (it.inTrailer ?? 0);
      const outSum =
        typeof it.outSingle === "number"
          ? it.outSingle
          : it.outHead != null || it.outTrailer != null
            ? (it.outHead ?? 0) + (it.outTrailer ?? 0)
            : null;

      gross = inSum.toLocaleString();
      net =
        typeof outSum === "number"
          ? Math.max(0, inSum - outSum).toLocaleString()
          : "0";
    }

    rows.push({
      id: encodeURIComponent(
        `${it.supplierLabel}__${it.dateISO}__${it.rubberTypeName}`
      ),
      dateISO: it.dateISO,
      supplierLabel: it.supplierLabel,
      date: dayjs(it.dateISO).format("DD-MMM-YYYY"),
      rubberType: it.rubberTypeName,
      grossWeight: gross,
      netWeight: net,
      truckRegisters: it.truckRegister ? [it.truckRegister] : [],
      truckTypes: it.truckType ? [it.truckType] : [],
    });
  }

  return rows;
}

/* ========== MOCK ========== */
const MOCK_EVENTS: EventRaw[] = [
  {
    date: "2025-09-09",
    truckRegister: "88-1234",
    truckType: "10 ล้อ (พ่วง)",
    extendedProps: {
      supplier_code: "0016",
      supplier_name: "บริษัทอกรินแอด โกลบอล จำกัด",
      rubber_type_name: "EUDR CL",
      weight_in_head: 8000,
      weight_in_trailer: 3500,
      weight_out_head: 7800,
      weight_out_trailer: 3200,
    },
  },
  {
    date: "2025-09-09",
    truckRegister: "77-4455",
    truckType: "10 ล้อ",
    extendedProps: {
      supplier_code: "0017",
      supplier_name: "บจก. ตัวอย่าง",
      rubber_type_name: "FSC USS",
      weight_in: 12000,
      weight_out: 11800,
    },
  },
];

/* ========== PAGE ========== */
export default function CuplumpReceivedPage() {
  const router = useRouter();

  const [listDate, setListDate] = React.useState<Dayjs | null>(() => {
    if (typeof window === "undefined") return dayjs();
    try {
      const saved = window.localStorage.getItem(LOCAL_STORAGE_DATE_KEY);
      return saved ? asDayjs(saved, dayjs()) : dayjs();
    } catch {
      return dayjs();
    }
  });

  const listDateISO = React.useMemo(
    () => (listDate?.isValid() ? listDate : dayjs()).format("YYYY-MM-DD"),
    [listDate]
  );
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState({
    open: false,
    msg: "",
    sev: "success" as "success" | "error" | "info",
  });

  const handleDateChange = (d: Dayjs | null) => {
    const v = asDayjs(d, listDate);
    setListDate(v);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_STORAGE_DATE_KEY, v.toISOString());
      }
    } catch {}
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJSON<EventRaw[]>(EVENTS_API(listDateISO));
      const norm = (data || []).map(normalizeEvent);
      setRows(aggregateRows(norm));
    } catch {
      const norm = MOCK_EVENTS.map(normalizeEvent);
      setRows(aggregateRows(norm));
      setToast({
        open: true,
        msg: "เรียก API ไม่สำเร็จ — ใช้ข้อมูลจำลองแทน",
        sev: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [listDateISO]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FusePageSimple
        header={
          <Box className="p-6">
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={800}>
                Cuplump Received List
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <DatePicker
                label="Date"
                value={listDate}
                onChange={handleDateChange}
                format="DD-MMM-YYYY"
              />
              <Tooltip title="Reload">
                <Button
                  startIcon={<RefreshIcon />}
                  variant="outlined"
                  onClick={loadData}
                  disabled={loading}
                >
                  Reload
                </Button>
              </Tooltip>
              <Tooltip title="Export CSV">
                <Button startIcon={<SaveAltIcon />} variant="contained">
                  Export
                </Button>
              </Tooltip>
              <Tooltip title="Print">
                <Button
                  startIcon={<PrintIcon />}
                  color="inherit"
                  variant="outlined"
                >
                  Print
                </Button>
              </Tooltip>
            </Stack>
          </Box>
        }
        content={
          <Box className="p-6">
            <Paper variant="outlined" sx={{ p: 2 }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700 } }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Supplier</TableCell>
                      <TableCell>Rubber Type</TableCell>
                      <TableCell>Truck Register</TableCell>
                      <TableCell>Truck Type</TableCell>
                      <TableCell align="right">Gross Weight</TableCell>
                      <TableCell align="right">Net Weight</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          กำลังโหลด…
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          align="center"
                          sx={{ opacity: 0.7 }}
                        >
                          ไม่มีข้อมูล
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow
                          key={r.id}
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => {
                            const payload = {
                              dateISO: r.dateISO,
                              dateText: r.date,
                              supplier: r.supplierLabel,
                              rubberType: r.rubberType,
                              truckRegisters: r.truckRegisters,
                              truckTypes: r.truckTypes,
                              grossWeight: r.grossWeight,
                              netWeight: r.netWeight,
                            };
                            try {
                              sessionStorage.setItem(
                                "cuplump_selected",
                                JSON.stringify(payload)
                              );
                            } catch {}
                            router.push(
                              `/cuplump-received/${r.id}?date=${encodeURIComponent(r.dateISO)}&supplier=${encodeURIComponent(r.supplierLabel)}&rubberType=${encodeURIComponent(r.rubberType)}`
                            );
                          }}
                        >
                          <TableCell>{r.date}</TableCell>
                          <TableCell>
                            <Typography color="primary">
                              {r.supplierLabel}
                            </Typography>
                          </TableCell>
                          <TableCell>{r.rubberType}</TableCell>
                          <TableCell>
                            {r.truckRegisters.length
                              ? r.truckRegisters.join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {r.truckTypes.length
                              ? r.truckTypes.join(", ")
                              : "-"}
                          </TableCell>
                          <TableCell align="right">{r.grossWeight}</TableCell>
                          <TableCell align="right">{r.netWeight}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        }
      />
    </LocalizationProvider>
  );
}
