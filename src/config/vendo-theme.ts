/**
 * Vendo embed brand — the accent color live vendo apps (charts, buttons,
 * links) render with inside this app's chat.
 *
 * Set `accent` to THIS app's primary brand color (a 6-digit hex) when you
 * define or change the app palette, so embedded dashboards match the app.
 * Pick a mid-lightness, clearly chromatic color — near-white, near-black, or
 * gray values are rejected at runtime and replaced by the platform default
 * (readable blue), because charts drawn in them are unreadable.
 */
export const VENDO_BRAND = {
  accent: '#2a78d6',
};
