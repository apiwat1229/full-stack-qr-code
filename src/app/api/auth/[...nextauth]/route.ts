// src/app/api/auth/[...nextauth]/route.ts
// ใช้ Node runtime (หลีกเลี่ยงปัญหา getToken/undici บน edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// ===== BACKEND base =====
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://database-system.ytrc.co.th").replace(/\/+$/, "");

// หมายเหตุ:
// - ต้องตั้ง NEXTAUTH_SECRET ใน .env
// - ถ้าคุณมีหน้า signIn เอง ให้เพิ่ม pages.signIn ตามต้องการ

const authOptions = {
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(creds) {
                if (!creds?.username || !creds?.password) return null;

                // 1) เข้าสู่ระบบกับ BACKEND
                const r = await fetch(`${BACKEND}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: creds.username,
                        password: creds.password,
                    }),
                });

                if (!r.ok) {
                    // ส่งข้อความ error ที่อ่านง่ายกลับไปหน้า signIn
                    const txt = await r.text().catch(() => "");
                    throw new Error(txt || `Backend login failed: HTTP ${r.status}`);
                }

                // 2) คาดหวังรูปแบบตอบกลับประมาณ:
                // { accessToken: string, user: { _id, email, username, name, lastName, department, role, permission } }
                const data = await r.json();

                const user = data?.user || {};
                const accessToken = data?.accessToken;

                if (!accessToken) {
                    throw new Error("Missing accessToken from backend");
                }

                // คืนค่า user กลับไป (Auth.js จะส่งมาให้ jwt callback ใน step ต่อไป)
                return {
                    id: user?._id || user?.id || user?.email || user?.username || crypto.randomUUID(),
                    email: user?.email || undefined,
                    name: user?.name || user?.username || undefined,
                    username: user?.username || undefined,
                    role: user?.role || "user",
                    department: user?.department || undefined,
                    permission: user?.permission || undefined,
                    backendToken: accessToken, // สำคัญ! เก็บ token มากับ user object
                } as any;
            },
        }),
    ],
    session: { strategy: "jwt" as const },
    callbacks: {
        // เก็บ accessToken/permission ลง JWT
        async jwt({ token, user }) {
            if (user) {
                // ครั้งแรกหลัง authorize สำเร็จ
                if ((user as any).backendToken) token.accessToken = (user as any).backendToken as string;
                if ((user as any).permission) token.permission = (user as any).permission;
                if ((user as any).role) token.role = (user as any).role;
                if ((user as any).username) token.username = (user as any).username;
                if ((user as any).department) token.department = (user as any).department;
            }
            return token;
        },
        // ส่งข้อมูลไปฝั่ง client (session)
        async session({ session, token }) {
            (session as any).accessToken = token.accessToken;
            (session.user as any).permission = token.permission || {};
            (session.user as any).role = token.role || "user";
            (session.user as any).username = token.username || session.user?.name;
            (session.user as any).department = token.department || undefined;
            return session;
        },
    },
    // กรณีมีหน้า custom:
    // pages: { signIn: "/auth/signin" },
    secret: process.env.NEXTAUTH_SECRET,
} satisfies Parameters<typeof NextAuth>[0];

const { handlers } = NextAuth(authOptions);

// Export ให้ Next Route Handler ใช้งาน
export const GET = handlers.GET;
export const POST = handlers.POST;