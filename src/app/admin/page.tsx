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
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useSession } from "next-auth/react";
import * as React from "react";

const USERS_API = api("/api/admin/users");
const USER_API_ID = (id: string) => api(`/api/admin/users/${id}`);

const Carded = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  overflow: "hidden",
  border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
  background: theme.palette.background.paper,
}));

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const authHeaders = useAuthHeaders();

  const perms = getMyPerms(session);
  const canCreate = !!perms.create || !!perms.approve;
  const canDelete = !!perms.delete || !!perms.approve;
  const canUpdate = !!perms.update || !!perms.approve;

  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<UserRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetUser, setResetUser] = React.useState<UserRow | null>(null);

  const [selected, setSelected] = React.useState<UserRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

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
        headers: { ...authHeaders },
      });
      const filtered = (data || []).filter((u) => {
        const hay =
          `${u.username || ""} ${u.name || ""} ${u.lastName || ""} ${u.email || ""} ${u.department || ""}`.toLowerCase();
        return !q.trim() || hay.includes(q.trim().toLowerCase());
      });
      setRows(filtered);
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
  }, [q, authHeaders]);

  React.useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async (u: UserRow) => {
    if (!canDelete) return;
    const ok = window.confirm(`ต้องการลบผู้ใช้ "${u.username}" ใช่หรือไม่?`);
    if (!ok) return;
    try {
      await fetchJSON(USER_API_ID(u._id), {
        method: "DELETE",
        headers: { ...authHeaders },
      });
      setToast({ open: true, msg: "ลบผู้ใช้สำเร็จ", sev: "success" });
      if (selected?._id === u._id) {
        setSelected(null);
        setDetailsOpen(false);
      }
      load();
    } catch (e: any) {
      setToast({ open: true, msg: e?.message || "ลบไม่สำเร็จ", sev: "error" });
    }
  };

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

      {/* Toolbar */}
      <Card
        elevation={0}
        sx={{
          border: (t) => `1px solid ${t.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ py: 1.5 }}>
          <UsersToolbar q={q} setQ={setQ} />
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
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
            ข้อมูลผู้ใช้
          </Typography>
          <UserDetailsPanel user={selected} />
        </Box>
      </Drawer>

      {/* Dialogs */}
      <UserEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          load();
          if (selected) {
            // รีโหลดผู้ใช้ที่กำลังเปิดรายละเอียดอยู่
            fetchJSON<UserRow>(USER_API_ID(selected._id), {
              headers: { ...authHeaders },
            })
              .then((u) => setSelected(u))
              .catch(() => {});
          }
        }}
        editing={editing}
        allUsers={rows}
        authHeaders={authHeaders}
      />
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
        authHeaders={authHeaders}
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
