/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Polkadot-inspired palette
        'dot': {
          'primary': '#E6007A',     // Signature pink
          'secondary': '#670D35',   // Deep burgundy
          'accent': '#F272B6',      // Light pink
          'light': '#FFB8D9',       // Soft pink
          'dark': '#4A0926',        // Dark burgundy
        },
        
        // Shadow identity colors
        'shadow': {
          50: '#1A0B2E',   // Deepest shadow
          100: '#2D1B69',  // Deep purple
          200: '#462C8A',  // Medium purple
          300: '#6B46C1',  // Bright purple
          400: '#9061F9',  // Light purple
          500: '#B794F6',  // Pastel purple
          600: '#D6BCFA',  // Lighter purple
          700: '#EDE9FE',  // Very light purple
        },
        
        // Semantic colors for trust & status
        'trust': {
          'verified': '#10B981',   // Green
          'pending': '#F59E0B',    // Amber
          'encrypted': '#06B6D4',  // Cyan
          'error': '#EF4444',      // Red
        },
        
        // Web2 source colors
        'source': {
          'github': '#9945FF',     // Purple (Solana-like)
          'twitter': '#1DA1F2',    // Twitter blue
          'discord': '#5865F2',    // Discord purple
          'linkedin': '#0A66C2',   // LinkedIn blue
        },
        
        // Neutral glass morphism
        'glass': {
          'white': 'rgba(255, 255, 255, 0.05)',
          'light': 'rgba(255, 255, 255, 0.1)',
          'medium': 'rgba(255, 255, 255, 0.15)',
          'dark': 'rgba(0, 0, 0, 0.3)',
          'darker': 'rgba(0, 0, 0, 0.6)',
        }
      },
      
      fontFamily: {
        'display': ['Space Grotesk', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xs': ['0.5rem', { lineHeight: '0.75rem' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(230, 0, 122, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(230, 0, 122, 0.8)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      
      backdropBlur: {
        'xs': '2px',
        '2xl': '40px',
      },
      
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(to right top, #E6007A, #9945FF, #06B6D4)',
        'gradient-dark': 'linear-gradient(to bottom, #1A0B2E, #2D1B69)',
        'gradient-light': 'linear-gradient(to top, #B794F6, #F272B6)',
      },
      
      boxShadow: {
        'glow-sm': '0 0 10px rgba(230, 0, 122, 0.3)',
        'glow': '0 0 20px rgba(230, 0, 122, 0.5)',
        'glow-lg': '0 0 30px rgba(230, 0, 122, 0.7)',
        'inner-glow': 'inset 0 0 20px rgba(230, 0, 122, 0.1)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'neon': '0 0 5px theme(colors.dot.primary), 0 0 20px theme(colors.dot.primary)',
      },
      
      borderRadius: {
        'sharp': '4px',
        'smooth': '12px',
        'pill': '100px',
      },
      
      transitionDuration: {
        '400': '400ms',
      },
      
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}