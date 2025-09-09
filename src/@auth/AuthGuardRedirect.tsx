// src/@auth/AuthGuardRedirect.tsx
"use client";

import {
  getSessionRedirectUrl,
  resetSessionRedirectUrl,
  setSessionRedirectUrl,
} from "@fuse/core/FuseAuthorization/sessionRedirectUrl";
import { FuseRouteObjectType } from "@fuse/core/FuseLayout/FuseLayout";
import FuseLoading from "@fuse/core/FuseLoading";
import useNavigate from "@fuse/hooks/useNavigate";
import usePathname from "@fuse/hooks/usePathname";
import FuseUtils from "@fuse/utils";
import React, { useCallback, useEffect, useState } from "react";
import useUser from "./useUser";

type AuthGuardProps = {
  auth: FuseRouteObjectType["auth"];
  children: React.ReactNode;
  /** ปลายทางปริยายถ้าไม่มี redirectUrl อื่น */
  loginRedirectUrl?: string;
};

// map ระบบ → เส้นทาง
const ROUTE_BY_SYSTEM: Record<string, string> = {
  qr: "/dashboard/qr-code/v1",
  dla: "/dashboard/dla/v1",
  pm: "/dashboard/pm/v1",
};

function AuthGuardRedirect({
  auth,
  children,
  loginRedirectUrl = "/example", // ✅ เปลี่ยน default จาก "/" → "/example"
}: AuthGuardProps) {
  const { data: user, isGuest } = useUser();
  const userRole = user?.role;
  const navigate = useNavigate();
  const pathname = usePathname();

  const [accessGranted, setAccessGranted] = useState<boolean>(false);

  // เลือกปลายทางเริ่มต้นเมื่อ "ไม่มี sessionRedirectUrl"
  const resolveDefaultRedirect = useCallback(() => {
    // 1) system จาก localStorage (client-side เท่านั้น)
    try {
      const s = localStorage.getItem("selected_system") || "";
      if (s && ROUTE_BY_SYSTEM[s]) return ROUTE_BY_SYSTEM[s];
    } catch {}

    // 2) ค่าที่ส่งเข้ามาใน props
    return loginRedirectUrl || "/";
  }, [loginRedirectUrl]);

  const handleRedirection = useCallback(() => {
    const redirectUrl = getSessionRedirectUrl() || resolveDefaultRedirect();

    if (isGuest) {
      navigate("/sign-in");
    } else {
      navigate(redirectUrl);
      resetSessionRedirectUrl();
    }
  }, [isGuest, navigate, resolveDefaultRedirect]);

  useEffect(() => {
    const isOnlyGuestAllowed = Array.isArray(auth) && auth.length === 0;
    const userHasPermission = FuseUtils.hasPermission(auth, userRole);
    const ignoredPaths = [
      "/",
      "/callback",
      "/sign-in",
      "/sign-out",
      "/logout",
      "/404",
    ];

    // ✅ ถ้าหน้า “/” และล็อกอินแล้ว ให้เด้งไปปลายทาง default
    if (!isGuest && pathname === "/") {
      setAccessGranted(false);
      navigate(resolveDefaultRedirect());
      return;
    }

    // ✅ กรณีเข้าหน้าที่เปิดสิทธิ์ตรง role หรือเป็น guest-only ที่เป็น guest จริง
    if (!auth || userHasPermission || (isOnlyGuestAllowed && isGuest)) {
      setAccessGranted(true);
      return;
    }

    // ✅ ตั้ง sessionRedirectUrl ไว้พากลับหลังผ่าน auth
    if (!userHasPermission) {
      if (isGuest && !ignoredPaths.includes(pathname)) {
        setSessionRedirectUrl(pathname);
      } else if (!isGuest && !ignoredPaths.includes(pathname)) {
        // เป็น member แต่ไม่มีสิทธิ์
        setSessionRedirectUrl(isOnlyGuestAllowed ? "/" : "/401");
      }
    }

    setAccessGranted(false);
    handleRedirection();
  }, [
    auth,
    userRole,
    isGuest,
    pathname,
    handleRedirection,
    navigate,
    resolveDefaultRedirect,
  ]);

  return accessGranted ? children : <FuseLoading />;
}

export default AuthGuardRedirect;
