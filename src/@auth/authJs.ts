// src/@auth/authJs.ts
import { UnstorageAdapter } from '@auth/unstorage-adapter';
import type { NextAuthConfig } from 'next-auth';
import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Facebook from 'next-auth/providers/facebook';
import Google from 'next-auth/providers/google';
import { createStorage } from 'unstorage';
import memoryDriver from 'unstorage/drivers/memory';
import vercelKVDriver from 'unstorage/drivers/vercel-kv';

/** ---------- Storage (session adapter) ---------- */
const storage = createStorage({
	driver: process.env.VERCEL
		? vercelKVDriver({
			url: process.env.AUTH_KV_REST_API_URL,
			token: process.env.AUTH_KV_REST_API_TOKEN,
			env: false,
		})
		: memoryDriver(),
});

/** ---------- Helpers ---------- */
function decodeJwtPayload(token: string): any | null {
	try {
		const part = token.split('.')[1];
		const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
		return JSON.parse(json);
	} catch {
		return null;
	}
}
function pickEmailFromPayload(payload: any, fallback?: string | null) {
	return payload?.email || payload?.upn || payload?.preferred_username || fallback || null;
}
function pickRolesFromPayload(payload: any) {
	const role = payload?.role;
	const roles = Array.isArray(payload?.roles) ? payload.roles : role ? [role] : [];
	return { role: roles[0] ?? 'user', roles: roles.length ? roles : ['user'] };
}
function withTimeout(ms = 10000) {
	if ((AbortSignal as any).timeout) return (AbortSignal as any).timeout(ms) as AbortSignal;
	const c = new AbortController();
	setTimeout(() => c.abort(), ms);
	return c.signal;
}

/** ---------- Resolve endpoints (Absolute URLs only) ---------- */
const IS_PROD = process.env.NODE_ENV === 'production';

/** base URL ของแอปเราเอง (สำหรับสร้าง absolute URL ไปหา proxy route เสมอ) */
function getAppOrigin() {
	const fromEnv =
		process.env.AUTH_URL ||
		process.env.NEXTAUTH_URL ||
		// fallback dev
		`http://localhost:${process.env.PORT || 4560}`;
	return fromEnv.replace(/\/$/, '');
}

/** base URL ของ upstream API (สำหรับตอนที่ไม่ใช้ proxy) */
const API_DIRECT =
	process.env.API_BASE_URL ||
	process.env.NEXT_PUBLIC_API_BASE_URL || // ส่วนใหญ่ใช้ตัวนี้ใน prod
	'';

/** login URL ที่ authorize() จะเรียก
 * - ถ้าตั้ง API_PROXY_TARGET ไว้ → ใช้ proxy ของเราเอง (ทั้ง dev/prod)
 * - ไม่งั้น fallback ไปยิงตรงที่ API_DIRECT
 */
function getAuthLoginUrl() {
	const appOrigin = getAppOrigin();
	if (process.env.API_PROXY_TARGET) {
		// ✅ absolute เสมอ (กัน ERR_INVALID_URL)
		return new URL('/api/auth/login', appOrigin).toString();
	}
	if (!API_DIRECT) throw new Error('Missing API base url');
	return `${API_DIRECT.replace(/\/$/, '')}/auth/login`;
}

/** ---------- OAuth providers (enable only when env is set) ---------- */
const oauthProviders: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
	oauthProviders.push(
		Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
	);
}
if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
	oauthProviders.push(
		Facebook({ clientId: process.env.AUTH_FACEBOOK_ID, clientSecret: process.env.AUTH_FACEBOOK_SECRET }),
	);
}

/** ---------- Providers ---------- */
export const providers: Provider[] = [
	Credentials({
		credentials: {
			email: { label: 'Email', type: 'email' },
			password: { label: 'Password', type: 'password' },
		},
		async authorize(formInput) {
			const email = String(formInput?.email || '').trim();
			const password = String(formInput?.password || '');

			let loginUrl: string;
			try {
				loginUrl = getAuthLoginUrl();
			} catch (e) {
				console.error('[AUTH] config error:', e);
				return null;
			}

			if (process.env.API_PROXY_TARGET) {
				console.log(
					'[AUTH] Using proxy login via %s → %s',
					new URL('/api/auth/login', getAppOrigin()).toString(),
					process.env.API_PROXY_TARGET
				);
			} else if (!IS_PROD) {
				console.log('[AUTH] Using API_BASE =', API_DIRECT);
			}

			try {
				const res = await fetch(loginUrl, {
					method: 'POST',
					headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
					cache: 'no-store',
					signal: withTimeout(10000),
				});

				if (!res.ok) {
					let message = `HTTP ${res.status}`;
					try {
						const ct = res.headers.get('content-type') || '';
						if (ct.includes('application/json')) {
							const j = await res.json();
							message = j?.message || message;
						} else {
							const t = await res.text();
							if (t) message = `${message} - ${t.slice(0, 300)}`;
						}
					} catch { }
					console.warn('[AUTH] API login failed:', message);
					return null;
				}

				// ป้องกันเคส backend ตอบ text/plain
				let data: any = null;
				const ct = res.headers.get('content-type') || '';
				data = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());

				const accessToken: string | undefined = data?.access_token;
				if (!accessToken) {
					console.warn('[AUTH] No access_token in response');
					return null;
				}

				const payload = decodeJwtPayload(accessToken) || {};
				const jwtEmail = pickEmailFromPayload(payload, email);
				const jwtSub = payload?.sub || payload?.userId || jwtEmail || 'no-id';
				const { role, roles } = pickRolesFromPayload(payload);

				const user = {
					id: String(jwtSub),
					email: jwtEmail,
					name: jwtEmail?.split('@')?.[0],
					image: undefined,
					role,
					roles,
					accessToken,
					profile: {
						id: String(jwtSub),
						email: jwtEmail,
						displayName: jwtEmail?.split('@')?.[0],
						role,
						roles,
						mustChangePassword: !!data?.mustChangePassword,
					},
				} as any;

				return user;
			} catch (err) {
				// สองเคสที่เคยเจอจาก log:
				// - ECONNREFUSED (ปลายทางไม่เปิด/URL ผิด)
				// - UNABLE_TO_VERIFY_LEAF_SIGNATURE (SSL upstream ไม่ผ่าน ถ้าใช้ proxy + NODE_TLS_REJECT_UNAUTHORIZED=0 ใน dev จะแก้ได้)
				console.error('[AUTH] authorize fetch error:', err);
				return null;
			}
		},
	}),
	...oauthProviders,
];

/** ---------- NextAuth config ---------- */
const config = {
	// ❗ สำคัญ: ตั้ง SECRET ให้คงที่ระหว่างรัน (กัน JWTSessionError: no matching decryption secret)
	secret: process.env.AUTH_SECRET,

	theme: { logo: '/assets/images/logo/logo.svg' },
	adapter: UnstorageAdapter(storage),
	pages: { signIn: '/sign-in' },
	providers,
	basePath: '/auth',
	trustHost: true,

	callbacks: {
		authorized() {
			return true;
		},
		async jwt({ token, user }) {
			if (user) {
				(token as any).role = (user as any).role;
				(token as any).roles = (user as any).roles ?? ((user as any).role ? [(user as any).role] : []);
				(token as any).profile = (user as any).profile ?? null;
				(token as any).accessToken = (user as any).accessToken ?? (token as any).accessToken;
			}
			return token;
		},
		async session({ session, token }) {
			(session.user as any).role = (token as any).role ?? (session.user as any).role;
			(session.user as any).roles = (token as any).roles ?? (session as any).roles ?? [];
			if ((token as any).profile) (session as any).db = (token as any).profile;
			if ((token as any).accessToken) (session as any).accessToken = (token as any).accessToken;
			return session;
		},
	},

	experimental: { enableWebAuthn: true },
	session: {
		strategy: 'jwt',
		maxAge: 30 * 24 * 60 * 60,
	},

	debug: process.env.NODE_ENV !== 'production',
} satisfies NextAuthConfig;

export type AuthJsProvider = {
	id: string;
	name: string;
	style?: { text?: string; bg?: string };
};

export const authJsProviderMap: AuthJsProvider[] = providers
	.map((p) => {
		const providerData = typeof p === 'function' ? p() : p;
		return {
			id: providerData.id,
			name: providerData.name,
			style: { text: (providerData as any).style?.text, bg: (providerData as any).style?.bg },
		};
	})
	.filter((p) => p.id !== 'credentials');

export const { handlers, auth, signIn, signOut } = NextAuth(config);