// src/app/api/users/[id]/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";

type Params = { id: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
    // ✅ ต้อง await ctx.params ใน Next.js 15
    const { id } = await ctx.params;

    // ✅ อ่านค่าจาก ENV ให้ยืดหยุ่น: แนะนำตั้ง API_BASE_URL
    let base =
        process.env.API_BASE_URL ||
        process.env.BACKEND_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "";

    if (!base) {
        return NextResponse.json(
            { message: "API_BASE_URL/BACKEND_URL is not set" },
            { status: 500 }
        );
    }

    // ✅ ทำให้เป็น absolute + ตัด / ทิ้ง
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
    base = base.replace(/\/+$/, "");

    // ✅ ไม่ให้ซ้ำ /api (รองรับทั้งตั้งมามี/ไม่มี /api)
    const apiBase = base.endsWith("/api") ? base : `${base}/api`;

    const body = await req.json().catch(() => ({}));
    const target = `${apiBase}/users/${id}/reset-password`;

    // (ถ้าอยาก debug URL จริง ๆ) console.log("reset target:", target);

    const r = await fetch(target, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // ส่งต่อ token ไป backend
            Authorization: req.headers.get("authorization") ?? "",
        },
        body: JSON.stringify(body),
    });

    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
}