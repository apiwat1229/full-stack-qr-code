import { NextRequest, NextResponse } from "next/server";

const API = (process.env.API_BASE_URL || "").replace(/\/+$/, "");

function passthroughHeaders(req: NextRequest) {
    const h = new Headers();
    for (const [k, v] of req.headers) {
        if (/^(content-type|authorization|cookie|x-.*)$/i.test(k)) h.set(k, v);
    }
    return h;
}

async function proxy(req: NextRequest) {
    if (!API) {
        return NextResponse.json(
            { error: "API_BASE_URL not configured" },
            { status: 500 }
        );
    }

    const slug = req.nextUrl.pathname.replace(/^\/api\/bookings/, "");
    const url = `${API}/bookings${slug}${req.nextUrl.search || ""}`;

    const init: RequestInit = {
        method: req.method,
        headers: passthroughHeaders(req),
        body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
        // หมายเหตุ: ถ้ารัน edge runtime จะไม่มี credentials ให้ใส่
    };

    const res = await fetch(url, init);
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
        status: res.status,
        headers: res.headers,
    });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;