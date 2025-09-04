"use client";

import { api, fetchJSON } from "@/lib/api";
import { UserRow } from "@/types/user";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import * as React from "react";

const RESET_PASSWORD_API = (id: string) =>
  api(`/api/admin/users/${id}/reset-password`);

export default function ResetPasswordDialog({
  open,
  onClose,
  user,
  onDone,
  authHeaders,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  onDone: (msg?: string) => void;
  authHeaders: HeadersInit;
}) {
  const [mode, setMode] = React.useState<"auto" | "manual">("auto");
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMode("auto");
      setPassword("");
    }
  }, [open]);

  const handleReset = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const body: any = { mode };
      if (mode === "manual") body.password = password;
      const r = await fetchJSON<{ tempPassword?: string }>(
        RESET_PASSWORD_API(user._id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        }
      );
      onDone(
        mode === "auto"
          ? `รหัสผ่านชั่วคราว: ${r?.tempPassword || "(ตรวจในระบบ)"}`
          : "ตั้งรหัสผ่านใหม่สำเร็จ"
      );
      onClose();
    } catch (e: any) {
      alert(e?.message || "ตั้งรหัสผ่านไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>รีเซ็ตรหัสผ่าน: {user?.username}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="โหมด"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <MenuItem value="auto">
              สุ่มรหัสชั่วคราว (system generated)
            </MenuItem>
            <MenuItem value="manual">กำหนดเอง</MenuItem>
          </TextField>
          {mode === "manual" && (
            <TextField
              label="รหัสผ่านใหม่"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="อย่างน้อย 6 ตัวอักษร"
            />
          )}
          <Alert severity="info">
            ระบบจะบังคับให้ผู้ใช้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งถัดไป
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button
          variant="contained"
          onClick={handleReset}
          disabled={saving || (mode === "manual" && password.length < 6)}
        >
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
