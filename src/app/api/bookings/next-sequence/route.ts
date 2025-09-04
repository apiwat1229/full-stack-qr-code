// src/app/api/bookings/next-sequence/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BACKEND =
    process.env.BACKEND_API ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://database-system.ytrc.co.th";

function json(data: any, status = 200) {
    return NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "no-store, max-age=0" },
    });
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 10_000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort("timeout"), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(t);
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? "";
    const start = searchParams.get("start_time") ?? "";

    if (!date || !start) {
        return json({ error: "missing date or start_time" }, 400);
    }
    // validate คร่าว ๆ
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) {
        return json({ error: "invalid date or start_time format" }, 400);
    }

    const upstream = `${BACKEND}/api/bookings/next-sequence?date=${encodeURIComponent(
        date
    )}&start_time=${encodeURIComponent(start)}`;

    try {
        const r = await fetchWithTimeout(upstream, {
            headers: { Accept: "application/json" },
            cache: "no-store",
            // credentials: "include", // เปิดถ้าแบ็กเอนด์ต้องใช้ session cookie
        });

        const ct = r.headers.get("content-type") || "";
        const text = await r.text().catch(() => "");

        // ส่ง status code ต้นทางกลับตรง ๆ
        if (!r.ok) {
            // ถ้าต้นทางส่ง non-JSON ก็ส่งข้อความดิบกลับไป (ยังคง status เดิม)
            if (!ct.includes("application/json")) {
                return new NextResponse(text || `Upstream error ${r.status}`, {
                    status: r.status,
                    headers: { "Cache-Control": "no-store, max-age=0" },
                });
            }
            // JSON error
            return json(
                { error: "upstream", status: r.status, detail: text ? JSON.parse(text) : undefined },
                r.status
            );
        }

        // ต้นทางโอเค
        if (!ct.includes("application/json")) {
            return json({ error: "Non-JSON from upstream" }, 502);
        }

        return new NextResponse(text, {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store, max-age=0",
            },
        });
    } catch (e: any) {
        const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "fetch error";
        return json({ error: msg }, 502);
    }
}