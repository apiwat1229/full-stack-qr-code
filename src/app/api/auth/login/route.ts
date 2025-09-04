// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";

/**
 * Proxy /api/auth/login -> <API_PROXY_TARGET>/auth/login
 * - แก้ปัญหา SSL ฝั่ง Node (ใช้ dispatcher ของ undici)
 * - รวม CORS และ header ให้เรียบร้อย
 * - ใช้ได้เฉพาะ server-runtime ของ Next (app router)
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
    const targetBase =
        process.env.API_PROXY_TARGET ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        ""; // e.g. https://helpdesk.ytrc.co.th/api

    if (!targetBase) {
        return NextResponse.json(
            { message: "Missing API_PROXY_TARGET / NEXT_PUBLIC_API_BASE_URL" },
            { status: 500 }
        );
    }

    const url = `${targetBase.replace(/\/$/, "")}/auth/login`;

    // รับ body จาก client
    const body = await req.json().catch(() => ({}));

    // ปรับ fetch option ให้รองรับกรณี SSL ไม่สมบูรณ์ (เฉพาะ DEV)
    const dispatcher =
        process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"
            ? // ใช้ undici Agent เพื่อปิด verify cert เมื่อ NODE_TLS_REJECT_UNAUTHORIZED=0
            // (รองรับ fetch ของ Node >=18)
            new (require("undici").Agent)({
                connect: { rejectUnauthorized: false },
            })
            : undefined;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            // @ts-ignore: dispatcher is undici option
            dispatcher,
            // กันแคช, กันแฮงค์
            cache: "no-store",
            signal:
                (AbortSignal as any).timeout?.(10000) ??
                (() => {
                    const c = new AbortController();
                    setTimeout(() => c.abort(), 10000);
                    return c.signal;
                })(),
        });

        // ส่งต่อ status/body จาก backend ตรง ๆ
        const text = await res.text();
        return new NextResponse(text, {
            status: res.status,
            headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
        });
    } catch (err: any) {
        console.error("Failed to proxy", url, err);
        return NextResponse.json(
            {
                message:
                    err?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
                        ? "SSL verification failed at upstream"
                        : "Upstream fetch error",
                code: err?.code,
            },
            { status: 500 }
        );
    }
}