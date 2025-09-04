// src/components/admin/users/UserEditorDialog.tsx
"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import * as React from "react";

import { api, fetchJSON } from "@/lib/api";
import type { Permission, UserRow } from "@/types/user";

const USER_API_ID = (id: string) => api(`/api/admin/users/${id}`);
const USERS_API = api(`/api/admin/users`);

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (u?: any) => void;
  /** ถ้ามี = แก้ไข, ถ้าไม่มี = สร้างใหม่ */
  editing: UserRow | null;
  /** สำหรับตรวจซ้ำอีเมล/username ตอนสร้างใหม่ */
  allUsers?: UserRow[];
  /** headers สำหรับ auth (เช่น Authorization) */
  authHeaders?: Record<string, string>;
};

const ROLE_OPTIONS = ["user", "staff", "admin"] as const;
type RoleValue = (typeof ROLE_OPTIONS)[number];

// ค่าปริยายของ permission เวลาไม่มีค่า
const DEFAULT_PERMS: Permission = {
  create: true,
  read: true,
  update: true,
  delete: false,
  approve: false,
};

export default function UserEditorDialog({
  open,
  onClose,
  onSaved,
  editing,
  allUsers = [],
  authHeaders = {},
}: Props) {
  const isEdit = !!editing;

  // --- form state ---
  const [email, setEmail] = React.useState<string>("");
  const [username, setUsername] = React.useState<string>("");
  const [department, setDepartment] = React.useState<string>("");
  const [name, setName] = React.useState<string>("");
  const [lastName, setLastName] = React.useState<string>("");
  const [role, setRole] = React.useState<RoleValue>("user");
  const [perms, setPerms] = React.useState<Permission>(DEFAULT_PERMS);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // --- reset เมื่อ dialog เปิด/เป้าหมายเปลี่ยน ---
  React.useEffect(() => {
    if (editing) {
      setEmail(editing.email || "");
      setUsername(editing.username || "");
      setDepartment(editing.department || "");
      setName(editing.name || "");
      setLastName(editing.lastName || "");
      const safeRole = (editing.role || "user") as RoleValue;
      setRole(ROLE_OPTIONS.includes(safeRole) ? safeRole : "user");
      setPerms({
        create: !!editing.permission?.create,
        read: !!editing.permission?.read,
        update: !!editing.permission?.update,
        delete: !!editing.permission?.delete,
        approve: !!editing.permission?.approve,
      });
    } else {
      // new
      setEmail("");
      setUsername("");
      setDepartment("");
      setName("");
      setLastName("");
      setRole("user");
      setPerms(DEFAULT_PERMS);
    }
    setError(null);
  }, [editing, open]);

  // ---- helpers ----
  function togglePerm<K extends keyof Permission>(key: K, value: boolean) {
    setPerms((prev) => ({ ...(prev ?? DEFAULT_PERMS), [key]: value }));
  }

  function validate(): string | null {
    if (!email.trim()) return "กรุณากรอกอีเมล";
    if (!username.trim()) return "กรุณากรอก Username";
    if (!name.trim()) return "กรุณากรอกชื่อ";
    if (!lastName.trim()) return "กรุณากรอกนามสกุล";

    if (!isEdit) {
      const e = email.trim().toLowerCase();
      const u = username.trim();
      if (allUsers.some((x) => String(x.email || "").toLowerCase() === e)) {
        return "อีเมลนี้ถูกใช้แล้ว";
      }
      if (allUsers.some((x) => String(x.username || "") === u)) {
        return "Username นี้ถูกใช้แล้ว";
      }
    }
    return null;
  }

  async function handleSave() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEdit && editing) {
        // อัปเดต (PUT → proxy แปลงเป็น PATCH ไป Nest)
        const body = {
          email: email.trim(),
          username: username.trim(),
          department: department.trim() || undefined,
          name: name.trim(),
          lastName: lastName.trim(),
          role, // สำคัญ
          permission: {
            create: !!perms.create,
            read: !!perms.read,
            update: !!perms.update,
            delete: !!perms.delete,
            approve: !!perms.approve,
          },
        };

        const res = await fetchJSON(USER_API_ID(String(editing._id)), {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        });

        onSaved?.(res);
        onClose();
      } else {
        // สร้างใหม่ (ถ้าต้องการให้ dialog ใช้สร้างด้วย)
        const body = {
          email: email.trim(),
          username: username.trim(),
          department: department.trim() || undefined,
          name: name.trim(),
          lastName: lastName.trim(),
          role,
          password: "Temp@1234", // เปลี่ยนได้ตามนโยบาย
          permission: {
            create: !!perms.create,
            read: !!perms.read,
            update: !!perms.update,
            delete: !!perms.delete,
            approve: !!perms.approve,
          },
        };

        const res = await fetchJSON(USERS_API, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(body),
        });

        onSaved?.(res);
        onClose();
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      setError(
        /401|unauthorized/i.test(msg)
          ? "ไม่ได้รับอนุญาต (Token ไม่ถูกต้อง/หมดอายุ)"
          : /409|exists|duplicate|email|username/i.test(msg)
            ? "อีเมลหรือ Username ซ้ำ"
            : msg || "บันทึกไม่สำเร็จ"
      );
    } finally {
      setSaving(false);
    }
  }

  // ---- UI ----
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth>
              <FormLabel>อีเมล *</FormLabel>
              <TextField
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputProps={{ inputMode: "email" }}
              />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel>Username *</FormLabel>
              <TextField
                size="small"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth>
              <FormLabel>ชื่อ *</FormLabel>
              <TextField
                size="small"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel>นามสกุล *</FormLabel>
              <TextField
                size="small"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth>
              <FormLabel>แผนก</FormLabel>
              <TextField
                size="small"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="role-label" shrink>
                Role
              </InputLabel>
              {/* เลี่ยง displayEmpty เพื่อกัน error MUI ถ้าไม่ได้ใส่ renderValue */}
              <Select<RoleValue>
                labelId="role-label"
                size="small"
                value={role}
                label="Role"
                onChange={(e) => {
                  const val = e.target.value as RoleValue;
                  setRole(ROLE_OPTIONS.includes(val) ? val : "user");
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                เลือกสิทธิ์รวมระดับสูง (role) ของผู้ใช้
              </FormHelperText>
            </FormControl>
          </Stack>

          <Box>
            <FormLabel>Permission</FormLabel>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ mt: 1 }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={!!perms.create}
                    onChange={(_, c) => togglePerm("create", c)}
                  />
                }
                label="Create"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!perms.read}
                    onChange={(_, c) => togglePerm("read", c)}
                  />
                }
                label="Read"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!perms.update}
                    onChange={(_, c) => togglePerm("update", c)}
                  />
                }
                label="Update"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!perms.delete}
                    onChange={(_, c) => togglePerm("delete", c)}
                  />
                }
                label="Delete"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!perms.approve}
                    onChange={(_, c) => togglePerm("approve", c)}
                  />
                }
                label="Approve"
              />
            </Stack>
            <FormHelperText sx={{ mt: 0.5 }}>
              ตั้งค่าสิทธิ์ย่อยที่ใช้จริงในหน้าใช้งาน
            </FormHelperText>
          </Box>

          {isEdit && (
            <Alert severity="info" icon={false} sx={{ mt: 0.5 }}>
              <Typography variant="body2">
                การแก้ไขจะส่งไปที่{" "}
                <code>PUT /api/admin/users/{String(editing?._id)}</code> แล้ว
                proxy จะ forward เป็น <strong>PATCH</strong> ไปยัง Nest
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ minWidth: 120 }}
        >
          {saving ? "กำลังบันทึก..." : isEdit ? "บันทึก" : "สร้าง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
