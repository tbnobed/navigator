/**
 * Semantic design tokens for the mobile app.
 *
 * Wayfinding-signage palette: confident indigo-blue as the primary action
 * color (echoes airport/campus signage), a warm amber accent reserved for
 * the live route line and directional cues, on a calm, light surface.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#12172B',
    tint: '#3457D5',

    // Core surfaces
    background: '#F5F7FB',
    foreground: '#12172B',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#12172B',

    // Primary action color (buttons, links, active states)
    primary: '#3457D5',
    primaryForeground: '#FFFFFF',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E9EDFA',
    secondaryForeground: '#2A3352',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDF0F7',
    mutedForeground: '#6B7390',

    // Accent highlights — reserved for the live route line and direction arrow
    accent: '#FF9F1C',
    accentForeground: '#2B1600',

    // Destructive actions (delete, error states)
    destructive: '#E5484D',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#E1E5F0',
    input: '#E1E5F0',
  },

  // Border radius (in px). Applies to cards, buttons, inputs, and modals.
  radius: 16,
};

export default colors;
