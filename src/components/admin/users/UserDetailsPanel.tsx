"use client";

import { UserRow, defaultPerms } from "@/types/user";
import { Chip, Stack, Typography } from "@mui/material";

export default function UserDetailsPanel({ user }: { user: UserRow | null }) {
  if (!user) {
    return (
      <Typography variant="body2" color="text.secondary">
        เลือกผู้ใช้จากตารางเพื่อดูรายละเอียด
      </Typography>
    );
  }

  const perms = {
    ...defaultPerms,
    ...(user.permission || user.permissions || {}),
  };
  const fullName = `${user.name || ""} ${user.lastName || ""}`.trim() || "-";

  return (
    <Stack spacing={2}>
      <Section title="ข้อมูลผู้ใช้">
        <Field label="ชื่อ - นามสกุล" value={fullName} />
        <Field label="อีเมล" value={user.email || "-"} />
        <Field label="บทบาท (role)" value={user.role || "-"} />
        <Field label="Username" value={user.username || "-"} />
        <Field label="แผนก" value={user.department || "-"} />
        <Field
          label="ต้องเปลี่ยนรหัสผ่านครั้งแรก"
          value={user.mustChangePassword ? "Yes" : "No"}
        />
      </Section>

      <Section title="สิทธิ์การใช้งาน (permission)">
        <PermRow name="Create" ok={!!perms.create} />
        <PermRow name="Read" ok={!!perms.read} />
        <PermRow name="Update" ok={!!perms.update} />
        <PermRow name="Delete" ok={!!perms.delete} />
        <PermRow name="Approve" ok={!!perms.approve} />
        {"checkin" in perms ? (
          <PermRow name="Check-in" ok={!!(perms as any).checkin} />
        ) : null}
      </Section>

      <Section title="หัวหน้า (HOD)">
        {user.hod ? (
          <>
            <Field
              label="ชื่อ"
              value={
                `${user.hod.name || ""} ${user.hod.lastName || ""}`.trim() ||
                "-"
              }
            />
            <Field label="อีเมล" value={user.hod.email || "-"} />
            <Field label="Role" value={user.hod.role || "-"} />
            <Field label="Username" value={user.hod.username || "-"} />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            -
          </Typography>
        )}
      </Section>

      <Section title="Timestamps">
        <Field label="Created At" value={user.createdAt || "-"} mono />
        <Field label="Updated At" value={user.updatedAt || "-"} mono />
        <Field
          label="Password Changed At"
          value={user.passwordChangedAt || "-"}
          mono
        />
      </Section>
    </Stack>
  );
}

/* helpers */
function Section({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) {
  return (
    <Stack spacing={1.2}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Stack spacing={0.5}>{children}</Stack>
    </Stack>
  );
}
function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: mono ? "monospace" : undefined,
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
function PermRow({ name, ok }: { name: string; ok: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body2" sx={{ minWidth: 90 }}>
        {name}
      </Typography>
      <Chip
        size="small"
        label={ok ? "✓" : "✗"}
        color={ok ? "success" : "default"}
        variant={ok ? "filled" : "outlined"}
        sx={{ height: 22, borderRadius: 999, fontWeight: 700 }}
      />
    </Stack>
  );
}
