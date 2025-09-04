// src/app/api/locations/districts/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getApiBase() {
    const base =
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.API_PROXY_TARGET ||
        "";
    return base.replace(/\/$/, "");
}

/** คืน dispatcher แบบไม่ตรวจ cert เฉพาะตอน NODE_TLS_REJECT_UNAUTHORIZED=0 */
async function getInsecureDispatcherIfNeeded() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") return undefined;

    try {
        const { Agent } = await import("undici"); // ใช้แพ็กเกจปกติ (แนะนำ)
        return new Agent({ connect: { rejectUnauthorized: false } });
    } catch {
        try {
            // fallback สำหรับบางสภาพแวดล้อมที่มี built-in
            // @ts-ignore
            const { Agent } = await import("node:undici");
            return new Agent({ connect: { rejectUnauthorized: false } });
        } catch (e) {
            console.warn("[locations/districts] undici unavailable:", e);
            return undefined;
        }
    }
}

export async function GET(req: NextRequest) {
    const API_BASE = getApiBase();
    if (!API_BASE) {
        return NextResponse.json(
            { message: "Missing API base url" },
            { status: 500 }
        );
    }

    const upstream = `${API_BASE}/locations/districts${req.nextUrl.search || ""}`;

    try {
        const dispatcher = await getInsecureDispatcherIfNeeded();
        const res = await fetch(upstream, {
            method: "GET",
            cache: "no-store",
            // Next (Node runtime) รองรับ undici dispatcher
            // @ts-ignore
            dispatcher,
        });

        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: {
                "content-type":
                    res.headers.get("content-type") || "application/json",
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            { message: err?.message || "Upstream request failed" },
            { status: 500 }
        );
    }
}