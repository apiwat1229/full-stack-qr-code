// src/app/api/bookings/suppliers/route.ts
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API ?? "https://database-system.ytrc.co.th";

/**
 * GET /api/bookings/suppliers?page=&limit=
 * Proxy → https://.../api/bookings/suppliers?page=&limit=
 * Normalize เป็น:
 *  [
 *    {
 *      _id: string,
 *      supCode: string,          // SUP01
 *      title?: string,           // นาย/นาง/นางสาว/... (ถ้ามี)
 *      firstName?: string,       // ถ้าเดาได้
 *      lastName?: string,        // ถ้าเดาได้
 *      displayName: string,      // ชื่อที่ตัด supCode ออกแล้ว
 *      licensePlate?: string     // (upstream ยังไม่มี ให้ค่าว่าง)
 *    }
 *  ]
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const page = url.searchParams.get("page") ?? "1";
    const limit = url.searchParams.get("limit") ?? "100";

    const upstream = `${BACKEND}/api/bookings/suppliers?page=${encodeURIComponent(
        page
    )}&limit=${encodeURIComponent(limit)}`;

    try {
        const r = await fetch(upstream, {
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        const ct = r.headers.get("content-type") || "";
        const text = await r.text().catch(() => "");

        if (!r.ok) {
            return new NextResponse(text || `Upstream error ${r.status}`, {
                status: r.status,
            });
        }
        if (!ct.includes("application/json")) {
            return NextResponse.json(
                { error: "Non-JSON from upstream" },
                { status: 502 }
            );
        }

        const raw = JSON.parse(text);
        const list: Array<{ id?: string; name?: string }> = Array.isArray(raw)
            ? raw
            : [];

        const suppliers = list.map(normalizeItem);

        return NextResponse.json(suppliers, {
            headers: {
                "cache-control": "no-store",
            },
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || "fetch error", upstream: BACKEND },
            { status: 500 }
        );
    }
}

/* ---------------- helpers ---------------- */

const TH_TITLES = ["นาย", "นาง", "นางสาว", "คุณ", "หจก.", "บริษัท", "บจก."];

/**
 * รับ { id, name } เช่น:
 * { id: "68ac...", name: "SUP01 : นายสมชาย ใจดี" }
 * คืนอ็อบเจ็กต์ normalize
 */
function normalizeItem(s: { id?: string; name?: string }) {
    const rawName = (s.name || "").trim();

    let supCode = "";
    let display = rawName;

    const idx = rawName.indexOf(":");
    if (idx > -1) {
        supCode = rawName.slice(0, idx).trim();
        display = rawName.slice(idx + 1).trim();
    }

    const TH_TITLES = ["นาย", "นาง", "นางสาว", "คุณ", "หจก.", "บริษัท", "บจก."];

    let title = "";
    let firstName = "";
    let lastName = "";

    if (display) {
        const parts = display.split(/\s+/).filter(Boolean);
        if (parts.length) {
            if (TH_TITLES.includes(parts[0])) {
                title = parts[0];
                firstName = parts[1] ?? "";
                lastName = parts.slice(2).join(" ");
            } else {
                firstName = display;
            }
        }
    }

    // หลีกเลี่ยงการผสม ?? กับ ||
    const idFromUpstream = s.id?.trim();
    const fallbackId = supCode || Math.random().toString(36).slice(2);
    const _id = idFromUpstream || fallbackId;

    return {
        _id,
        supCode,
        title,
        firstName,
        lastName,
        displayName: display || rawName,
        licensePlate: "",
    };
}