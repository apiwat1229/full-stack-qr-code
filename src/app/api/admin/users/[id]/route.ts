// src/app/api/admin/users/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://database-system.ytrc.co.th').replace(/\/+$/, '');
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_PROXY === '1';

function isHttps(req: NextRequest) {
    const xfProto = req.headers.get('x-forwarded-proto');
    if (xfProto) return xfProto.split(',')[0].trim() === 'https';
    return req.nextUrl.protocol === 'https:';
}

async function pickBearer(req: NextRequest) {
    // 1) Authorization header
    const auth = req.headers.get('authorization');
    if (auth?.toLowerCase().startsWith('bearer ')) {
        return { token: auth.slice(7).trim(), source: 'Authorization header' as const };
    }

    // 2) cookies
    const cookieToken =
        req.cookies.get('backend_token')?.value ||
        req.cookies.get('access_token')?.value ||
        req.cookies.get('token')?.value;
    if (cookieToken) {
        return { token: cookieToken, source: 'cookie' as const };
    }

    // 3) next-auth jwt
    try {
        const jwt = await getToken({ req, secureCookie: isHttps(req) });
        const at =
            (jwt as any)?.accessToken ??
            (jwt as any)?.backendToken ??
            (jwt as any)?.token;
        if (at) return { token: at, source: 'nextauth token' as const };
    } catch {
        /* ignore */
    }

    return { token: '', source: 'none' as const };
}

async function forward(
    req: NextRequest,
    method: 'GET' | 'PATCH' | 'PUT' | 'DELETE',
    ctx: { params: Promise<{ id: string }> }
) {
    const { id } = await ctx.params; // ✅ ต้อง await
    const search = req.nextUrl.search || '';

    if (!BACKEND) {
        return NextResponse.json(
            { error: 'Missing BACKEND URL (NEXT_PUBLIC_BACKEND_URL)' },
            { status: 500 }
        );
    }

    const { token, source } = await pickBearer(req);
    if (!token) {
        const res = NextResponse.json(
            {
                error: 'Unauthorized (no credentials to call backend via proxy)',
                how_to_fix:
                    'แนบ Authorization: Bearer <token> หรือเก็บ token ไว้ใน cookie backend_token/access_token/token หรือบันทึกลง NextAuth JWT',
            },
            { status: 401 }
        );
        if (DEBUG) res.headers.set('x-debug-auth-source', source);
        return res;
    }

    const upstreamMethod = method === 'PUT' ? 'PATCH' : method;
    const upstream = `${BACKEND}/api/users/${encodeURIComponent(id)}${search}`;

    const headers = new Headers({
        accept: 'application/json',
        authorization: `Bearer ${token}`,
    });

    const init: RequestInit = {
        method: upstreamMethod,
        headers,
        cache: 'no-store',
        // @ts-ignore
        next: { revalidate: 0 },
    };

    if (['PATCH', 'PUT', 'DELETE'].includes(upstreamMethod)) {
        const body = await req.text();
        if (body) {
            headers.set('content-type', 'application/json');
            init.body = body;
        }
    }

    try {
        const r = await fetch(upstream, init);
        const txt = await r.text().catch(() => '');
        const out = new NextResponse(txt || (r.ok ? '{}' : r.statusText), {
            status: r.status,
            headers: {
                'content-type': r.headers.get('content-type') || 'application/json',
                'cache-control': 'no-store',
            },
        });
        if (DEBUG) out.headers.set('x-debug-auth-source', source);
        return out;
    } catch (e: any) {
        const res = NextResponse.json(
            { error: `Upstream fetch error: ${e?.message || 'network error'}` },
            { status: 502 }
        );
        if (DEBUG) res.headers.set('x-debug-auth-source', source);
        return res;
    }
}

/** Handlers */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    return forward(req, 'GET', ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    return forward(req, 'PATCH', ctx);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    return forward(req, 'PUT', ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    return forward(req, 'DELETE', ctx);
}