/**
 * colors.ts — Chart/SVG color palette
 *
 * ⚠️ IMPORTANT: This file DEPENDS on frontend/src/styles/theme/theme-finrush.css
 *
 * CSS custom properties (--color-*, --primary, --accent) cannot be used directly
 * in Recharts, SVG attributes, or inline styles. These hex values approximate
 * the OKLCH definitions in theme-finrush.css.
 *
 * WHEN UPDATING COLORS:
 * 1. Update frontend/src/styles/theme/theme-finrush.css (source of truth)
 * 2. Convert OKLCH to HEX and update this file
 * 3. Ensure visual consistency across all charts
 *
 * Usage:
 *   import { SEMANTIC_COLORS, PIE_COLORS, CHART_COLORS } from "@/lib/colors";
 */

/**
 * Primary color palette — mirrors --color-* vars in theme-finrush.css
 * Values are HEX approximations of OKLCH definitions
 */
export const CHART_COLORS = {
  // Primary brand colors (oklch definitions in theme-finrush.css)
  lime:   "#C8FF00", // oklch(0.85 0.23 123) — --color-lime
  purple: "#B388FF", // oklch(0.75 0.18 300) — --color-purple
  amber:  "#FFAA33", // oklch(0.75 0.18 70) — --color-amber
  red:    "#FF4D4D", // oklch(0.5 0.25 15) — --color-red (darker than old #FF6B6B)
  green:  "#2D5F2E", // oklch(0.2 0.02 145) — --color-green

  // Secondary palette (for additional data visualization)
  cyan:   "#00E5FF", // Extended palette
  teal:   "#5EEAD4", // Extended palette
  yellow: "#FCD34D", // Extended palette
  sky:    "#38BDF8", // Extended palette
  pink:   "#FF44BB", // Extended palette
} as const;

/**
 * Ordered array for pie/bar charts — consistent order across all tabs.
 * First 4 entries match the semantic colors intentionally.
 */
export const PIE_COLORS = [
  CHART_COLORS.lime,
  CHART_COLORS.purple,
  CHART_COLORS.amber,
  CHART_COLORS.teal,
  CHART_COLORS.red,
  CHART_COLORS.sky,
  CHART_COLORS.yellow,
  CHART_COLORS.green,
] as const;

/**
 * Semantic colors — financial flow mapping
 *
 * Maps business concepts to palette colors for use in JSX/SVG attributes
 * (Recharts stroke/fill, SVG attributes, inline style objects).
 */
export const SEMANTIC_COLORS = {
  // Financial flows (synchronized with --color-* semantic aliases in theme)
  income:     CHART_COLORS.lime,     // --color-income
  expense:    CHART_COLORS.red,      // --color-expense
  investment: CHART_COLORS.purple,   // --color-investment
  savings:    CHART_COLORS.amber,    // --color-savings

  // Typography & surfaces (oklch definitions in theme)
  foreground:   "#F0F5F1",  // --color-text (oklch 0.95 0.01 140)
  muted:        "#8FA3A0",  // oklch(0.65 0.01 140) — --color-text-muted
  glassText:    "#A0A0A0",  // oklch(0.63 0.01 140) — muted dim

  // Glass effect layers (opacity-based, from theme-finrush.css)
  glassBorder:  "rgba(255,255,255,0.2)",  // --opacity-2x (was 0.12)
  glassHover:   "rgba(255,255,255,0.12)", // --opacity-low (was 0.07)
  glassBg:      "rgba(255,255,255,0.05)", // --opacity-tiny
} as const;
