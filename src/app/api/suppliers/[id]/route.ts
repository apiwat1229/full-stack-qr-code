// src/app/api/suppliers/[id]/route.ts
import { auth } from "@auth/authJs";
import { NextRequest, NextResponse } from "next/server";
import type { Dispatcher } from "undici";

export const runtime = "nodejs";

function getApiBase() {
    const base =
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.API_PROXY_TARGET ||
        "";
    return base.replace(/\/$/, "");
}

async function getInsecureDispatcherIfNeeded() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") return undefined;
    const { Agent } = await import("undici");
    return new Agent({ connect: { rejectUnauthorized: false } });
}
type RequestInitWithDispatcher = RequestInit & { dispatcher?: Dispatcher };

async function requireTokenOrResponse() {
    try {
        const session = await auth();
        const accessToken = (session as any)?.accessToken;
        if (!accessToken) {
            return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
                status: 401,
                headers: { "content-type": "application/json" },
            });
        }
        return accessToken as string;
    } catch {
        return new NextResponse(JSON.stringify({ message: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
        });
    }
}

/** -------- GET -------- */
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ id: string }> } // 👈 รับเป็น Promise
) {
    const { id } = await ctx.params;         // 👈 แล้ว await
    const API_BASE = getApiBase();
    if (!API_BASE) {
        return NextResponse.json({ message: "Missing API base url" }, { status: 500 });
    }

    const tokenOrResp = await requireTokenOrResponse();
    if (tokenOrResp instanceof NextResponse) return tokenOrResp;
    const accessToken = tokenOrResp;

    const upstream = `${API_BASE}/suppliers/${encodeURIComponent(id)}`;

    try {
        const dispatcher = await getInsecureDispatcherIfNeeded();
        const init: RequestInitWithDispatcher = {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
            ...(dispatcher ? { dispatcher } : {}),
        };
        const res = await fetch(upstream, init);
        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: { "content-type": res.headers.get("content-type") || "application/json" },
        });
    } catch (err: any) {
        return NextResponse.json(
            { message: err?.message || "Upstream request failed" },
            { status: 500 }
        );
    }
}

/** -------- PATCH -------- */
export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const { id } = await ctx.params;
    const API_BASE = getApiBase();
    if (!API_BASE) {
        return NextResponse.json({ message: "Missing API base url" }, { status: 500 });
    }

    const tokenOrResp = await requireTokenOrResponse();
    if (tokenOrResp instanceof NextResponse) return tokenOrResp;
    const accessToken = tokenOrResp;

    const upstream = `${API_BASE}/suppliers/${encodeURIComponent(id)}`;

    try {
        const body = await req.text();
        const dispatcher = await getInsecureDispatcherIfNeeded();
        const init: RequestInitWithDispatcher = {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": req.headers.get("content-type") || "application/json",
            },
            body,
            cache: "no-store",
            ...(dispatcher ? { dispatcher } : {}),
        };
        const res = await fetch(upstream, init);
        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: { "content-type": res.headers.get("content-type") || "application/json" },
        });
    } catch (err: any) {
        return NextResponse.json(
            { message: err?.message || "Upstream request failed" },
            { status: 500 }
        );
    }
}

/** -------- DELETE -------- */
export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const { id } = await ctx.params;
    const API_BASE = getApiBase();
    if (!API_BASE) {
        return NextResponse.json({ message: "Missing API base url" }, { status: 500 });
    }

    const tokenOrResp = await requireTokenOrResponse();
    if (tokenOrResp instanceof NextResponse) return tokenOrResp;
    const accessToken = tokenOrResp;

    const upstream = `${API_BASE}/suppliers/${encodeURIComponent(id)}`;

    try {
        const dispatcher = await getInsecureDispatcherIfNeeded();
        const init: RequestInitWithDispatcher = {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
            ...(dispatcher ? { dispatcher } : {}),
        };
        const res = await fetch(upstream, init);
        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: { "content-type": res.headers.get("content-type") || "application/json" },
        });
    } catch (err: any) {
        return NextResponse.json(
            { message: err?.message || "Upstream request failed" },
            { status: 500 }
        );
    }
}