// src/app/api/locations/subdistricts/route.ts
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

/** คืน dispatcher แบบข้ามการตรวจ cert เฉพาะตอน NODE_TLS_REJECT_UNAUTHORIZED=0 */
async function getInsecureDispatcherIfNeeded() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") return undefined;

    try {
        const { Agent } = await import("undici"); // แนะนำให้ติดตั้งแพ็กเกจนี้
        return new Agent({ connect: { rejectUnauthorized: false } });
    } catch {
        try {
            // fallback: ใช้ built-in module ถ้ามี
            // @ts-ignore
            const { Agent } = await import("node:undici");
            return new Agent({ connect: { rejectUnauthorized: false } });
        } catch (e) {
            console.warn("[locations/subdistricts] undici unavailable:", e);
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

    const search = req.nextUrl.search || "";
    const upstream = `${API_BASE}/locations/subdistricts${search}`;

    try {
        const dispatcher = await getInsecureDispatcherIfNeeded();
        const res = await fetch(upstream, {
            method: "GET",
            cache: "no-store",
            // @ts-ignore - Next (Node runtime) รองรับ undici dispatcher
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