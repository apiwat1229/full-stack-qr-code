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

// ⭐️ Save last picked date
const LOCAL_STORAGE_DATE_KEY = "cuplump_received_list_date";

/* ========== PROVINCES & HELPERS (Rubber Source) ========== */
const TH_PROVINCES: Record<number, string> = {
  10: "กรุงเทพมหานคร",
  11: "สมุทรปราการ",
  12: "นนทบุรี",
  13: "ปทุมธานี",
  14: "พระนครศรีอยุธยา",
  15: "อ่างทอง",
  16: "ลพบุรี",
  17: "สิงห์บุรี",
  18: "ชัยนาท",
  19: "สระบุรี",
  20: "ชลบุรี",
  21: "ระยอง",
  22: "จันทบุรี",
  23: "ตราด",
  24: "ฉะเชิงเทรา",
  25: "ปราจีนบุรี",
  26: "นครนายก",
  27: "สระแก้ว",
  30: "นครราชสีมา",
  31: "บุรีรัมย์",
  32: "สุรินทร์",
  33: "ศรีสะเกษ",
  34: "อุบลราชธานี",
  35: "ยโสธร",
  36: "ชัยภูมิ",
  37: "อำนาจเจริญ",
  38: "บึงกาฬ",
  39: "นครพนม",
  40: "ขอนแก่น",
  41: "อุดรธานี",
  42: "เลย",
  43: "หนองคาย",
  44: "มหาสารคาม",
  45: "ร้อยเอ็ด",
  46: "กาฬสินธุ์",
  47: "สกลนคร",
  49: "มุกดาหาร",
  50: "เชียงใหม่",
  51: "ลำพูน",
  52: "ลำปาง",
  53: "อุตรดิตถ์",
  54: "แพร่",
  55: "น่าน",
  56: "พะเยา",
  57: "เชียงราย",
  58: "แม่ฮ่องสอน",
  60: "นครสวรรค์",
  61: "อุทัยธานี",
  62: "กำแพงเพชร",
  63: "ตาก",
  64: "สุโขทัย",
  65: "พิษณุโลก",
  66: "พิจิตร",
  67: "เพชรบูรณ์",
  70: "ราชบุรี",
  71: "กาญจนบุรี",
  72: "สุพรรณบุรี",
  73: "นครปฐม",
  74: "สมุทรสาคร",
  75: "สมุทรสงคราม",
  76: "เพชรบุรี",
  77: "ประจวบคีรีขันธ์",
  80: "นครศรีธรรมราช",
  81: "กระบี่",
  82: "พังงา",
  83: "ภูเก็ต",
  84: "สุราษฎร์ธานี",
  85: "ระนอง",
  86: "ชุมพร",
  90: "สงขลา",
  91: "สตูล",
  92: "ตรัง",
  93: "พัทลุง",
  94: "ปัตตานี",
  95: "ยะลา",
  96: "นราธิวาส",
};
const provinceName = (code?: number | null) =>
  code == null ? undefined : TH_PROVINCES[code] || `จังหวัดรหัส ${code}`;

function pickProvinceCode(anyVal: any): number | null {
  if (anyVal == null || anyVal === "") return null;
  if (typeof anyVal === "number" && Number.isFinite(anyVal)) return anyVal;
  if (typeof anyVal === "string" && /^\d+$/.test(anyVal)) return Number(anyVal);
  if (typeof anyVal === "object") {
    const cand =
      anyVal.code ??
      anyVal.id ??
      anyVal.provinceCode ??
      anyVal.province_id ??
      anyVal.rubberSourceProvince ??
      anyVal.rubber_source_province ??
      anyVal.value;
    if (cand != null) return pickProvinceCode(cand);
  }
  return null;
}
const isTrailer = (truckType?: string) =>
  (truckType || "").toLowerCase().includes("พ่วง") ||
  (truckType || "").toLowerCase().includes("trailer");

const provinceDisplay = (
  code?: number | null,
  text?: string | null
): string | undefined => provinceName(code ?? undefined) || text || undefined;

/* ========== TYPES ========== */
type EventRaw = any;

type Row = {
  id: string;
  dateISO: string;
  supplierLabel: string;
  date: string;
  rubberType: string;
  bookingCode?: string;

  // ✅ Rubber Source (รวม) + แยกหัว/หาง (ถ้ามี)
  rubberSourceProvince?: number | null;
  rubberSourceText?: string | null;
  rubberSourceHeadProvince?: number | null;
  rubberSourceHeadText?: string | null;
  rubberSourceTrailerProvince?: number | null;
  rubberSourceTrailerText?: string | null;

  rubberSourceDisplay: string;

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
  const bookingCode =
    firstDefined(
      xp?.booking_code,
      xp?.bookingCode,
      raw?.booking_code,
      raw?.bookingCode
    ) || undefined;
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

  // น้ำหนักเข้า/ออก
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

  // ✅ Rubber Source (รวม)
  const rubberSourceProvince =
    pickProvinceCode(
      xp?.rubber_source_province ??
        xp?.rubberSourceProvince ??
        xp?.sourceProvince ??
        xp?.source_province ??
        xp?.province ??
        xp?.provinceCode ??
        raw?.rubber_source_province ??
        raw?.rubberSourceProvince ??
        raw?.provinceCode
    ) ?? null;
  const rubberSourceText =
    provinceDisplay(rubberSourceProvince) ||
    xp?.rubber_source_name ||
    xp?.sourceProvinceName ||
    (typeof xp?.rubber_source === "string" ? xp.rubber_source : null) ||
    (typeof raw?.rubber_source === "string" ? raw.rubber_source : null) ||
    null;

  // ✅ Rubber Source (หัว/หาง) — ถ้ามี
  const rubberSourceHeadProvince =
    pickProvinceCode(
      xp?.rubber_source_head_province ??
        xp?.rubberSourceHeadProvince ??
        raw?.rubber_source_head_province ??
        raw?.rubberSourceHeadProvince
    ) ?? null;
  const rubberSourceTrailerProvince =
    pickProvinceCode(
      xp?.rubber_source_trailer_province ??
        xp?.rubberSourceTrailerProvince ??
        raw?.rubber_source_trailer_province ??
        raw?.rubberSourceTrailerProvince
    ) ?? null;

  const rubberSourceHeadText =
    provinceDisplay(rubberSourceHeadProvince) ||
    xp?.rubber_source_head_name ||
    raw?.rubber_source_head_name ||
    null;
  const rubberSourceTrailerText =
    provinceDisplay(rubberSourceTrailerProvince) ||
    xp?.rubber_source_trailer_name ||
    raw?.rubber_source_trailer_name ||
    null;

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

    bookingCode,

    rubberSourceProvince,
    rubberSourceText,
    rubberSourceHeadProvince,
    rubberSourceHeadText,
    rubberSourceTrailerProvince,
    rubberSourceTrailerText,
  };
}

/* ========== AGGREGATE ========== */
function aggregateRows(items: ReturnType<typeof normalizeEvent>[]): Row[] {
  const rows: Row[] = [];

  for (const it of items) {
    const trailer = isTrailer(it.truckType);
    let gross: string;
    let net: string;

    if (trailer) {
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

    // ✅ สร้างข้อความสำหรับ Rubber Source
    let rubberSourceDisplay: string;
    if (trailer) {
      const headName =
        provinceDisplay(it.rubberSourceHeadProvince, it.rubberSourceHeadText) ||
        provinceDisplay(it.rubberSourceProvince, it.rubberSourceText) ||
        "-";
      const trailerName =
        provinceDisplay(
          it.rubberSourceTrailerProvince,
          it.rubberSourceTrailerText
        ) ||
        provinceDisplay(it.rubberSourceProvince, it.rubberSourceText) ||
        "-";
      rubberSourceDisplay = `${headName} / ${trailerName}`;
    } else {
      rubberSourceDisplay =
        provinceDisplay(it.rubberSourceProvince, it.rubberSourceText) || "-";
    }

    rows.push({
      id: encodeURIComponent(
        `${it.supplierLabel}__${it.dateISO}__${it.rubberTypeName}`
      ),
      dateISO: it.dateISO,
      supplierLabel: it.supplierLabel,
      date: dayjs(it.dateISO).format("DD-MMM-YYYY"),
      rubberType: it.rubberTypeName,

      bookingCode: it.bookingCode,

      rubberSourceProvince: it.rubberSourceProvince ?? null,
      rubberSourceText: it.rubberSourceText ?? null,
      rubberSourceHeadProvince: it.rubberSourceHeadProvince ?? null,
      rubberSourceHeadText: it.rubberSourceHeadText ?? null,
      rubberSourceTrailerProvince: it.rubberSourceTrailerProvince ?? null,
      rubberSourceTrailerText: it.rubberSourceTrailerText ?? null,

      rubberSourceDisplay,

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
    date: "2025-09-11",
    truckRegister: "11-1221",
    truckType: "10 ล้อ (พ่วง)",
    extendedProps: {
      supplier_code: "0021",
      supplier_name: "นางสาวจุดจบ แก้วมณี",
      rubber_type_name: "EUDR CL",
      weight_in_head: 25120,
      weight_in_trailer: 12422,
      weight_out_head: 1112,
      weight_out_trailer: 1023,
      rubber_source_head_province: 18, // ชัยนาท
      rubber_source_trailer_province: 20, // ชลบุรี
      booking_code: "BK-TRAILER-001",
    },
  },
  {
    date: "2025-09-11",
    truckRegister: "รข-4456",
    truckType: "รถบรรทุก",
    extendedProps: {
      supplier_code: "0078",
      supplier_name: "นายไชยคี มะทะ",
      rubber_type_name: "Regular CL",
      weight_in: 15000,
      weight_out: 14000,
      rubber_source_province: 21, // ระยอง
      booking_code: "BK-SINGLE-002",
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
                      <TableCell>Truck Register</TableCell>
                      <TableCell>Truck Type</TableCell>
                      <TableCell>Rubber Type</TableCell>
                      {/* ✅ คอลัมน์ใหม่ */}
                      <TableCell>Rubber Source</TableCell>
                      <TableCell align="right">Gross Weight ( Kg. )</TableCell>
                      <TableCell align="right">Net Weight ( Kg. )</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          กำลังโหลด…
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
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

                              // ✅ ส่งแหล่งที่มาทั้งแบบรวม และแยกหัว/หาง
                              rubberSourceProvince: r.rubberSourceProvince,
                              rubberSourceHeadProvince:
                                r.rubberSourceHeadProvince,
                              rubberSourceTrailerProvince:
                                r.rubberSourceTrailerProvince,
                              source:
                                r.rubberSourceText ?? r.rubberSourceDisplay,
                              truckRegisters: r.truckRegisters,
                              truckTypes: r.truckTypes,
                              grossWeight: r.grossWeight,
                              netWeight: r.netWeight,
                              bookingCode: r.bookingCode,
                            };
                            try {
                              sessionStorage.setItem(
                                "cuplump_selected",
                                JSON.stringify(payload)
                              );
                            } catch {}

                            const qs = new URLSearchParams({
                              date: r.dateISO,
                              supplier: r.supplierLabel,
                              rubberType: r.rubberType,
                            });
                            if (r.rubberSourceProvince != null)
                              qs.set(
                                "rubberSourceProvince",
                                String(r.rubberSourceProvince)
                              );
                            if (r.rubberSourceHeadProvince != null)
                              qs.set(
                                "rubberSourceHeadProvince",
                                String(r.rubberSourceHeadProvince)
                              );
                            if (r.rubberSourceTrailerProvince != null)
                              qs.set(
                                "rubberSourceTrailerProvince",
                                String(r.rubberSourceTrailerProvince)
                              );
                            if (r.bookingCode)
                              qs.set("bookingCode", r.bookingCode);

                            router.push(`/cuplump-received/${r.id}?${qs}`);
                          }}
                        >
                          <TableCell>{r.date}</TableCell>
                          <TableCell>
                            <Typography color="primary">
                              {r.supplierLabel}
                            </Typography>
                          </TableCell>
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
                          <TableCell>{r.rubberType}</TableCell>
                          {/* ✅ แสดงค่า */}
                          <TableCell>{r.rubberSourceDisplay}</TableCell>

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
