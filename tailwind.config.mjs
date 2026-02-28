/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				"brand-bg": "#0A0C10",
				"brand-surface": "#12151C",
				"brand-surface-accent": "#1A1F29",
				"brand-text-main": "#E5E7EB",
				"brand-text-muted": "#9CA3AF",
				"brand-accent": "#60A5FA",
				"brand-border": "#1F2937",
			},
			fontFamily: {
				"serif": ["'Playfair Display'", "serif"],
				"mono": ["'JetBrains Mono'", "monospace"],
			},
		},
	},
	plugins: [],
}
