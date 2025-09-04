// src/app/api/admin/users/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th").replace(/\/+$/, "");

async function pickBearer(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) return { token: auth.slice(7).trim(), source: "Authorization header" };
    const cookieToken =
        req.cookies.get("backend_token")?.value ||
        req.cookies.get("access_token")?.value ||
        req.cookies.get("token")?.value;
    if (cookieToken) return { token: cookieToken, source: "cookie: backend_token/access_token/token" };
    const jwt = await getToken({ req });
    const at = (jwt as any)?.accessToken;
    if (at) return { token: at, source: "nextauth token" };
    return { token: "", source: "none" };
}

async function forward(req: NextRequest, method: "GET" | "PUT" | "DELETE") {
    const { token, source } = await pickBearer(req);
    if (!token) {
        return NextResponse.json(
            {
                error: "Unauthorized (no credentials to call backend via proxy)",
                how_to_fix:
                    "แนบ Authorization: Bearer <token> หรือเก็บ token ไว้ในคุกกี้ชื่อ backend_token/access_token/token หรือบันทึกลง NextAuth JWT เป็น token.accessToken",
            },
            { status: 401, headers: { "x-debug-auth-source": source } }
        );
    }

    const { pathname, search } = new URL(req.url);
    const id = pathname.split("/").pop();
    const upstream = `${BACKEND}/api/users/${encodeURIComponent(id || "")}${search || ""}`;

    const init: RequestInit = {
        method,
        headers: {
            accept: "application/json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
        },
        cache: "no-store",
    };

    if (method === "PUT") {
        const body = await req.text();
        init.body = body || undefined;
    }

    const r = await fetch(upstream, init);
    const txt = await r.text().catch(() => "");

    const headers: Record<string, string> = {
        "x-debug-auth-source": source,
        "content-type": r.headers.get("content-type") || "application/json",
    };

    if (!r.ok) return new NextResponse(txt || r.statusText, { status: r.status, headers });
    return new NextResponse(txt, { status: r.status, headers });
}

export async function GET(req: NextRequest) {
    return forward(req, "GET");
}
export async function PUT(req: NextRequest) {
    return forward(req, "PUT");
}
export async function DELETE(req: NextRequest) {
    return forward(req, "DELETE");
}