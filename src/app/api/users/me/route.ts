// src/app/api/users/me/route.ts
import { auth } from "@auth/authJs";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * เลือก base URL ของ API ตามลำดับความสำคัญ
 * - DEV/PROD แนะนำตั้ง API_PROXY_TARGET (เช่น https://helpdesk.ytrc.co.th/api)
 * - สำรองด้วย API_BASE_URL / NEXT_PUBLIC_API_BASE_URL เผื่อโปรเจ็กต์อื่นใช้ตัวแปรเก่า
 */
const API_BASE =
    process.env.API_PROXY_TARGET?.replace(/\/$/, "") ||
    process.env.API_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "";

/**
 * GET /api/users/me  (ฝั่ง Next)
 * - ตรวจ session จาก next-auth
 * - เรียกไป upstream: {API_BASE}/users/me
 * - ส่งต่อ status/headers/body กลับให้ฝั่ง client
 */
export async function GET(_req: NextRequest) {
    // 1) ตรวจ session/token
    const session = await auth();
    const accessToken = (session as any)?.accessToken;

    if (!accessToken) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!API_BASE) {
        return NextResponse.json({ message: "Missing API base url" }, { status: 500 });
    }

    const upstream = `${API_BASE}/users/me`;

    try {
        const res = await fetch(upstream, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            cache: "no-store",
            // ถ้า DEV ตั้ง NODE_TLS_REJECT_UNAUTHORIZED=0 ไว้แล้ว
            // fetch ของ Node จะยอม cert ที่ไม่ผ่าน verify โดยไม่ต้องใช้ undici
        });

        // อ่านเนื้อหาแล้วส่งต่อ status + content-type กลับไป
        const bodyText = await res.text();
        const contentType = res.headers.get("content-type") || "application/json";

        return new NextResponse(bodyText, {
            status: res.status,
            headers: { "content-type": contentType },
        });
    } catch (err: any) {
        return NextResponse.json(
            { message: err?.message || "Upstream request failed" },
            { status: 500 }
        );
    }
}