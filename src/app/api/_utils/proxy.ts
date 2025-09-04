// src/app/api/_utils/proxy.ts
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th").replace(/\/+$/, "");
export const DEBUG = process.env.NEXT_PUBLIC_DEBUG_PROXY === "1";

export function isHttps(req: NextRequest) {
    const xfProto = req.headers.get("x-forwarded-proto");
    if (xfProto) return xfProto.split(",")[0].trim() === "https";
    return req.nextUrl.protocol === "https:";
}

export async function pickBearer(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
        return { token: auth.slice(7).trim(), source: "Authorization header" as const };
    }
    const cookieToken =
        req.cookies.get("backend_token")?.value ||
        req.cookies.get("access_token")?.value ||
        req.cookies.get("token")?.value;
    if (cookieToken) {
        return { token: cookieToken, source: "cookie: backend_token/access_token/token" as const };
    }
    try {
        const jwt = await getToken({ req, secureCookie: isHttps(req) });
        const at = (jwt as any)?.accessToken ?? (jwt as any)?.backendToken ?? (jwt as any)?.token;
        if (at) return { token: at, source: "nextauth token" as const };
    } catch {/* ignore */ }
    return { token: "", source: "none" as const };
}

export async function forwardRaw(
    req: NextRequest,
    upstream: string,
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
) {
    if (!BACKEND) {
        return NextResponse.json({ error: "Missing BACKEND URL (NEXT_PUBLIC_BACKEND_URL)" }, { status: 500 });
    }
    const { token, source } = await pickBearer(req);
    if (!token) {
        const res = NextResponse.json({
            error: "Unauthorized (no credentials to call backend via proxy)",
            how_to_fix:
                "แนบ Authorization: Bearer <token> หรือเก็บ token ไว้ในคุกกี้ชื่อ backend_token/access_token/token หรือบันทึกลง NextAuth JWT เป็น token.accessToken",
        }, { status: 401 });
        if (DEBUG) res.headers.set("x-debug-auth-source", source);
        return res;
    }

    // เตรียม headers จริง ๆ เพื่อจะ set content-type ได้
    const headers = new Headers({
        accept: "application/json",
        authorization: `Bearer ${token}`,
    });

    const init: RequestInit = {
        method,
        headers,
        cache: "no-store",
        // @ts-ignore
        next: { revalidate: 0 },
    };

    // รองรับ body สำหรับ POST/PATCH/PUT/DELETE
    if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
        const body = await req.text();
        if (body) {
            headers.set("content-type", "application/json");
            init.body = body;
        }
    }

    try {
        const r = await fetch(upstream, init);
        const txt = await r.text().catch(() => "");
        const out = new NextResponse(txt || (r.ok ? "{}" : r.statusText), {
            status: r.status,
            headers: {
                "content-type": r.headers.get("content-type") || "application/json",
                "cache-control": "no-store",
            },
        });
        if (DEBUG) out.headers.set("x-debug-auth-source", source);
        return out;
    } catch (e: any) {
        const res = NextResponse.json({ error: `Upstream fetch error: ${e?.message || "network error"}` }, { status: 502 });
        if (DEBUG) res.headers.set("x-debug-auth-source", "forward-error");
        return res;
    }
}