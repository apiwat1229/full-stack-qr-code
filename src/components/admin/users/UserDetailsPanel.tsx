// src/components/admin/users/UserDetailsPanel.tsx
"use client";

import type { UserRow } from "@/types/user";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import * as React from "react";

/**
 * props:
 * - user: ผู้ใช้ที่ถูกเลือก
 * - allUsers: รายชื่อผู้ใช้ทั้งหมด ใช้คำนวณ downline (optional)
 * - hodResolver: ฟังก์ชันแปลง HOD id → ชื่อ (ถ้าต้องการ override)
 */
type Props = {
  user?: UserRow | null;
  allUsers?: UserRow[];
  hodResolver?: (id: string) => string | undefined;
};

function formatDate(v?: string | number | Date) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

/** ดึง id แบบปลอดภัย รองรับทั้ง _id และ id */
function getId(u: any): string {
  return String(u?.id || u?._id || "") || "";
}

/** ดึง hod id จาก user (รองรับหลายฟอร์แมต) */
function getHodId(u: any): string {
  const hodObj = u?.hod ?? u?.manager ?? null;
  return (
    String(u?.hodId || u?.managerId || hodObj?._id || hodObj?.id || "") || ""
  );
}

/** ดึงชื่อ-นามสกุล/username/email สำหรับแสดง */
function displayName(u: any): string {
  const full = `${u?.name ?? ""} ${u?.lastName ?? ""}`.trim();
  return full || u?.username || u?.email || getId(u) || "-";
}

/** ดึงตำแหน่ง (รองรับ position/jobTitle/title) */
function getPosition(u: any): string {
  return String(u?.position ?? u?.jobTitle ?? u?.title ?? "").trim();
}

export default function UserDetailsPanel({
  user,
  allUsers = [],
  hodResolver,
}: Props) {
  if (!user) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          ยังไม่ได้เลือกผู้ใช้
        </Typography>
      </Box>
    );
  }

  // permission (รองรับ permission หรือ perms)
  const perms =
    (user as any).permission ??
    (user as any).perms ??
    ({
      create: false,
      read: false,
      update: false,
      delete: false,
      approve: false,
    } as Record<"create" | "read" | "update" | "delete" | "approve", boolean>);

  // --- HOD/Manager ของ user ปัจจุบัน ---
  const hodObj = (user as any).hod ?? (user as any).manager ?? null;

  const currentHodId: string = getHodId(user);
  const hodNameRaw: string =
    (hodObj && `${hodObj.name ?? ""} ${hodObj.lastName ?? ""}`.trim()) ||
    (user as any).hodName ||
    (user as any).managerName ||
    "";

  // แผนที่ id -> user ใช้ lookup ชื่อ/แผนก/ตำแหน่ง
  const idMap = React.useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of allUsers) {
      const id = getId(u);
      if (id) m.set(id, u);
    }
    return m;
  }, [allUsers]);

  const resolvedHodName =
    hodNameRaw ||
    (currentHodId && hodResolver ? hodResolver(currentHodId) : "") ||
    (currentHodId && idMap.get(currentHodId)
      ? displayName(idMap.get(currentHodId))
      : "") ||
    (currentHodId ? `#${currentHodId}` : "-");

  const position = getPosition(user) || "-";

  // --- คำนวณ Downlines: ผู้ที่มี hod = user ปัจจุบัน ---
  const myId = getId(user);
  const downlines = React.useMemo(() => {
    if (!myId) return [];
    return (allUsers || []).filter((u) => getHodId(u) === myId);
  }, [allUsers, myId]);

  return (
    <Stack spacing={1.25}>
      <Typography variant="subtitle1" fontWeight={700}>
        {displayName(user)}
      </Typography>

      <Stack spacing={0.25}>
        <Typography variant="body2">
          Username: {user.username || "-"}
        </Typography>
        <Typography variant="body2">Email: {user.email || "-"}</Typography>
        <Typography variant="body2">Dept: {user.department || "-"}</Typography>
        <Typography variant="body2">Position: {position}</Typography>
        <Typography variant="body2">Role: {user.role || "-"}</Typography>
        <Typography variant="body2">HOD: {resolvedHodName}</Typography>
      </Stack>

      <Divider sx={{ my: 1 }} />

      <Typography variant="subtitle2">Permissions</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        {(["create", "read", "update", "delete", "approve"] as const).map(
          (k) => {
            const on = !!perms[k];
            return (
              <Chip
                key={k}
                label={k}
                size="small"
                color={on ? "primary" : "default"}
                variant={on ? "filled" : "outlined"}
                sx={{ textTransform: "capitalize" }}
              />
            );
          }
        )}
      </Stack>

      {/* เวลา */}
      {(user as any).createdAt || (user as any).updatedAt ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Created: {formatDate((user as any).createdAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Updated: {formatDate((user as any).updatedAt)}
            </Typography>
          </Stack>
        </>
      ) : null}

      {/* Downlines */}
      <Divider sx={{ my: 1 }} />
      <Typography variant="subtitle2">HOD Downline</Typography>
      {downlines.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          ไม่มีผู้ใต้อุปถัมภ์ (downline)
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {downlines.map((d) => {
            const dHodId = getHodId(d);
            const dHodName =
              (dHodId && idMap.get(dHodId)
                ? displayName(idMap.get(dHodId))
                : "") || (dHodId ? `#${dHodId}` : "-");

            const dPos = getPosition(d);
            const extras = [
              d.department ? `Dept: ${d.department}` : "",
              dPos ? `Position: ${dPos}` : "",
              d.role ? `Role: ${d.role}` : "",
              dHodName ? `HOD: ${dHodName}` : "",
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <Typography key={getId(d)} variant="body2">
                • {displayName(d)}
                {extras ? `  —  ${extras}` : ""}
              </Typography>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
