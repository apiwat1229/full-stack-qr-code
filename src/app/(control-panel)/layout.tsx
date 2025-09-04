"use client";

import AuthGuardRedirect from "@auth/AuthGuardRedirect";
import type { ReactNode } from "react";
import MainLayout from "src/components/MainLayout";

// ⬇️ เพิ่มสำหรับ MUI X Date Pickers (Day.js)
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AuthGuardRedirect auth={["admin", "staff", "user"]}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <MainLayout>{children}</MainLayout>
      </LocalizationProvider>
    </AuthGuardRedirect>
  );
}
