// src/app/api/admin/users/route.ts
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th").replace(/\/+$/, "");
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_PROXY === "1";

type AuthPick =
    | { kind: "Authorization header"; value: string }
    | { kind: "cookie: backend_token"; value: string }
    | { kind: "cookie: access_token"; value: string }
    | { kind: "cookie: token"; value: string }
    | { kind: "nextauth token"; value: string }
    | { kind: "dev query token"; value: string }
    | { kind: "none" };

function isHttps(req: NextRequest) {
    const xf = req.headers.get("x-forwarded-proto");
    if (xf) return xf.split(",")[0].trim() === "https";
    return req.nextUrl.protocol === "https:";
}

async function buildAuthHeaders(req: NextRequest): Promise<{ headers: Headers; source: AuthPick }> {
    const h = new Headers();

    // ส่งต่อ cookie (บางระบบใช้ session cookie)
    const cookie = req.headers.get("cookie");
    if (cookie) h.set("cookie", cookie);

    // 0) DEV ONLY: อนุญาต token จาก query ?token=... เพื่อดีบัก (อย่าใช้ใน prod)
    if (process.env.NODE_ENV !== "production") {
        const tokenFromQuery = req.nextUrl.searchParams.get("token");
        if (tokenFromQuery) {
            h.set("authorization", `Bearer ${tokenFromQuery}`);
            h.set("accept", "application/json");
            return { headers: h, source: { kind: "dev query token", value: tokenFromQuery } };
        }
    }

    // 1) Authorization header จาก client
    const incomingAuth = req.headers.get("authorization");
    if (incomingAuth) {
        h.set("authorization", incomingAuth);
        h.set("accept", "application/json");
        return { headers: h, source: { kind: "Authorization header", value: incomingAuth } };
    }

    // 2) Bearer จาก cookie
    const cBackend = req.cookies.get("backend_token")?.value;
    const cAccess = req.cookies.get("access_token")?.value;
    const cToken = req.cookies.get("token")?.value;
    const bearer = cBackend || cAccess || cToken;
    if (bearer) {
        h.set("authorization", `Bearer ${bearer}`);
        h.set("accept", "application/json");
        const label = cBackend ? "cookie: backend_token" : cAccess ? "cookie: access_token" : "cookie: token";
        return { headers: h, source: { kind: label as any, value: bearer } };
    }

    // 3) NextAuth JWT (อ่าน cookie httpOnly ผ่าน getToken)
    try {
        const secure =
            isHttps(req) ||
            process.env.NODE_ENV === "production" ||
            (process.env.NEXTAUTH_URL || "").startsWith("https");
        const token = await getToken({ req, secureCookie: secure });
        const jwtAccess =
            (token as any)?.accessToken ??
            (token as any)?.backendToken ??
            (token as any)?.token;

        if (jwtAccess) {
            h.set("authorization", `Bearer ${jwtAccess}`);
            h.set("accept", "application/json");
            return { headers: h, source: { kind: "nextauth token", value: jwtAccess } };
        }
    } catch (e) {
        console.warn("[proxy] getToken error:", e);
    }

    h.set("accept", "application/json");
    return { headers: h, source: { kind: "none" } };
}

async function forward(req: NextRequest, method: "GET" | "POST") {
    if (!BACKEND) {
        return NextResponse.json(
            { error: "Missing BACKEND URL (NEXT_PUBLIC_BACKEND_URL)" },
            { status: 500 }
        );
    }

    const { headers, source } = await buildAuthHeaders(req);

    if (source.kind === "none") {
        const res = NextResponse.json(
            {
                error: "Unauthorized (no credentials to call backend via proxy)",
                how_to_fix:
                    "แนบ Authorization: Bearer <token> ที่ client หรือเก็บ token ใน cookie backend_token/access_token/token หรือให้ NextAuth บันทึกลง JWT เป็น token.accessToken",
            },
            { status: 401 }
        );
        if (DEBUG) res.headers.set("x-debug-auth-source", source.kind);
        return res;
    }

    const url = new URL(req.url);
    const qs = url.search || "";
    const upstream = `${BACKEND}/api/users${qs}`;

    const init: RequestInit = {
        method,
        headers,
        cache: "no-store",
        // @ts-ignore
        next: { revalidate: 0 },
    };

    if (method === "POST") {
        const bodyText = await req.text();
        if (bodyText) (init.headers as Headers).set("content-type", "application/json");
        init.body = bodyText || undefined;
    }

    try {
        const r = await fetch(upstream, init);
        const txt = await r.text().catch(() => "");
        const out = new NextResponse(txt || (r.ok ? "[]" : r.statusText), {
            status: r.status,
            headers: {
                "content-type": r.headers.get("content-type") || "application/json",
                "cache-control": "no-store",
                ...(DEBUG ? { "x-debug-auth-source": source.kind } : {}),
            },
        });
        return out;
    } catch (e: any) {
        const res = NextResponse.json(
            { error: `Upstream fetch error: ${e?.message || "network error"}` },
            { status: 502 }
        );
        if (DEBUG) res.headers.set("x-debug-auth-source", source.kind);
        return res;
    }
}

export async function GET(req: NextRequest) {
    return forward(req, "GET");
}
export async function POST(req: NextRequest) {
    return forward(req, "POST");
}