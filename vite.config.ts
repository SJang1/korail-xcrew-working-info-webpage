import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
		cloudflare(),
		VitePWA({
			registerType: 'autoUpdate',
			devOptions: {
				enabled: true
			},
			manifest: {
				name: '코레일 승무원 정보',
				short_name: '코레일 승무원',
				description: '코레일 승무원 근무 정보 확인 웹사이트',
				theme_color: '#1976d2',
				icons: [
					{
						src: 'logo.png',
						sizes: '50x50',
						type: 'image/png',
					},
					{
						src: 'logo.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'logo.png',
						sizes: '512x512',
						type: 'image/svg+xml',
					}
				]
			}
		})
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
})
