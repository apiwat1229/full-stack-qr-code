// src/app/api/bookings/events/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND =
    process.env.BACKEND_API ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://database-system.ytrc.co.th";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ปรับให้คืน shape ที่หน้า client ใช้ได้แน่: มี extendedProps.sequence เสมอ
function normalizeEvents(raw: any[]): any[] {
    return (raw ?? []).map((ev: any, idx: number) => {
        const start = String(ev?.start ?? "");
        const end = ev?.end ?? null;

        // รองรับหลายชื่อคีย์ queue
        const xp = { ...(ev?.extendedProps ?? {}) };
        const seq =
            Number(
                xp.sequence ??
                xp.queue ??
                xp.order ??
                ev?.sequence ??
                ev?.queue ??
                ev?.order ??
                NaN
            ) || idx + 1; // fallback: ลำดับจาก index

        return {
            id: ev?.id ?? `${start}-${seq}`,
            title: ev?.title ?? "",
            start,
            end,
            extendedProps: {
                ...xp,
                sequence: seq, // ✅ รับประกันว่ามี
                supplier_code:
                    xp.supplier_code ?? xp.supCode ?? ev?.supplier_code ?? "",
                supplier_name:
                    xp.supplier_name ?? xp.name ?? ev?.supplier_name ?? "",
                truck_register: xp.truck_register ?? ev?.truck_register ?? "",
                rubber_type: xp.rubber_type ?? ev?.rubber_type ?? "",
                booking_code: xp.booking_code ?? ev?.booking_code ?? "",
                recorded_by: xp.recorded_by ?? ev?.recorded_by ?? "-",
                supplier_id: xp.supplier_id ?? ev?.supplier_id ?? "",
                truck_type: xp.truck_type ?? ev?.truck_type ?? "",
            },
        };
    });
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || "";

    if (!date) {
        return NextResponse.json({ error: "missing date" }, { status: 400 });
    }

    const upstream = `${BACKEND}/api/bookings/events?date=${encodeURIComponent(
        date
    )}`;

    try {
        const r = await fetch(upstream, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        const text = await r.text().catch(() => "");
        const ct = r.headers.get("content-type") || "";

        if (!r.ok) {
            // ถ้า upstream พัง ให้ตอบ array ว่าง (หน้าไม่กระพริบ)
            return NextResponse.json([], { status: 200 });
        }
        if (!ct.includes("application/json")) {
            return NextResponse.json([], { status: 200 });
        }

        const data = JSON.parse(text);
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        return NextResponse.json(normalizeEvents(list), {
            headers: { "Cache-Control": "no-store" },
        });
    } catch {
        // fallback เงียบ ๆ → หน้าใช้งานต่อได้
        return NextResponse.json([], { status: 200 });
    }
}