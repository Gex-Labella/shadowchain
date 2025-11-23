# Theme Integration Guide

## Overview
This guide documents the integration of theme toggle functionality and animated components (TextScramble & DottedSurface) into the Shadowchain frontend.

## Files Created

### 1. Utility Functions
- **`src/lib/utils.ts`** - CN utility function for merging Tailwind classes

### 2. Theme Management
- **`src/contexts/ThemeContext.tsx`** - React Context for theme management
- **`src/components/ThemeToggle.tsx`** - UI component for toggling themes

### 3. UI Components (To be created after npm install completes)
- **`src/components/ui/text-scramble.tsx`** - Animated text scramble effect
- **`src/components/ui/dotted-surface.tsx`** - 3D dotted surface background

## Dependencies Installed
```bash
npm install framer-motion three clsx tailwind-merge
```

## Integration Steps

### Step 1: Wrap App with ThemeProvider
In `src/index.tsx` or `src/App.tsx`, wrap the app with ThemeProvider:

```tsx
import { ThemeProvider } from './contexts/ThemeContext';

// In your root component:
<ThemeProvider>
  <App />
</ThemeProvider>
```

### Step 2: Add ThemeToggle to Navigation
In components like Landing.tsx, import and use:

```tsx
import { ThemeToggle } from '../components/ThemeToggle';

// In navigation:
<ThemeToggle />
```

### Step 3: Use Animated Components
After components are created, use them in pages:

```tsx
import { TextScramble } from '../components/ui/text-scramble';
import { DottedSurface } from '../components/ui/dotted-surface';

<DottedSurface className="absolute inset-0">
  <TextScramble className="text-4xl font-bold">
    Your Digital Shadow
  </TextScramble>
</DottedSurface>
```

## Tailwind Configuration
The project already has:
- ✅ `darkMode: 'class'` enabled in tailwind.config.js
- ✅ Comprehensive dark mode color palette
- ✅ Custom animations and keyframes

## Next Steps (After npm install completes)
1. Create TextScramble component (adapted for React, without 'use client')
2. Create DottedSurface component (adapted for React, without 'use client')  
3. Integrate ThemeProvider in App.tsx
4. Add ThemeToggle to Landing page navigation
5. Optionally add animated components to Landing page
6. Test theme switching functionality

## Notes
- This is a Create React App project, not Next.js, so 'use client' directives are not needed
- The theme persists in localStorage
- System preference is respected on first load
- All components use TypeScript for type safety