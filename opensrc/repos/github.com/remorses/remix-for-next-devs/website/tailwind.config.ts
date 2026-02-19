import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
    content: [
        './app/**/*.{js,ts,jsx,tsx,.md}', //
    ],
    theme: {
        extend: {
            typography: {
                quoteless: {
                    css: {
                        'blockquote p:first-of-type::before': {
                            content: 'none',
                        },
                        'blockquote p:first-of-type::after': {
                            content: 'none',
                        },
                    },
                },
            },
        },
    },
    plugins: [typography],
} satisfies Config
