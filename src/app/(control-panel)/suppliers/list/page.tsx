// src/app/suppliers/list/page.tsx
"use client";

import FusePageSimple from "@fuse/core/FusePageSimple";
import FuseSvgIcon from "@fuse/core/FuseSvgIcon";

import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ===== Material React Table ===== */
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";

/* ===== Project types/components ===== */
import SupplierDetailDrawer from "@/components/suppliers/SupplierDetailDrawer";
import { RubberTypeRef, Supplier } from "@/types/supplier";

/* ================= Styles (โครงหน้าเต็มเหมือน ExampleView) ================= */
const Root = styled(FusePageSimple)(({ theme }) => ({
  "& .FusePageSimple-header": {
    background:
      theme.palette.mode === "light"
        ? `linear-gradient(180deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, transparent 60%)`
        : undefined,
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
  },
  "& .FusePageSimple-content": {
    boxShadow: theme.vars.shadows[1],
    backgroundColor: theme.vars.palette.background.default,
  },
}));

const Card = styled(Paper)(({ theme }) => ({
  borderRadius: 1, // เอามุมโค้งออก
  border: "none", // ไม่ต้องมีเส้นขอบ
  boxShadow: "none", // ไม่ต้องมีเงา
  backgroundColor: "transparent", // ให้โปร่ง ใส่เนียนไปกับพื้นหลัง
}));

/* ================= API helpers ================= */
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "/api";

const getToken = () =>
  (typeof window !== "undefined" &&
    (localStorage.getItem("access_token") ||
      localStorage.getItem("backend_access_token"))) ||
  "";

function authHeaders(extra?: HeadersInit) {
  const t = getToken();
  return { ...(extra || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `HTTP ${res.status}`);
  }
}

function extractSuppliers(payload: any): Supplier[] {
  if (Array.isArray(payload)) return payload;
  const keys = [
    "items",
    "rows",
    "result",
    "list",
    "suppliers",
    "records",
    "data",
  ];
  for (const k of keys) {
    const v = payload?.[k];
    if (Array.isArray(v)) return v;
  }
  for (const a of keys) {
    const lvl1 = payload?.[a];
    if (lvl1 && typeof lvl1 === "object") {
      for (const b of keys) {
        const v = lvl1?.[b];
        if (Array.isArray(v)) return v;
      }
      const firstArray = Object.values(lvl1).find(Array.isArray);
      if (Array.isArray(firstArray)) return firstArray as Supplier[];
    }
  }
  const anyArray = Object.values(payload || {}).find(Array.isArray);
  return (Array.isArray(anyArray) ? anyArray : []) as Supplier[];
}

/* ================= Small utils ================= */
const nf = new Intl.NumberFormat("th-TH");

const rubberLabel = (rt: RubberTypeRef) =>
  typeof rt === "string" ? rt : (rt?.name ?? "");

// จัดหมวดก่อน
const getRubberGroup = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("eudr") && n.includes("north-east")) return "EUDR_NE";
  if (n.includes("eudr")) return "EUDR";
  if (n.includes("north-east")) return "NE";
  if (n.includes("fsc")) return "FSC";
  if (n.includes("regular")) return "REG";
  return "OTHER";
};

function chipColor(name: string) {
  switch (getRubberGroup(name)) {
    case "EUDR":
      return { bgcolor: "#2196f3", color: "#fff" }; // Blue 500
    case "EUDR_NE":
      return { bgcolor: "#2196f3", color: "#fff" }; // Teal A700
    case "NE":
      return { bgcolor: "#9c27b0", color: "#fff" }; // Purple 500
    case "FSC":
      return { bgcolor: "#ff9800", color: "#fff" }; // Green 500
    case "REG":
      return { bgcolor: "#4caf50", color: "#fff" }; // Orange 500  ff9800
    default:
      return { bgcolor: "#607d8b", color: "#fff" }; // BlueGrey 500
  }
}

/* ================= Page ================= */
export default function SuppliersFullPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error";
  }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const [provinceMap, setProvinceMap] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    id?: string;
    name?: string;
    loading: boolean;
  }>({ open: false, id: undefined, name: undefined, loading: false });

  /* ==== Load suppliers ==== */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suppliers?page=1&limit=500`, {
        cache: "no-store",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      const payload = await safeJson<any>(res);
      setRows(extractSuppliers(payload));
    } catch (e: any) {
      setRows([]);
      setToast({
        open: true,
        msg: /Unauthorized|401/i.test(String(e?.message || ""))
          ? "กรุณาเข้าสู่ระบบก่อนใช้งาน (401)"
          : e?.message || "โหลดรายการไม่สำเร็จ",
        sev: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "access_token" || ev.key === "backend_access_token")
        loadData();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadData]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/locations/provinces`, {
          cache: "no-store",
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const list =
          await safeJson<{ _id: number | string; nameTh: string }[]>(res);
        const map: Record<string, string> = {};
        for (const p of list) map[String(p._id)] = p.nameTh;
        setProvinceMap(map);
      } catch {}
    })();
  }, []);

  /* ==== Table Columns ==== */
  const columns = useMemo<MRT_ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: "supCode",
        header: "Code",
        size: 140,
        enableGrouping: false,
        enableColumnOrdering: false, // ⬅️ ห้ามลากสลับตำแหน่ง (no move)
        enableSorting: true, // ⬅️ ยังให้ sort ได้ (ค่า default = true)
        enableColumnActions: false, // (ถ้าอยากซ่อนเมนู 3 จุดของคอลัมน์นี้ด้วย)

        // จัดกลางหัวคอลัมน์และข้อมูล
        muiTableHeadCellProps: { align: "center" },
        muiTableBodyCellProps: { align: "center", sx: { textAlign: "center" } },
      },
      {
        id: "name",
        header: "Name",
        size: 500,
        enableGrouping: false,
        enableColumnOrdering: false, // ⬅️ ห้ามลากสลับตำแหน่ง (no move)
        enableSorting: true, // ⬅️ ยังให้ sort ได้ (ค่า default = true)
        enableColumnActions: false, // (ถ้าอยากซ่อนเมนู 3 จุดของคอลัมน์นี้ด้วย)
        accessorFn: (r) =>
          `${r.title ?? ""}${(r.firstName ?? "") + " " + (r.lastName ?? "")}`.trim(),
        Cell: ({ row }) => {
          const r = row.original;
          const full =
            `${r.title ?? ""}${(r.firstName ?? "") + " " + (r.lastName ?? "")}`.trim();
          const fallback = (full || r.supCode || "S").charAt(0);
          return (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar src={r.avatar} sx={{ width: 34, height: 34 }}>
                {fallback}
              </Avatar>
              <Stack sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} noWrap title={full || r.supCode}>
                  {full || r.supCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  Tel. : {r.phone || "-"}
                </Typography>
              </Stack>
            </Stack>
          );
        },
      },
      {
        id: "province",
        header: "Province",
        size: 180,
        enableGrouping: false,
        enableColumnOrdering: false, // ⬅️ ห้ามลากสลับตำแหน่ง (no move)
        enableSorting: true, // ⬅️ ยังให้ sort ได้ (ค่า default = true)
        enableColumnActions: false, // (ถ้าอยากซ่อนเมนู 3 จุดของคอลัมน์นี้ด้วย)
        accessorFn: (r) =>
          r.provinceCode != null
            ? provinceMap[String(r.provinceCode)] || String(r.provinceCode)
            : "",
        filterVariant: "autocomplete",
      },
      {
        id: "rubber",
        header: "Rubber Types",
        size: 400,
        enableGrouping: false,
        enableColumnOrdering: false, // ⬅️ ห้ามลากสลับตำแหน่ง (no move)
        enableSorting: true, // ⬅️ ยังให้ sort ได้ (ค่า default = true)
        enableColumnActions: false, // (ถ้าอยากซ่อนเมนู 3 จุดของคอลัมน์นี้ด้วย)
        enableColumnFilter: true,
        accessorFn: (r) => (r.rubberTypes || []).map(rubberLabel).join(", "),

        sortingFn: (a, b) =>
          (a.original.rubberTypes?.length || 0) -
          (b.original.rubberTypes?.length || 0),
        Cell: ({ row }) => {
          const list = (row.original.rubberTypes || []).map(rubberLabel);
          if (list.length === 0)
            return <Typography color="text.secondary">-</Typography>;
          return (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
              {list.map((name, i) => (
                <Chip
                  key={`${row.original._id}_${i}`}
                  size="small"
                  label={name}
                  sx={{ ...chipColor(name), borderRadius: 1, px: 0.75 }}
                />
              ))}
            </Stack>
          );
        },
      },
    ],
    [provinceMap]
  );

  /* ==== Actions ==== */
  const onView = (row: Supplier) => {
    setSelected(row);
    setDrawerOpen(true);
  };
  const onDelete = (row: Supplier) => {
    const full =
      `${row.title ?? ""}${(row.firstName ?? "") + " " + (row.lastName ?? "")}`.trim() ||
      row.supCode;
    setConfirm({ open: true, id: row._id, name: full, loading: false });
  };
  const performDelete = useCallback(async () => {
    if (!confirm.id) return;
    setConfirm((c) => ({ ...c, loading: true }));
    try {
      const res = await fetch(`${API_BASE}/suppliers/${confirm.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || `Delete failed (${res.status})`);
      }
      setRows((prev) => prev.filter((x) => x._id !== confirm.id));
      setSelected((cur) => (cur?._id === confirm.id ? null : cur));
      setDrawerOpen(false);
      setConfirm({
        open: false,
        id: undefined,
        name: undefined,
        loading: false,
      });
      setToast({ open: true, msg: "ลบข้อมูลสำเร็จ", sev: "success" });
    } catch (e: any) {
      setToast({
        open: true,
        msg: `ลบไม่สำเร็จ${e?.message ? `: ${e.message}` : ""}`,
        sev: "error",
      });
      setConfirm((c) => ({ ...c, loading: false }));
    }
  }, [confirm.id]);

  /* ==== Table (full-width + compact actions) ==== */
  const table = (
    <MaterialReactTable
      columns={columns}
      data={rows}
      state={{ isLoading: loading }}
      enableColumnResizing
      enableColumnOrdering
      enableStickyHeader
      enableDensityToggle
      enableFullScreenToggle={false}
      enableHiding
      enableSorting
      enableGlobalFilter
      initialState={{
        density: "compact",
        pagination: { pageIndex: 0, pageSize: 25 },
      }}
      muiTablePaperProps={{
        elevation: 0,
        variant: "outlined",
        sx: { borderRadius: 1 },
      }}
      muiTableContainerProps={{ sx: { maxHeight: "70vh" } }}
      muiTableBodyCellProps={{ sx: { py: 0.5, px: 1 } }}
      muiTableHeadCellProps={{ sx: { py: 0.75, px: 1 } }}
      displayColumnDefOptions={{
        "mrt-row-actions": {
          header: "Actions",
          size: 100,
          muiTableHeadCellProps: {
            align: "center",
            sx: { textAlign: "center" },
          },
          muiTableBodyCellProps: {
            align: "center",
            sx: { textAlign: "center", p: 0 },
          },
        },
      }}
      enableRowActions
      positionActionsColumn="last"
      renderRowActions={({ row }) => (
        <Stack
          direction="row"
          spacing={0.25}
          sx={{ justifyContent: "center", width: 1 }}
        >
          <IconButton
            size="small"
            onClick={() => onView(row.original)}
            aria-label="View"
          >
            <FuseSvgIcon size={18}>lucide:file-text</FuseSvgIcon>
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(row.original)}
            aria-label="Delete"
          >
            <FuseSvgIcon size={18}>lucide:trash</FuseSvgIcon>
          </IconButton>
        </Stack>
      )}
    />
  );

  return (
    <Root
      header={
        <Box className="p-6">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Suppliers
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {rows.length.toLocaleString()} Suppliers
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <IconButton onClick={loadData} color="inherit">
                <RefreshIcon />
              </IconButton>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                component={Link}
                href="/suppliers/create"
                sx={{ borderRadius: 1, px: 2.2 }}
              >
                Add
              </Button>
            </Stack>
          </Stack>
        </Box>
      }
      content={
        <Box className="p-6">
          <Card>{table}</Card>

          {/* Toast */}
          <Snackbar
            open={toast.open}
            autoHideDuration={3200}
            onClose={() => setToast((t) => ({ ...t, open: false }))}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            sx={{ mt: 8, mr: 2, zIndex: (theme) => theme.zIndex.modal + 1 }}
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

          {/* Drawer */}
          {selected && (
            <SupplierDetailDrawer
              key={selected._id}
              open={drawerOpen}
              supplier={selected}
              onClose={() => setDrawerOpen(false)}
              onDelete={(id) =>
                setConfirm({
                  open: true,
                  id,
                  name:
                    `${selected.title ?? ""}${(selected.firstName ?? "") + " " + (selected.lastName ?? "")}`.trim() ||
                    selected.supCode,
                  loading: false,
                })
              }
            />
          )}

          {/* Confirm Delete */}
          <Dialog
            open={confirm.open}
            onClose={() =>
              confirm.loading
                ? undefined
                : setConfirm({
                    open: false,
                    id: undefined,
                    name: undefined,
                    loading: false,
                  })
            }
          >
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogContent>
              <DialogContentText>
                ต้องการลบรายการ <strong>{confirm.name}</strong> หรือไม่?
                การกระทำนี้ไม่สามารถย้อนกลับได้
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                onClick={() =>
                  setConfirm({
                    open: false,
                    id: undefined,
                    name: undefined,
                    loading: false,
                  })
                }
                disabled={confirm.loading}
              >
                ยกเลิก
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={performDelete}
                disabled={confirm.loading}
                startIcon={<FuseSvgIcon>lucide:trash</FuseSvgIcon>}
              >
                {confirm.loading ? "กำลังลบ..." : "ลบ"}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      }
    />
  );
}
