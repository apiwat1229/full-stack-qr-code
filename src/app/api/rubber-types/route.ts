// src/app/api/rubber-types/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ใช้ BACKEND จาก env; ตัด / ท้ายออกกันซ้ำ
const RAW_BACKEND =
    process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th";
const BACKEND = RAW_BACKEND.replace(/\/+$/, "");

// endpoint จริง: /api/rubbertypes/
const UPSTREAM_PATH = "/api/rubbertypes/";

export async function GET(_req: NextRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Request timeout"), 10_000);

    try {
        const upstream = `${BACKEND}${UPSTREAM_PATH}`;

        const res = await fetch(upstream, {
            method: "GET",
            cache: "no-store",
            // edge runtime รองรับ signal
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });

        const text = await res.text().catch(() => "");
        if (!res.ok) {
            return NextResponse.json(
                { error: "Upstream error", status: res.status, detail: text || undefined },
                { status: 502 }
            );
        }

        // รองรับทั้ง array ตรง ๆ และ {data:[]} (กันพลาด)
        let json: any;
        try {
            json = text ? JSON.parse(text) : [];
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON from upstream" },
                { status: 502 }
            );
        }

        const arr: any[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

        // map -> filter เฉพาะ active (ถ้ามี status) -> sort ชื่อ
        const list = arr
            .map((r) => ({
                _id: String(r?._id ?? r?.id ?? r?.code ?? ""),
                name: String(r?.name ?? r?.displayName ?? r?.title ?? ""),
                status: r?.status ?? "active",
            }))
            .filter((x) => x._id && x.name && String(x.status).toLowerCase() === "active")
            .sort((a, b) => a.name.localeCompare(b.name, "th"));

        return NextResponse.json(list, {
            status: 200,
            headers: { "Cache-Control": "no-store, max-age=0" },
        });
    } catch (e: any) {
        const msg =
            e?.name === "AbortError" ? "Upstream timed out" : e?.message || "proxy error";
        return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
        clearTimeout(timeout);
    }
}