// src/app/api/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BACKEND =
    process.env.BACKEND_API ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "https://database-system.ytrc.co.th";

/* ========== helpers ========== */
function json(data: any, status = 200, extraHeaders: Record<string, string> = {}) {
    return NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "no-store, max-age=0", ...extraHeaders },
    });
}

async function fetchWithTimeout(url: string, init?: RequestInit, ms = 10_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/* ========== dev in-memory cache (optional) ========== */
type BookingCache = {
    id?: string;
    date: string;            // YYYY-MM-DD
    start_time: string;      // HH:mm
    end_time?: string;       // HH:mm
    booking_code: string;
    sequence: number;
    user_name: string;
    truck_register?: string;
    truck_type?: string;
    supplier: string;        // supplier _id
    rubber_type: string;     // rubber_type _id หรือชื่อ
    createdAt: number;       // ts
};
const createdCache: BookingCache[] = [];

/** แปลง FullCalendar events -> BookingCache shape (สำหรับ view รวม) */
function mapEventsToCacheShape(events: any[]): BookingCache[] {
    return (events ?? [])
        .map((ev) => {
            const startISO = String(ev?.start || ""); // "YYYY-MM-DDTHH:mm[:ss]"
            const date = startISO.slice(0, 10);
            const start_time = startISO.slice(11, 16);

            const xp = ev?.extendedProps ?? {};
            return {
                id: ev?.id,
                date,
                start_time,
                end_time: start_time,
                booking_code: String(xp?.booking_code ?? ""),
                sequence: Number(xp?.sequence ?? 0),
                user_name: String(xp?.recorded_by ?? "-"),
                truck_register: String(xp?.truck_register ?? ""),
                truck_type: String(xp?.truck_type ?? ""),
                supplier: String(xp?.supplier_id ?? ""),
                rubber_type: String(xp?.rubber_type ?? ""),
                createdAt: Date.now(),
            } as BookingCache;
        })
        .filter((b) => b.date && b.start_time);
}

/* ========== CREATE ========== */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const res = await fetchWithTimeout(`${BACKEND}/api/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
        });

        const text = await res.text().catch(() => "");
        if (!res.ok) {
            // ❗ ส่งต่อ status จริงจาก upstream (แยก duplicate/validation ได้)
            return new NextResponse(text || JSON.stringify({ error: "Upstream error" }), {
                status: res.status,
                headers: {
                    "Content-Type": res.headers.get("content-type") || "application/json",
                    "Cache-Control": "no-store",
                },
            });
        }

        // อัปเดต cache dev
        try {
            const parsed = text ? JSON.parse(text) : {};
            createdCache.push({ ...body, id: parsed?.id, createdAt: Date.now() });
        } catch {
            createdCache.push({ ...body, createdAt: Date.now() });
        }

        return new NextResponse(text || "{}", {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
        return json({ error: msg }, 500);
    }
}

/* ========== READ (list / by-day / by-id) ==========
 * GET /api/bookings?id=<id>                 → ดึงใบเดียว (proxy)
 * GET /api/bookings?date=YYYY-MM-DD         → รวม events ของวัน + dev cache
 * GET /api/bookings?date=YYYY-MM-DD&start_time=HH:mm → กรอง slot
 * GET /api/bookings                         → เฉพาะ dev cache ทั้งหมด (กรณีไม่ใส่ date)
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const date = searchParams.get("date") || undefined;
    const start = searchParams.get("start_time") || undefined;

    // ----- by id (proxy ตรง) -----
    if (id) {
        try {
            const r = await fetchWithTimeout(`${BACKEND}/api/bookings/${encodeURIComponent(id)}`, {
                headers: { Accept: "application/json" },
                cache: "no-store",
            });
            const text = await r.text().catch(() => "");
            if (!r.ok) {
                return new NextResponse(text || JSON.stringify({ error: "Upstream error" }), {
                    status: r.status,
                    headers: {
                        "Content-Type": r.headers.get("content-type") || "application/json",
                        "Cache-Control": "no-store",
                    },
                });
            }
            return new NextResponse(text || "{}", {
                status: 200,
                headers: {
                    "Content-Type": r.headers.get("content-type") || "application/json",
                    "Cache-Control": "no-store",
                },
            });
        } catch (e: any) {
            const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
            return json({ error: msg }, 500);
        }
    }

    // ----- list / by day -----
    try {
        let upstreamList: BookingCache[] = [];

        if (date) {
            const url = `${BACKEND}/api/bookings/events?date=${encodeURIComponent(date)}`;
            const r = await fetchWithTimeout(url, {
                cache: "no-store",
                headers: { Accept: "application/json" },
            });
            if (r.ok) {
                const events = await r.json().catch(() => []);
                upstreamList = mapEventsToCacheShape(events);
            }
        }

        const cached = createdCache.filter(
            (b) => (!date || b.date === date) && (!start || b.start_time === start)
        );

        const combined = [...upstreamList, ...cached].filter(
            (b) => (!date || b.date === date) && (!start || b.start_time === start)
        );

        // กันซ้ำ booking_code → id → date|start|seq
        const seen = new Set<string>();
        const deduped = combined.filter((b) => {
            const key =
                String(b.booking_code || "") ||
                String(b.id || "") ||
                `${b.date}|${b.start_time}|${b.sequence}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        deduped.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
        return json(deduped, 200);
    } catch (e: any) {
        const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
        return json({ error: msg }, 500);
    }
}

/* ========== UPDATE ==========
 * PUT /api/bookings?id=<id>
 * body: ฟิลด์ที่ backend รองรับ
 */
export async function PUT(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return json({ error: "missing id" }, 400);

    try {
        const body = await req.json();

        const r = await fetchWithTimeout(`${BACKEND}/api/bookings/${encodeURIComponent(id)}`, {
            method: "PUT", // ถ้า upstream ใช้ PATCH ให้สลับเป็น "PATCH"
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
        });

        const text = await r.text().catch(() => "");
        if (!r.ok) {
            return new NextResponse(text || JSON.stringify({ error: "Upstream error" }), {
                status: r.status,
                headers: {
                    "Content-Type": r.headers.get("content-type") || "application/json",
                    "Cache-Control": "no-store",
                },
            });
        }

        // sync cache dev (ถ้ามีใน cache)
        const idx = createdCache.findIndex((x) => x.id === id);
        if (idx > -1) createdCache[idx] = { ...createdCache[idx], ...body };

        return new NextResponse(text || "{}", {
            status: 200,
            headers: {
                "Content-Type": r.headers.get("content-type") || "application/json",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
        return json({ error: msg }, 500);
    }
}

/* ========== DELETE ==========
 * DELETE /api/bookings?id=<id>
 */
export async function DELETE(req: NextRequest) {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "missing id" }, 400);

    // ลบใน cache dev
    const idx = createdCache.findIndex((x) => x.id === id);
    if (idx > -1) createdCache.splice(idx, 1);

    const upstream = `${BACKEND}/api/bookings/${encodeURIComponent(id)}`;
    try {
        const r = await fetchWithTimeout(upstream, {
            method: "DELETE",
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        const text = await r.text().catch(() => "");
        if (r.ok) {
            if (!text) return json({ ok: true }, 200);
            // ถ้าต้นทางส่ง non-json แต่ 2xx ก็ถือว่าสำเร็จ
            try {
                JSON.parse(text);
                return new NextResponse(text, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                        "Cache-Control": "no-store",
                    },
                });
            } catch {
                return json({ ok: true }, 200);
            }
        }

        return new NextResponse(text || JSON.stringify({ error: "Upstream error" }), {
            status: r.status,
            headers: {
                "Content-Type": r.headers.get("content-type") || "application/json",
                "Cache-Control": "no-store",
            },
        });
    } catch (e: any) {
        const msg = e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
        return json({ error: msg }, 500);
    }
}