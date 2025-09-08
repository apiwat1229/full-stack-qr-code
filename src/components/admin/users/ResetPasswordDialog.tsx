// src/components/admin/users/ResetPasswordDialog.tsx
"use client";

import { api, fetchJSON } from "@/lib/api";
import type { UserRow } from "@/types/user";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import * as React from "react";

/** ยิงเข้า Nest: /api/users/:id/reset-password */
const RESET_PASSWORD_API = (id: string) =>
  api(`/api/users/${id}/reset-password`);

function toHeaderObject(
  h: HeadersInit | undefined | null
): Record<string, string> {
  if (!h) return {};
  if (typeof Headers !== "undefined" && h instanceof Headers)
    return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return h as Record<string, string>;
}

type Props = {
  open: boolean;
  onClose: () => void;
  user?: UserRow | null;
  onDone: (msg?: string) => void; // callback ยิง snackbar/แจ้งเตือน
  authHeaders: HeadersInit | Record<string, string>;
};

export default function ResetPasswordDialog({
  open,
  onClose,
  user,
  onDone,
  authHeaders,
}: Props) {
  const [mode, setMode] = React.useState<"auto" | "manual">("auto");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const authHeadersObj = React.useMemo(
    () => toHeaderObject(authHeaders),
    [authHeaders]
  );

  React.useEffect(() => {
    if (open) {
      setMode("auto");
      setPassword("");
      setShowPw(false);
    }
  }, [open]);

  const MIN_LEN = 8;
  const manualInvalid = mode === "manual" && password.trim().length < MIN_LEN;

  const handleReset = async () => {
    if (!user?._id) return;
    try {
      setSaving(true);

      const body: any = { mode };
      if (mode === "manual") body.password = password;

      const res = await fetchJSON<{ tempPassword?: string }>(
        RESET_PASSWORD_API(String(user._id)),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeadersObj },
          body: JSON.stringify(body),
        }
      );

      onDone(
        mode === "auto"
          ? `รหัสผ่านชั่วคราว: ${res?.tempPassword || "(ดูได้ในระบบผู้ดูแล)"}`
          : "ตั้งรหัสผ่านใหม่สำเร็จ"
      );
      onClose();
    } catch (e: any) {
      onDone(e?.message || "ตั้งรหัสผ่านไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>
        รีเซ็ตรหัสผ่าน{user?.username ? `: ${user.username}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="โหมด"
            value={mode}
            onChange={(e) => setMode(e.target.value as "auto" | "manual")}
          >
            <MenuItem value="auto">
              สุ่มรหัสชั่วคราว (system generated)
            </MenuItem>
            <MenuItem value="manual">กำหนดเอง</MenuItem>
          </TextField>

          {mode === "manual" && (
            <TextField
              label="รหัสผ่านใหม่"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={manualInvalid}
              helperText={
                manualInvalid
                  ? `รหัสผ่านต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`
                  : `อย่างน้อย ${MIN_LEN} ตัวอักษร`
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPw((v) => !v)}
                      edge="end"
                    >
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          )}

          <Alert severity="info">
            ระบบจะบังคับให้ผู้ใช้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งถัดไป
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={handleReset}
          disabled={saving || !user || manualInvalid}
        >
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
