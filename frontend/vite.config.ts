import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import {
	ownerLiveCommandPlugin,
	usernameCollectionLivePlugin,
	usernameValuationLivePlugin,
	numbersLiveEnrichmentPlugin,
	giftsLiveEnrichmentPlugin,
} from './dev-plugins';

export default defineConfig({
	plugins: [
		tailwindcss(),
		solidPlugin({ hot: false }),
		tsconfigPaths(),
		ownerLiveCommandPlugin(),
		usernameCollectionLivePlugin(),
		usernameValuationLivePlugin(),
		numbersLiveEnrichmentPlugin(),
		giftsLiveEnrichmentPlugin(),
		process.env.HTTPS === 'true' ? mkcert() : undefined,
		process.env.VITE_SENTRY_AUTH_TOKEN
			? sentryVitePlugin({
					org: 'ifragment',
					project: 'ifragment-frontend',
					authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
				})
			: undefined,
		visualizer({
			open: false,
			filename: 'dist/bundle-analysis.html',
			gzipSize: true,
			brotliSize: true,
		}),
	],
	resolve: {
		dedupe: [
			'solid-js',
			'solid-js/web',
			'solid-js/store',
			'solid-js/html',
			'solid-js/h',
			'@solidjs/router',
			'@solidjs/meta',
		],
	},
	optimizeDeps: {
		entries: ['index.html', 'src/**/*.{ts,tsx}'],
		include: [
			'solid-js',
			'solid-js/web',
			'solid-js/store',
			'solid-js/html',
			'solid-js/h',
			'@sentry/browser',
			'@solid-primitives/i18n',
			'@tanstack/solid-query',
			'@tma.js/sdk-solid',
			'axios',
			'eruda',
			'html-to-image',
			'lightweight-charts',
			'qrcode',
			'solid-focus-trap',
			'three',
			'valibot',
		],
	},
	build: {
		target: 'esnext',
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules')) {
						if (id.includes('solid-js') || id.includes('@solidjs/router')) {
							return 'vendor-solid';
						}
						if (id.includes('@sentry')) {
							return 'vendor-sentry';
						}
						if (id.includes('@tma.js') || id.includes('@telegram-apps')) {
							return 'vendor-telegram';
						}
						if (id.includes('@tanstack') || id.includes('axios')) {
							return 'vendor-data';
						}
						if (id.includes('three')) {
							return 'vendor-three';
						}
						return 'vendor-others';
					}
				},
			},
		},
	},
	publicDir: './public',
	server: {
		host: '0.0.0.0',
		port: 3000,
		allowedHosts: true,
		hmr: false,
		watch: process.env.DISABLE_HMR === 'true' ? null : {},
		proxy: {
			'/api/v1': {
				target: 'https://109-172-94-139.sslip.io',
				changeOrigin: true,
				secure: true,
				headers: {
					Origin: 'https://ifragment.app',
				},
			},
		},
	},
	preview: {
		allowedHosts: true,
	},
});

