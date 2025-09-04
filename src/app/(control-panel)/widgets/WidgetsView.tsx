// src/app/(control-panel)/views/WidgetsView.tsx
"use client";

import LocationCascadeSelect, {
  type LocationValue,
} from "@/components/widgets/LocationCascadeSelect";
import FusePageSimple from "@fuse/core/FusePageSimple";
import {
  Box,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

const Root = styled(FusePageSimple)(({ theme }) => ({
  "& .FusePageSimple-header": {
    backgroundColor: theme.vars.palette.background.paper,
    borderBottomWidth: 1,
    borderStyle: "solid",
    borderColor: theme.vars.palette.divider,
  },
}));

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

export default function WidgetsView() {
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

  const { data: session, status } = useSession();

  const [data, setData] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4005/api";

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
        const res = await fetch(`${apiBase}/users/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Fetch /users/me failed: ${res.status}`);
        }

        const json = (await res.json()) as UserMe;
        if (mounted) setData(json);
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? "Failed to load profile");
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
  }, [apiBase, accessToken, status]);

  const fullName = useMemo(() => {
    if (!data) return "";
    const n = data.name ?? "";
    const l = data.lastName ?? "";
    return [n, l].filter(Boolean).join(" ");
  }, [data]);

  return (
    <Root
      header={
        <div className="p-6">
          <Typography variant="h6">All Widgets By Apiwat.S </Typography>
        </div>
      }
      content={
        <Box className="p-6">
          <Stack spacing={4}>
            {/* Widget 1: Location Select (Thai) */}
            <Paper className="p-6">
              <Typography variant="h6" gutterBottom>
                Location Cascade Select (ภาษาไทย)
              </Typography>
              <LocationCascadeSelect
                lang="th"
                value={th}
                onChange={setTh}
                helperTextProvince="เลือกจังหวัด"
                helperTextDistrict="เลือกอำเภอ/เขต"
                helperTextSubdistrict="เลือกตำบล/แขวง"
                helperTextPostalCode="กรอกอัตโนมัติจากตำบล/แขวง"
                showPostalInOptions={false}
              />
            </Paper>

            {/* Widget 2: Location Select (English) */}
            <Paper className="p-6">
              <Typography variant="h6" gutterBottom>
                Location Cascade Select (English)
              </Typography>
              <LocationCascadeSelect
                lang="en"
                value={en}
                onChange={setEn}
                helperTextProvince="Select province"
                helperTextDistrict="Select district"
                helperTextSubdistrict="Select subdistrict"
                helperTextPostalCode="Auto-filled from subdistrict"
                showPostalInOptions={false}
              />
            </Paper>
            <Divider />
            <Paper className="p-6">
              <Typography variant="h6" gutterBottom>
                Session Information
              </Typography>
              {status === "loading" ? (
                <Box className="flex items-center gap-2">
                  <CircularProgress size={20} /> <span>Loading session…</span>
                </Box>
              ) : status === "unauthenticated" ? (
                <Typography>คุณยังไม่ได้เข้าสู่ระบบ</Typography>
              ) : loading ? (
                <Box className="flex items-center gap-2">
                  <CircularProgress size={20} /> <span>Loading profile…</span>
                </Box>
              ) : err ? (
                <Typography color="error" gutterBottom>
                  {err}
                </Typography>
              ) : !data ? (
                <Typography>ไม่พบข้อมูลผู้ใช้</Typography>
              ) : (
                <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
                  <Box className="flex-1">
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
                  </Box>

                  <Box className="flex-1">
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
                  </Box>

                  <Box className="flex-1">
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
                  </Box>

                  <Box className="flex-1">
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
                  </Box>
                </Stack>
              )}
            </Paper>
          </Stack>
        </Box>
      }
    />
  );
}
