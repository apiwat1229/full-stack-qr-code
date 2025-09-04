// src/app/api/suppliers/route.ts
import { auth } from "@auth/authJs";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** อ่าน BASE ของ upstream API จาก ENV และตัด / ท้ายออก */
function getApiBase() {
    const base = process.env.API_BASE_URL || "";
    if (!base) {
        console.error("API_BASE_URL environment variable is not set.");
        throw new Error("API base URL is not configured on the server.");
    }
    return base.replace(/\/+$/, "");
}

/** สร้าง Header Authorization โดยพยายามดึงจาก header ก่อน แล้วค่อย fallback เป็น session.accessToken */
async function buildAuthHeader(req: NextRequest): Promise<HeadersInit> {
    const headers: HeadersInit = {};
    const fromReq = req.headers.get("authorization");
    if (fromReq) {
        headers["Authorization"] = fromReq;
        return headers;
    }
    try {
        const session: any = await auth(); // อาจ throw ได้ ถ้า token เสีย
        const token = session?.accessToken;
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    } catch {
        // ไม่มี session ก็ไม่ใส่อะไร ปล่อยให้ upstream ตอบ 401 เอง
    }
    return headers;
}

/** GET /api/suppliers — โปรกซี่แบบส่งผ่านดิบๆ */
export async function GET(req: NextRequest) {
    try {
        const API_BASE = getApiBase();
        const upstreamUrl = `${API_BASE}/suppliers${req.nextUrl.search}`;

        const headers = await buildAuthHeader(req);

        const upstream = await fetch(upstreamUrl, {
            method: "GET",
            headers,
            cache: "no-store",
        });

        // ส่ง “เนื้อหาเดิม” กลับไปแบบไม่แปลง เพื่อให้ frontend เห็น array ตามจริง
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type":
                    upstream.headers.get("content-type") || "application/json",
            },
        });
    } catch (err: any) {
        console.error("Error in /api/suppliers GET handler:", err);
        return NextResponse.json(
            { error: err?.message || "An internal server error occurred." },
            { status: 500 }
        );
    }
}

/** POST /api/suppliers — ส่งต่อ body+auth ตรงๆ */
export async function POST(req: NextRequest) {
    try {
        const API_BASE = getApiBase();
        const upstreamUrl = `${API_BASE}/suppliers`;

        const headers = await buildAuthHeader(req);
        // คง content-type ของ client เอาไว้
        const ct = req.headers.get("content-type") || "application/json";
        headers["Content-Type"] = ct;

        const body = await req.text();

        const upstream = await fetch(upstreamUrl, {
            method: "POST",
            headers,
            body,
            cache: "no-store",
        });

        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: {
                "content-type":
                    upstream.headers.get("content-type") || "application/json",
            },
        });
    } catch (err: any) {
        console.error("Error in /api/suppliers POST handler:", err);
        return NextResponse.json(
            { error: err?.message || "An internal server error occurred." },
            { status: 500 }
        );
    }
}