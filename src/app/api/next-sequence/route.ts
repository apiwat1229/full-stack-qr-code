import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th";

export async function GET(req: NextRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Request timeout"), 10_000);

    try {
        const url = new URL(req.url);
        const date = url.searchParams.get("date");
        const start_time = url.searchParams.get("start_time");

        if (!date || !start_time) {
            return NextResponse.json(
                { error: "Missing required query params: date, start_time" },
                { status: 400 }
            );
        }

        const upstream = `${BACKEND}/api/bookings/next-sequence?date=${encodeURIComponent(date)}&start_time=${encodeURIComponent(start_time)}`;

        const res = await fetch(upstream, {
            cache: "no-store",
            next: { revalidate: 0 },
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });

        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return NextResponse.json(
                { error: "Upstream error", status: res.status, detail: detail || undefined },
                { status: 502 }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, {
            status: 200,
            headers: { "Cache-Control": "no-store, max-age=0" },
        });
    } catch (e: any) {
        const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        clearTimeout(timeout);
    }
}