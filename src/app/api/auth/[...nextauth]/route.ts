export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// ชี้ backend (อย่าใส่ '/' ท้าย)
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th").replace(/\/+$/, "");

const authOptions = {
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(creds) {
                if (!creds?.email || !creds?.password) return null;

                const r = await fetch(`${BACKEND}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: creds.email,           // backend ต้องการ username -> map จาก email
                        password: creds.password,
                    }),
                });

                if (!r.ok) {
                    const txt = await r.text().catch(() => "");
                    throw new Error(txt || `Backend login failed: HTTP ${r.status}`);
                }

                const data = await r.json();
                const user = data?.user || {};
                const accessToken = data?.access_token; // <<<< ใช้ access_token ตาม backend
                const mustChangePassword = !!data?.mustChangePassword;

                if (!accessToken) throw new Error("Missing access_token from backend");

                return {
                    id: user?._id || user?.id || user?.email || user?.username || crypto.randomUUID(),
                    email: user?.email || undefined,
                    name: user?.name || user?.username || undefined,
                    username: user?.username || undefined,
                    role: user?.role || "user",
                    department: user?.department || undefined,
                    permission: user?.permission || undefined,
                    backendToken: accessToken,
                    mustChangePassword,              // <<<< เก็บ flag ไว้ต่อ
                } as any;
            },
        }),
    ],
    session: { strategy: "jwt" as const },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                if ((user as any).backendToken) token.accessToken = (user as any).backendToken as string;
                if ((user as any).permission) token.permission = (user as any).permission;
                if ((user as any).role) token.role = (user as any).role;
                if ((user as any).username) token.username = (user as any).username;
                if ((user as any).department) token.department = (user as any).department;
                if ((user as any).mustChangePassword !== undefined) token.mustChangePassword = !!(user as any).mustChangePassword;
            }
            return token;
        },
        async session({ session, token }) {
            (session as any).accessToken = token.accessToken;
            (session.user as any).permission = token.permission || {};
            (session.user as any).role = token.role || "user";
            (session.user as any).username = token.username || session.user?.name;
            (session.user as any).department = token.department || undefined;
            (session.user as any).mustChangePassword = !!token.mustChangePassword;
            return session;
        },
    },
    // ถ้าจะกำหนด cookies แบบละเอียดใน dev (ไม่จำเป็นถ้า AUTH_URL/NEXTAUTH_URL ถูกต้อง)
    // cookies: { ... }
    secret: process.env.NEXTAUTH_SECRET,
} satisfies Parameters<typeof NextAuth>[0];

const { handlers } = NextAuth(authOptions);
export const GET = handlers.GET;
export const POST = handlers.POST;