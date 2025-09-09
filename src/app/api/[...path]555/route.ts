// src/app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
// ถ้าใช้ NextAuth และอยากดึง accessToken จาก session ให้เปิดบรรทัดล่างนี้
// import { getToken } from "next-auth/jwt";

const API_BASE_URL = (process.env.API_BASE_URL || "http://localhost:3001/api").replace(/\/+$/, "");

async function pickAuthHeader(req: NextRequest): Promise<string | undefined> {
    // 1) ส่งต่อ Authorization จาก client ถ้ามี
    const h = req.headers.get("authorization");
    if (h) return h;

    // 2) อ่านจาก cookie ที่ตั้งไว้ (เช่น backend_access_token)
    const cookieToken = req.cookies.get("backend_access_token")?.value;
    if (cookieToken) return `Bearer ${cookieToken}`;

    // 3) (ออปชัน) ใช้ NextAuth JWT
    // try {
    //   const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    //   const at = (token as any)?.accessToken || (token as any)?.access_token;
    //   if (at) return `Bearer ${at}`;
    // } catch {}

    // 4) dev fallback
    if (process.env.NEXT_PUBLIC_DEV_BACKEND_TOKEN) {
        return `Bearer ${process.env.NEXT_PUBLIC_DEV_BACKEND_TOKEN}`;
    }

    return undefined;
}

async function proxy(req: NextRequest) {
    // ตัด prefix /api/ ออกให้เหลือ subpath ที่จะต่อท้าย API_BASE_URL
    const subpath = req.nextUrl.pathname.replace(/^\/api\/?/, "");
    const targetUrl = `${API_BASE_URL}/${subpath}${req.nextUrl.search}`;

    const body =
        req.method === "GET" || req.method === "HEAD"
            ? undefined
            : await req.arrayBuffer();

    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("content-length");

    // เติม Authorization ถ้ายังไม่มี
    if (!headers.get("authorization")) {
        const auth = await pickAuthHeader(req);
        if (auth) headers.set("authorization", auth);
    }

    const res = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        redirect: "manual",
    });

    const out = new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
    });
    res.headers.forEach((v, k) => {
        if (k.toLowerCase() === "transfer-encoding") return;
        out.headers.set(k, v);
    });
    return out;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;