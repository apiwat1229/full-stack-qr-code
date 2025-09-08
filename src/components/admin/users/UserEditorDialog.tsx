"use client";

import { fetchJSON } from "@/lib/api";
import type { UserRow } from "@/types/user";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import * as React from "react";

// endpoint helper
const USERS_API = (path = "") => `/api/admin/users${path}`;

// ตัวเลือกแผนก/ตำแหน่ง
const DEPARTMENT_OPTIONS = [
  "IT",
  "HR",
  "Finance",
  "Operation",
  "Sales",
  "Engineering",
];
const POSITION_OPTIONS = [
  "Staff",
  "Senior Staff",
  "Supervisor",
  "Manager",
  "Head",
  "Director",
];

// ตรวจ ObjectId
const OID_RE = /^[0-9a-fA-F]{24}$/;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: UserRow | null;
  allUsers: UserRow[];
  authHeaders: Record<string, string>;
};

function getId(u: any): string {
  return String(u?.id || u?._id || "");
}

export default function UserEditorDialog({
  open,
  onClose,
  onSaved,
  editing,
  allUsers,
  authHeaders,
}: Props) {
  const isEdit = !!editing?._id || !!(editing as any)?.id;

  // form state
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [name, setName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [role, setRole] = React.useState<"user" | "staff" | "admin">("user");

  // HOD (optional)
  const [hodId, setHodId] = React.useState<string>("");

  // permissions
  const [pCreate, setPCreate] = React.useState(false);
  const [pRead, setPRead] = React.useState(true);
  const [pUpdate, setPUpdate] = React.useState(false);
  const [pDelete, setPDelete] = React.useState(false);
  const [pApprove, setPApprove] = React.useState(false);

  // password (create only)
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPw1, setShowPw1] = React.useState(false);
  const [showPw2, setShowPw2] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // HOD candidates
  const hodCandidates = React.useMemo(() => {
    return (allUsers || []).filter((u) => {
      const pos = String(
        (u as any).position ?? (u as any).jobTitle ?? (u as any).title ?? ""
      ).toLowerCase();
      return (
        String(u.role || "").toLowerCase() === "admin" &&
        ["manager", "head", "supervisor", "director"].includes(pos)
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
      setPosition(
        String(
          (editing as any).position ??
            (editing as any).jobTitle ??
            (editing as any).title ??
            ""
        )
      );
      setRole(((editing.role as any) || "user") as any);
      setHodId(
        String(
          (editing as any).hodId ??
            (editing as any).managerId ??
            (editing as any)?.hod?._id ??
            (editing as any)?.hod?.id ??
            ""
        )
      );

      const perms = (editing as any).permission || (editing as any).perms || {};
      setPCreate(!!perms.create);
      setPRead(perms.read !== false);
      setPUpdate(!!perms.update);
      setPDelete(!!perms.delete);
      setPApprove(!!perms.approve);

      setPassword("");
      setConfirmPassword("");
      setShowPw1(false);
      setShowPw2(false);
    } else {
      setEmail("");
      setUsername("");
      setName("");
      setLastName("");
      setDepartment("");
      setPosition("");
      setRole("user");
      setHodId("");
      setPCreate(false);
      setPRead(true);
      setPUpdate(false);
      setPDelete(false);
      setPApprove(false);
      setPassword("");
      setConfirmPassword("");
      setShowPw1(false);
      setShowPw2(false);
    }
    setErr(null);
  }, [open, editing]);

  // validate
  const validate = () => {
    if (!email.trim()) return "กรุณากรอกอีเมล";
    if (!/^\S+@\S+\.\S+$/.test(email)) return "รูปแบบอีเมลไม่ถูกต้อง";
    if (!username.trim()) return "กรุณากรอก Username";
    if (!name.trim()) return "กรุณากรอกชื่อ";
    if (!lastName.trim()) return "กรุณากรอกนามสกุล";
    if (!isEdit) {
      if (!password.trim()) return "กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่";
      if (password.trim().length < 6)
        return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
      if (confirmPassword.trim() !== password.trim())
        return "รหัสผ่านยืนยันไม่ตรงกัน";
    }
    if (hodId && !OID_RE.test(hodId)) return "HOD ไม่ถูกต้อง";

    if (!isEdit) {
      if (
        allUsers.some(
          (u) => (u.email || "").toLowerCase() === email.toLowerCase()
        )
      ) {
        return "อีเมลนี้มีอยู่แล้ว";
      }
      if (
        allUsers.some(
          (u) => (u.username || "").toLowerCase() === username.toLowerCase()
        )
      ) {
        return "Username นี้มีอยู่แล้ว";
      }
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
      const payload: any = {
        email: email.trim().toLowerCase(),
        username: username.trim(),
        name: name.trim(),
        lastName: lastName.trim(),
        role: String(role).toLowerCase(),
        ...(department.trim() ? { department: department.trim() } : {}),
        ...(position.trim() ? { position: position.trim() } : {}),
        permission: {
          create: pCreate,
          read: pRead,
          update: pUpdate,
          delete: pDelete,
          approve: pApprove,
        },
      };

      if (hodId && OID_RE.test(hodId)) payload.hod = hodId;
      if (!isEdit) payload.password = password.trim();

      const id = getId(editing);
      const url = isEdit ? USERS_API(`/${id}`) : USERS_API();
      const method = isEdit ? "PATCH" : "POST";

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
      if (/409|duplicate|exists|email|username/i.test(msg))
        setErr("อีเมลหรือ Username ถูกใช้ไปแล้ว");
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
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

        {/* Department / Position */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <TextField
            select
            label="แผนก (Department)"
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
            select
            label="ตำแหน่ง (Position)"
            fullWidth
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            helperText="เลือกตำแหน่งหลักของผู้ใช้"
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {POSITION_OPTIONS.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* Role / HOD */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Role"
            select
            fullWidth
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <MenuItem value="user">user</MenuItem>
            <MenuItem value="staff">staff</MenuItem>
            <MenuItem value="admin">admin</MenuItem>
          </TextField>

          <TextField
            label="HOD (Admin ที่เป็น Manager/Head/Supervisor/Director)"
            select
            fullWidth
            value={hodId}
            onChange={(e) => setHodId(e.target.value)}
            helperText="เลือกหัวหน้าฝ่าย (ถ้ามี)"
          >
            <MenuItem value="">— ไม่ระบุ —</MenuItem>
            {hodCandidates.map((u) => (
              <MenuItem key={getId(u)} value={getId(u)}>
                {`${u.name || ""} ${u.lastName || ""}`.trim() || u.username}
                {u.department ? `  •  ${u.department}` : ""}
                {(u as any).position || (u as any).jobTitle
                  ? `  •  ${String((u as any).position || (u as any).jobTitle)}`
                  : ""}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {/* Password & Confirm (create only) */}
        {!isEdit && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mb: 2 }}
          >
            <TextField
              label="รหัสผ่าน (สำหรับผู้ใช้ใหม่) *"
              fullWidth
              type={showPw1 ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="อย่างน้อย 6 ตัวอักษร"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPw1((v) => !v)}
                      edge="end"
                    >
                      {showPw1 ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="ยืนยันรหัสผ่าน *"
              fullWidth
              type={showPw2 ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={Boolean(confirmPassword) && confirmPassword !== password}
              helperText={
                Boolean(confirmPassword) && confirmPassword !== password
                  ? "รหัสผ่านยืนยันไม่ตรงกัน"
                  : " "
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowPw2((v) => !v)}
                      edge="end"
                    >
                      {showPw2 ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
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
