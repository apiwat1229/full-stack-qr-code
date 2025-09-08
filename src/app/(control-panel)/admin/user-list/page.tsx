"use client";

import ResetPasswordDialog from "@/components/admin/users/ResetPasswordDialog";
import UserDetailsPanel from "@/components/admin/users/UserDetailsPanel";
import UserEditorDialog from "@/components/admin/users/UserEditorDialog";
import UsersTable from "@/components/admin/users/UsersTable";
import UsersToolbar from "@/components/admin/users/UsersToolbar";

import { api, fetchJSON, useAuthHeaders } from "@/lib/api";
import { getMyPerms, UserRow } from "@/types/user";

import AddIcon from "@mui/icons-material/PersonAdd";
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useSession } from "next-auth/react";
import * as React from "react";

const USERS_API = api("/api/admin/users");
const USER_API_ID = (id: string) => api(`/api/admin/users/${id}`);
const hasUser = (u: UserRow | null): u is UserRow => !!u;

const Carded = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  overflow: "hidden",
  border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
  background: theme.palette.background.paper,
}));

/** HeadersInit → Record<string,string> */
function toHeaderObject(
  h: HeadersInit | undefined | null
): Record<string, string> {
  if (!h) return {};
  if (typeof Headers !== "undefined" && h instanceof Headers) {
    return Object.fromEntries(h.entries());
  }
  if (Array.isArray(h)) return Object.fromEntries(h);
  return h as Record<string, string>;
}

/** ปลอดภัย: คืน id จาก id/_id */
function getId(u: any): string {
  return String(u?.id || u?._id || "");
}

/** อ่านตำแหน่งจากคีย์ที่เป็นไปได้ */
function getPosition(u: any): string {
  return String(u?.position ?? u?.jobTitle ?? u?.title ?? "").trim();
}

const DEPARTMENT_OPTIONS = ["IT", "HR", "Finance", "Operation", "Sales", "Engineering"];
const HOD_POSITIONS_ALLOW = ["Manager", "Head", "Supervisor"];

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const authHeaders = useAuthHeaders();
  const authHeadersObj = React.useMemo<Record<string, string>>(
    () => toHeaderObject(authHeaders),
    [authHeaders]
  );

  const perms = getMyPerms(session);
  const isAdminRole = String((session as any)?.user?.role || "").toLowerCase() === "admin";
  const canCreate = !!perms.create || !!perms.approve || isAdminRole;
  const canDelete = !!perms.delete || !!perms.approve || isAdminRole; // ✅ แก้ให้ admin ลบได้แน่ๆ
  const canUpdate = !!perms.update || !!perms.approve || isAdminRole;

  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetUser, setResetUser] = React.useState<UserRow | null>(null);

  const [selected, setSelected] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  // ฟิลเตอร์เพิ่ม
  const [deptFilter, setDeptFilter] = React.useState<string>("");
  const [hodOnlyFilter, setHodOnlyFilter] = React.useState<"all" | "hodOnly">("all");

  const [toast, setToast] = React.useState<{
    open: boolean;
    msg: string;
    sev: "success" | "error" | "info";
  }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJSON<UserRow[]>(USERS_API, {
        headers: { ...authHeadersObj },
      });

      let list = (data || []).filter((u) => {
        const hay =
          `${u.username || ""} ${u.name || ""} ${u.lastName || ""} ${u.email || ""} ${u.department || ""} ${getPosition(
            u as any
          )}`.toLowerCase();
        return !q.trim() || hay.includes(q.trim().toLowerCase());
      });

      if (deptFilter) {
        list = list.filter(
          (u) =>
            String(u.department || "").trim().toLowerCase() ===
            deptFilter.toLowerCase()
        );
      }

      if (hodOnlyFilter === "hodOnly") {
        list = list.filter(
          (u) =>
            String(u.role || "").toLowerCase() === "admin" &&
            ["manager", "head", "supervisor"].includes(
              getPosition(u as any).toLowerCase()
            )
        );
      }

      setRows(list);
    } catch (e: any) {
      setToast({
        open: true,
        msg: e?.message || "โหลดไม่สำเร็จ",
        sev: "error",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q, deptFilter, hodOnlyFilter, authHeadersObj]);

  React.useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async (u: UserRow) => {
    if (!canDelete) {
      setToast({ open: true, msg: "คุณไม่มีสิทธิ์ลบผู้ใช้", sev: "error" });
      return;
    }
    if (!window.confirm(`ต้องการลบผู้ใช้ "${u.username}" ใช่หรือไม่?`)) return;
    try {
      const id = getId(u);
      if (!id) throw new Error("ไม่พบรหัสผู้ใช้ (id/_id)");
      await fetchJSON(USER_API_ID(id), {
        method: "DELETE",
        headers: { ...authHeadersObj },
      });
      setToast({ open: true, msg: "ลบผู้ใช้สำเร็จ", sev: "success" });
      if (getId(selected) === id) {
        setSelected(null);
        setDetailsOpen(false);
      }
      load();
    } catch (e: any) {
      setToast({ open: true, msg: e?.message || "ลบไม่สำเร็จ", sev: "error" });
    }
  };

  function FiltersBar() {
    return (
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1 }}>
        <TextField
          select
          label="แผนก (Department)"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">ทั้งหมด</MenuItem>
          {DEPARTMENT_OPTIONS.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="กรอง HOD"
          value={hodOnlyFilter}
          onChange={(e) => setHodOnlyFilter(e.target.value as any)}
          sx={{ minWidth: 220 }}
          helperText="เฉพาะ HOD = role: admin + position: Manager/Head/Supervisor"
        >
          <MenuItem value="all">แสดงทั้งหมด</MenuItem>
          <MenuItem value="hodOnly">เฉพาะ HOD</MenuItem>
        </TextField>
      </Stack>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            จัดการผู้ใช้งาน ระบบและสิทธิ์
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          disabled={!canCreate}
          sx={{ borderRadius: 999, px: 2.2 }}
        >
          เพิ่มผู้ใช้
        </Button>
      </Stack>

      {/* Toolbar + Filters */}
      <Card elevation={0} sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <UsersToolbar q={q} setQ={setQ} />
          <FiltersBar />
        </CardContent>
      </Card>

      {/* Table */}
      <Box mt={2}>
        <Carded>
          <UsersTable
            rows={rows}
            loading={loading}
            onRowClick={(u) => {
              setSelected(u);
              setDetailsOpen(true);
            }}
            onEdit={(u) => {
              if (!canUpdate) return;
              setEditing(u);
              setEditorOpen(true);
            }}
            onReset={(u) => {
              if (!canUpdate) return;
              setResetUser(u);
              setResetOpen(true);
            }}
            onDelete={confirmDelete}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </Carded>
      </Box>

      {/* Details Drawer */}
      <Drawer
        anchor="right"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 480 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            ข้อมูลผู้ใช้
          </Typography>
          {hasUser(selected) ? (
            <UserDetailsPanel user={selected} allUsers={rows} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              เลือกผู้ใช้จากตารางด้านซ้ายเพื่อดูรายละเอียด
            </Typography>
          )}
        </Box>
      </Drawer>

      {/* Editor Dialog */}
      <UserEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          load();
          if (selected) {
            const id = getId(selected);
            if (id) {
              fetchJSON<UserRow>(USER_API_ID(id), { headers: { ...authHeadersObj } })
                .then((u) => setSelected(u))
                .catch(() => {});
            }
          }
        }}
        editing={editing}
        allUsers={rows}
        authHeaders={authHeadersObj}
      />

      {/* Reset password */}
      <ResetPasswordDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        user={resetUser}
        onDone={(msg) =>
          setToast({
            open: true,
            msg: msg || "รีเซ็ตรหัสผ่านแล้ว",
            sev: "success",
          })
        }
        authHeaders={authHeadersObj}
      />

      {/* Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2600}
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
    </Box>
  );
}