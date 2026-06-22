const path = require('path');
module.exports = {
  content: [path.join(__dirname, 'app/**/*.js')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:      'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          light:   'rgb(var(--border-light) / <alpha-value>)',
        },
        text: {
          DEFAULT:   'rgb(var(--text) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--text-muted) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          light:   'rgb(var(--accent-light) / <alpha-value>)',
          dark:    'rgb(var(--accent-dark) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger:  'rgb(var(--danger) / <alpha-value>)',
        sidebar: 'rgb(var(--sidebar-bg) / <alpha-value>)',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg:      '10px',
        btn:     '10px',
        pill:    '99px',
      },
      boxShadow: {
        sm:      '0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md:      '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)',
      },
      width: {
        sidebar: '240px',
        'sidebar-collapsed': '60px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
        heading: 'var(--font-heading)',
        body:    'var(--font-body)',
      },
    },
  },
  plugins: [],
};
