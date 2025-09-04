// src/lib/api.ts
"use client";

import { useSession } from "next-auth/react";
import * as React from "react";

export function api(path: string) {
    // ใช้ proxy ของ Next (app/api/admin/users)
    return path;
}

/** ดึง token จาก session ให้พร้อมใช้งานเป็น Header */
export function useAuthHeaders() {
    const { data } = useSession();
    const token =
        (data as any)?.accessToken ??
        (data as any)?.token?.accessToken ??
        (data as any)?.backendToken ??
        (data as any)?.token;

    return React.useMemo<HeadersInit>(() => {
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, [token]);
}

/** fetch helper ที่แนบ header/credentials ให้เหมาะกับ proxy */
export async function fetchJSON<T = any>(
    input: RequestInfo | URL,
    init: RequestInit = {}
): Promise<T> {
    const res = await fetch(input, {
        // ถ้า proxy อยู่ origin เดียวกัน ใช้ include เพื่อส่ง cookies ของ next-auth (เผื่อใช้ getToken ฝั่ง server)
        credentials: "include",
        cache: "no-store",
        ...init,
        headers: {
            Accept: "application/json",
            ...(init.headers || {}),
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let err: any = text;
        try {
            err = JSON.parse(text);
        } catch { }
        const message = err?.error || err?.message || res.statusText || `HTTP ${res.status}`;
        throw new Error(message);
    }
    // รองรับ empty body (204/205)
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
        const txt = await res.text().catch(() => "");
        return txt as unknown as T;
    }
    return (await res.json()) as T;
}