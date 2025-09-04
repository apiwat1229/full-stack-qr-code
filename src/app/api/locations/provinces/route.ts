// src/app/api/locations/provinces/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// (ถ้าข้อมูลเปลี่ยนบ่อย แนะนำให้บังคับ dynamic ด้วย)
// export const dynamic = "force-dynamic";

function getApiBase() {
    const base =
        process.env.API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.API_PROXY_TARGET ||
        "";
    return base.replace(/\/$/, "");
}

/**
 * ใช้ undici.Agent แบบ import จากแพ็กเกจ 'undici'
 * และมี fallback ไป 'node:undici' เผื่อบางสภาพแวดล้อม
 */
async function getInsecureDispatcherIfNeeded() {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") return undefined;

    // ลองจากแพ็กเกจก่อน (ต้องมี npm i undici)
    try {
        const { Agent } = await import("undici");
        return new Agent({ connect: { rejectUnauthorized: false } });
    } catch {
        // Fallback (บางสภาพแวดล้อมมี built-in prefix)
        try {
            // @ts-ignore
            const { Agent } = await import("node:undici");
            return new Agent({ connect: { rejectUnauthorized: false } });
        } catch (e) {
            console.warn("[locations/provinces] undici not available:", e);
            return undefined; // ถ้าไม่มีจริง ๆ จะไม่ override (อาจยัง TLS error)
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

    const upstream = `${API_BASE}/locations/provinces${req.nextUrl.search || ""}`;

    try {
        const dispatcher = await getInsecureDispatcherIfNeeded();

        const res = await fetch(upstream, {
            method: "GET",
            cache: "no-store",
            // Next.js fetch (Node runtime) รองรับ undici dispatcher
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