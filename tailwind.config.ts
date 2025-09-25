import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}'
    ],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px'
            }
        },
        extend: {
            fontFamily: {
                sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans]
            },
            // not needed in tailwind v4?
            colors: {
                border: 'oklch(var(--border))',
                ring: 'oklch(var(--ring))',
                background: 'oklch(var(--background))',
                foreground: 'oklch(var(--foreground))',
                card: {
                    DEFAULT: 'oklch(var(--card))',
                    foreground: 'oklch(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'oklch(var(--popover))',
                    foreground: 'oklch(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'oklch(var(--primary))',
                    foreground: 'oklch(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'oklch(var(--secondary))',
                    foreground: 'oklch(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'oklch(var(--muted))',
                    foreground: 'oklch(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'oklch(var(--accent))',
                    foreground: 'oklch(var(--accent-foreground))'
                }
            }
        }
    },
    plugins: []
};
export default config;
