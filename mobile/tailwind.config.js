const { hairlineWidth } = require('nativewind/theme');

const hsl = (name) => `hsl(var(--${name}))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        background: hsl('background'),
        foreground: hsl('foreground'),
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground'), hover: hsl('primary-hover') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('destructive-foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        popover: { DEFAULT: hsl('popover'), foreground: hsl('popover-foreground') },
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        page: hsl('page'),
        track: hsl('track'),
        brand: { DEFAULT: hsl('brand'), soft: hsl('brand-soft'), line: hsl('brand-line') },
        signal: { DEFAULT: hsl('signal'), text: hsl('signal-text'), soft: hsl('signal-soft'), line: hsl('signal-line') },
        success: { DEFAULT: hsl('success'), soft: hsl('success-soft') },
        warn: { DEFAULT: hsl('warn'), soft: hsl('warn-soft') },
        danger: { DEFAULT: hsl('danger'), soft: hsl('danger-soft') },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      borderWidth: { hairline: hairlineWidth() },
      // The prototype's type scale (demo/css/tokens.css). Sizes are in px and
      // grow with the system text size, which React Native applies for us.
      fontSize: {
        '2xs': ['11px', '15px'],
        xs: ['12.5px', '17px'],
        sm: ['13.5px', '19px'],
        base: ['15px', '21px'],
        lg: ['17px', '24px'],
        xl: ['20px', '26px'],
        '2xl': ['24px', '30px'],
        '3xl': ['28px', '34px'],
        num: ['32px', '38px'],
      },
      fontFamily: {
        serif: ['SourceSerif4_600SemiBold'],
        mono: ['IBMPlexMono_500Medium'],
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: { hoverOnlyWhenSupported: true },
  plugins: [require('tailwindcss-animate')],
};
