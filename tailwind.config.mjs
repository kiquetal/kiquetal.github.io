/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				"brand-bg": "#1C1917",
				"brand-surface": "#292524",
				"brand-surface-accent": "#44403C",
				"brand-text-main": "#F5F0EB",
				"brand-text-muted": "#A8A29E",
				"brand-accent": "#E7A66A",
				"brand-border": "#3D3835",
			},
			fontFamily: {
				"serif": ["'Playfair Display'", "serif"],
				"mono": ["'JetBrains Mono'", "monospace"],
			},
		},
	},
	plugins: [],
}
