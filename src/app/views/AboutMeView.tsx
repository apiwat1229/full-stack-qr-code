"use client";

import { type LocationValue } from "@/components/widgets/LocationCascadeSelect";
import FusePageSimple from "@fuse/core/FusePageSimple";

import {
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type UserMe = {
  id: string;
  email: string;
  role: string | string[];
  username?: string;
  department?: string;
  name?: string;
  lastName?: string;
  permission?: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    approve: boolean;
  };
  hod?: {
    email?: string;
    role?: string;
    username?: string;
    name?: string;
    lastName?: string;
    id?: string;
  };
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
  passwordChangedAt?: string;
};

const Root = styled(FusePageSimple)(({ theme }) => ({
  "& .FusePageSimple-header": {
    backgroundColor: theme.vars.palette.background.paper,
    borderBottomWidth: 1,
    borderStyle: "solid",
    borderColor: theme.vars.palette.divider,
  },
}));

export default function AboutMeView() {
  const [th, setTh] = useState<LocationValue>({
    provinceCode: null,
    districtCode: null,
    subdistrictCode: null,
    postalCode: null,
  });

  const [en, setEn] = useState<LocationValue>({
    provinceCode: null,
    districtCode: null,
    subdistrictCode: null,
    postalCode: null,
  });

  const { t } = useTranslation("examplePage");
  const { data: session, status } = useSession();

  const [data, setData] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accessToken =
    (session as any)?.accessToken ??
    (session as any)?.token?.accessToken ??
    undefined;

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // ✅ เรียกผ่าน proxy เสมอ
        const res = await fetch(`/api/users/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          // credentials: include จะให้ cookie ไปกับ FE→Next เท่านั้น (โอเค)
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          // พยายามอ่าน message จาก backend (ถ้ามี)
          let msg = `Fetch /users/me failed: ${res.status}`;
          try {
            const j = await res.json();
            if (j?.message) msg = j.message;
          } catch {}
          // 401 → ให้เด้งไป login
          if (res.status === 401) {
            setErr("หมดอายุการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่");
            await signIn();
            return;
          }
          throw new Error(msg);
        }

        const json = (await res.json()) as UserMe;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) {
          setErr(e?.message ?? "Failed to load profile");
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (status === "authenticated") {
      load();
    } else if (status === "unauthenticated") {
      setData(null);
    }

    return () => {
      mounted = false;
    };
  }, [accessToken, status]);

  const fullName = useMemo(() => {
    if (!data) return "";
    const n = data.name ?? "";
    const l = data.lastName ?? "";
    return [n, l].filter(Boolean).join(" ");
  }, [data]);

  return (
    <Root
      content={
        <Box className="p-6">
          {status === "loading" ? (
            <Box className="flex items-center gap-2">
              <CircularProgress size={20} /> <span>Loading session…</span>
            </Box>
          ) : status === "unauthenticated" ? (
            <Paper className="p-6">
              <Typography variant="body1" gutterBottom>
                คุณยังไม่ได้เข้าสู่ระบบ
              </Typography>
              <Typography
                color="primary"
                sx={{ cursor: "pointer" }}
                onClick={() => signIn()}
              >
                ไปหน้าเข้าสู่ระบบ
              </Typography>
            </Paper>
          ) : loading ? (
            <Box className="flex items-center gap-2">
              <CircularProgress size={20} /> <span>Loading profile…</span>
            </Box>
          ) : err ? (
            <Paper className="p-6">
              <Typography color="error" gutterBottom>
                {err}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ไม่สามารถดึงข้อมูลจาก API ได้
              </Typography>
            </Paper>
          ) : !data ? (
            <Typography>ไม่พบข้อมูลผู้ใช้</Typography>
          ) : (
            <Box className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
              <Box className="flex-1">
                <Paper className="p-6">
                  <Typography variant="subtitle1" gutterBottom>
                    ข้อมูลผู้ใช้
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="ชื่อ - นามสกุล"
                        secondary={fullName || "-"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="อีเมล"
                        secondary={data.email || "-"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="บทบาท (role)"
                        secondary={
                          Array.isArray(data.role)
                            ? data.role.join(", ")
                            : data.role || "-"
                        }
                      />
                    </ListItem>
                    {data.username && (
                      <ListItem>
                        <ListItemText
                          primary="Username"
                          secondary={data.username}
                        />
                      </ListItem>
                    )}
                    {data.department && (
                      <ListItem>
                        <ListItemText
                          primary="แผนก"
                          secondary={data.department}
                        />
                      </ListItem>
                    )}
                    {typeof data.mustChangePassword === "boolean" && (
                      <ListItem>
                        <ListItemText
                          primary="ต้องเปลี่ยนรหัสผ่านครั้งแรก"
                          secondary={data.mustChangePassword ? "Yes" : "No"}
                        />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              </Box>

              <Box className="flex-1">
                <Paper className="p-6">
                  <Typography variant="subtitle1" gutterBottom>
                    สิทธิ์การใช้งาน (permission)
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Create"
                        secondary={data.permission?.create ? "✓" : "✗"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Read"
                        secondary={data.permission?.read ? "✓" : "✗"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Update"
                        secondary={data.permission?.update ? "✓" : "✗"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Delete"
                        secondary={data.permission?.delete ? "✓" : "✗"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Approve"
                        secondary={data.permission?.approve ? "✓" : "✗"}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Box>

              <Box className="flex-1 mt-4 md:mt-0">
                <Paper className="p-6">
                  <Typography variant="subtitle1" gutterBottom>
                    หัวหน้า (HOD)
                  </Typography>
                  {data.hod ? (
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="ชื่อ"
                          secondary={`${data.hod.name ?? "-"} ${data.hod.lastName ?? ""}`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="อีเมล"
                          secondary={data.hod.email ?? "-"}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Role"
                          secondary={data.hod.role ?? "-"}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Username"
                          secondary={data.hod.username ?? "-"}
                        />
                      </ListItem>
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  )}
                </Paper>
              </Box>

              <Box className="w-full mt-4 md:w-1/3">
                <Paper className="p-6">
                  <Typography variant="subtitle1" gutterBottom>
                    Timestamps
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText
                        primary="Created At"
                        secondary={data.createdAt ?? "-"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Updated At"
                        secondary={data.updatedAt ?? "-"}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Password Changed At"
                        secondary={data.passwordChangedAt ?? "-"}
                      />
                    </ListItem>
                  </List>
                </Paper>
              </Box>
            </Box>
          )}
        </Box>
      }
    />
  );
}
