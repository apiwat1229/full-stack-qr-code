// next.config.ts
import type { NextConfig } from 'next';
import withPWA from 'next-pwa';
import runtimeCaching from 'next-pwa/cache';

const isTurbopack = process.env.TURBOPACK === '1';
const isProd = process.env.NODE_ENV === 'production';

// Used only in dev (proxy to your backend)
const API_PROXY_TARGET = process.env.API_PROXY_TARGET;

// Read Host and Port from .env for dev CORS header (optional)
const APP_ORIGIN_HOST = process.env.APP_ORIGIN_HOST;
const PORT = process.env.PORT || '4560';

const baseConfig: NextConfig = {
	reactStrictMode: false,
	eslint: { ignoreDuringBuilds: isProd },
	typescript: {},
	// ใส่ webpack config เฉพาะตอนไม่ได้ใช้ Turbopack
	...(!isTurbopack && {
		webpack: (config) => {
			if (config.module?.rules) {
				config.module.rules.push({
					test: /\.(json|js|ts|tsx|jsx)$/,
					resourceQuery: /raw/,
					use: 'raw-loader',
				});
			}
			return config;
		},
	}),

	async rewrites() {
		if (!isProd && API_PROXY_TARGET) {
			return [
				{
					source: '/api/:path*',
					destination: `${API_PROXY_TARGET}/:path*`,
				},
			];
		}
		return [];
	},

	// ✅ ห้ามคืน route ที่ headers: [] เปล่า ๆ
	// ใส่เฉพาะตอน dev และตั้งค่าไว้จริงเท่านั้น
	async headers() {
		const routes: Array<{ source: string; headers: { key: string; value: string }[] }> = [];

		if (!isProd && APP_ORIGIN_HOST) {
			routes.push({
				source: '/(.*)',
				headers: [
					{ key: 'Access-Control-Allow-Origin', value: `http://${APP_ORIGIN_HOST}:${PORT}` },
					{ key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
					{ key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
				],
			});
		}

		return routes; // ถ้าไม่มีอะไรจะเป็น [] — ถูกต้อง
	},
};

// เปิด PWA เฉพาะ production และเมื่อใช้ webpack (ไม่ใช่ turbopack)
const withPWAwrapper =
	isProd && !isTurbopack
		? withPWA({
			dest: 'public',
			disable: false,
			register: true,
			skipWaiting: true,
			runtimeCaching,
			buildExcludes: [/middleware-manifest\.json$/],
		})
		: (cfg: NextConfig) => cfg;

export default withPWAwrapper(baseConfig);