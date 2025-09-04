// next.config.ts
import type { NextConfig } from 'next';
import withPWA from 'next-pwa';
import runtimeCaching from 'next-pwa/cache';

const isTurbopack = process.env.TURBOPACK === '1';
const isProd = process.env.NODE_ENV === 'production';
const API_PROXY_TARGET = process.env.API_PROXY_TARGET; // Used only in dev

// Read Host and Port from .env for dev
const APP_ORIGIN_HOST = process.env.APP_ORIGIN_HOST;
const PORT = process.env.PORT || '4560';

const baseConfig: NextConfig = {
	reactStrictMode: false,
	eslint: { ignoreDuringBuilds: process.env.NODE_ENV === 'production' },
	typescript: {},
	// This turbopack key can remain; it only applies when the flag is used.
	turbopack: { rules: {} },
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

	// ✅ Use the 'devServer' block for the Webpack dev server
	devServer: {
		allowedDevOrigins:
			!isProd && APP_ORIGIN_HOST
				? [`http://${APP_ORIGIN_HOST}:${PORT}`]
				: undefined,
	},
};

// Enable PWA only in production + webpack (not turbopack)
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