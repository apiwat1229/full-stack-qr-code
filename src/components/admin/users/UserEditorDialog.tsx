// src/components/admin/users/UserEditorDialog.tsx
"use client";

import { fetchJSON } from "@/lib/api";
import { UserRow } from "@/types/user";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import * as React from "react";

// endpoint helper
const USERS_API = (path = "") => `/api/admin/users${path}`;

// รายการตำแหน่ง/แผนก (ตัวอย่าง – ปรับเพิ่ม/ลดได้)
const POSITION_OPTIONS = ["Manager", "Staff", "Supervisor", "Lead", "Intern"];
const DEPARTMENT_OPTIONS = ["IT", "HR", "Finance", "Operations", "Sales"];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: UserRow | null;
  allUsers: UserRow[];
  authHeaders: Record<string, string>;
};

export default function UserEditorDialog({
  open,
  onClose,
  onSaved,
  editing,
  allUsers,
  authHeaders,
}: Props) {
  const isEdit = !!editing?._id;

  // form state
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [name, setName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [role, setRole] = React.useState<"user" | "staff" | "admin">("user");

  // HOD
  const [hod, setHod] = React.useState<string>(""); // เก็บเป็น ObjectId string ตาม DTO

  // permissions (จะ map → permission)
  const [pCreate, setPCreate] = React.useState(false);
  const [pRead, setPRead] = React.useState(true);
  const [pUpdate, setPUpdate] = React.useState(false);
  const [pDelete, setPDelete] = React.useState(false);
  const [pApprove, setPApprove] = React.useState(false);

  // password ใช้เฉพาะตอนสร้าง
  const [password, setPassword] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // ผู้สมัครเป็น HOD: role=admin และตำแหน่ง Manager
  const hodCandidates = React.useMemo(() => {
    return (allUsers || []).filter((u) => {
      const pos =
        (u as any).position ?? (u as any).jobTitle ?? (u as any).title ?? "";
      return (
        String(u.role).toLowerCase() === "admin" &&
        String(pos).toLowerCase() === "manager"
      );
    });
  }, [allUsers]);

  // init form
  React.useEffect(() => {
    if (!open) return;

    if (editing) {
      setEmail(editing.email || "");
      setUsername(editing.username || "");
      setName(editing.name || "");
      setLastName(editing.lastName || "");
      setDepartment(editing.department || "");
      setPosition((editing as any).position || "");
      setRole((editing.role as any) || "user");

      // hod รับได้ทั้ง user.hod เป็น object หรือ user.hod.id/_id หรือ user.hodId
      const hodObj = (editing as any).hod ?? null;
      const hodId =
        (editing as any).hodId ||
        hodObj?.id ||
        hodObj?._id ||
        (editing as any).managerId ||
        "";
      setHod(String(hodId || ""));

      const perms =
        (editing as any).permission ||
        (editing as any).perms ||
        (editing as any).permissions ||
        {};
      setPCreate(!!perms.create);
      setPRead(perms.read !== false); // default true
      setPUpdate(!!perms.update);
      setPDelete(!!perms.delete);
      setPApprove(!!perms.approve);

      setPassword("");
    } else {
      setEmail("");
      setUsername("");
      setName("");
      setLastName("");
      setDepartment("");
      setPosition("");
      setRole("user");
      setHod("");

      setPCreate(false);
      setPRead(true);
      setPUpdate(false);
      setPDelete(false);
      setPApprove(false);
      setPassword("");
    }
    setErr(null);
  }, [open, editing]);

  const validate = () => {
    if (!email.trim()) return "กรุณากรอกอีเมล";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "รูปแบบอีเมลไม่ถูกต้อง";
    if (!username.trim()) return "กรุณากรอก Username";
    if (!name.trim()) return "กรุณากรอกชื่อ";
    if (!lastName.trim()) return "กรุณากรอกนามสกุล";
    if (!isEdit && !password.trim()) return "กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่";

    // กันซ้ำฝั่ง client เบาๆ
    if (
      !isEdit &&
      allUsers.some(
        (u) => (u.email || "").toLowerCase() === email.toLowerCase()
      )
    ) {
      return "อีเมลนี้มีอยู่แล้ว";
    }
    if (
      !isEdit &&
      allUsers.some(
        (u) => (u.username || "").toLowerCase() === username.toLowerCase()
      )
    ) {
      return "Username นี้มีอยู่แล้ว";
    }
    return null;
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setSaving(true);
    setErr(null);

    try {
      // —— สร้าง payload ให้ตรง DTO ——
      const payload: any = {
        email: email.trim(),
        username: username.trim(),
        department: department.trim() || undefined,
        position: position.trim() || undefined,
        name: name.trim(),
        lastName: lastName.trim(),
        role, // 'user' | 'staff' | 'admin'
        permission: {
          create: pCreate,
          read: pRead,
          update: pUpdate,
          delete: pDelete,
          approve: pApprove,
        },
      };

      // ส่ง HOD เป็น field 'hod' (ObjectId string) ตาม DTO
      if (hod) payload.hod = hod;

      // สร้างใหม่ต้องมี password
      if (!isEdit && password.trim()) {
        payload.password = password.trim();
      }

      const url = isEdit ? USERS_API(`/${editing!._id}`) : USERS_API();
      const method = isEdit ? "PATCH" : "POST"; // <<< สำคัญ: ใช้ PATCH ตาม Nest

      await fetchJSON<UserRow>(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      onSaved();
      onClose();
    } catch (e: any) {
      const msg = String(e?.message || "บันทึกไม่สำเร็จ");
      if (/401|unauthorized/i.test(msg))
        setErr("ไม่ได้รับอนุญาต (Token ไม่ถูกต้อง/หมดอายุ)");
      else if (/409|duplicate|exists|email|username/i.test(msg))
        setErr("อีเมลหรือ Username ถูกใช้ไปแล้ว");
      else if (/400|bad request/i.test(msg))
        setErr("คำขอไม่ถูกต้อง (ตรวจรูปแบบฟิลด์ที่ส่ง)");
      else setErr(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>{isEdit ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle>
      <DialogContent dividers>
        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        {/* Email / Username */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="อีเมล *"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <TextField
            label="Username *"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Stack>

        {/* Name / LastName */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="ชื่อ *"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="นามสกุล *"
            fullWidth
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Stack>

        {/* Department / Position (select) */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="แผนก"
            select
            fullWidth
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {DEPARTMENT_OPTIONS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="ตำแหน่ง (Position)"
            select
            fullWidth
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {POSITION_OPTIONS.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* Role */}
        <TextField
          label="Role"
          select
          fullWidth
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="user">user</MenuItem>
          <MenuItem value="staff">staff</MenuItem>
          <MenuItem value="admin">admin</MenuItem>
        </TextField>

        {/* HOD Selector (เฉพาะ Admin ที่เป็น Manager) */}
        <TextField
          label="HOD (Admin ที่เป็น Manager)"
          select
          fullWidth
          value={hod}
          onChange={(e) => setHod(e.target.value)}
          sx={{ mb: 2 }}
          helperText="เลือกหัวหน้าฝ่ายที่ดูแลผู้ใช้นี้ (ไม่บังคับ)"
        >
          <MenuItem value="">— ไม่ระบุ —</MenuItem>
          {hodCandidates.map((u) => {
            const id = String((u as any).id || (u as any)._id || "");
            const label =
              `${u.name || ""} ${u.lastName || ""}`.trim() ||
              u.username ||
              u.email ||
              id;
            return (
              <MenuItem key={id} value={id}>
                {label}
                {u.department ? `  •  ${u.department}` : ""}
                {(u as any).position ? `  •  ${(u as any).position}` : ""}
              </MenuItem>
            );
          })}
        </TextField>

        {/* Password (create only) */}
        {!isEdit && (
          <TextField
            label="รหัสผ่าน (สำหรับผู้ใช้ใหม่) *"
            fullWidth
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
          />
        )}

        {/* Permissions */}
        <Stack direction="row" spacing={3}>
          <FormControlLabel
            control={
              <Switch
                checked={pCreate}
                onChange={(e) => setPCreate(e.target.checked)}
              />
            }
            label="Create"
          />
          <FormControlLabel
            control={
              <Switch
                checked={pRead}
                onChange={(e) => setPRead(e.target.checked)}
              />
            }
            label="Read"
          />
          <FormControlLabel
            control={
              <Switch
                checked={pUpdate}
                onChange={(e) => setPUpdate(e.target.checked)}
              />
            }
            label="Update"
          />
          <FormControlLabel
            control={
              <Switch
                checked={pDelete}
                onChange={(e) => setPDelete(e.target.checked)}
              />
            }
            label="Delete"
          />
          <FormControlLabel
            control={
              <Switch
                checked={pApprove}
                onChange={(e) => setPApprove(e.target.checked)}
              />
            }
            label="Approve"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} /> : null}
        >
          {isEdit ? "บันทึก" : "สร้าง"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
