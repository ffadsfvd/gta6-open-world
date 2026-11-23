// Flat SVG silhouettes of Kai's weapons for the weapon bar, and the padlock on slots he does not
// own yet. Each fits a 64 by 40 box and takes the colour of the text around it.

export const WEAPON_ICONS = {
  fists: '<svg viewBox="0 0 64 40"><path d="M14 10h30a8 8 0 0 1 8 8v4a10 10 0 0 1-10 10H20a8 8 0 0 1-8-8V12z" fill="currentColor"/><path d="M22 10v12M32 10v12M42 10v12" stroke="#1a1420" stroke-width="3"/></svg>',
  pistol: '<svg viewBox="0 0 64 40"><path d="M6 10h50v9H30l-3 4h-6l-4 14H8l4-14H6z" fill="currentColor"/><rect x="50" y="6" width="5" height="4" fill="currentColor"/></svg>',
  smg: '<svg viewBox="0 0 64 40"><path d="M2 12h54v8H40l-2 4h-6l-2 12h-7l2-12H14l-2 6H4l2-10H2z" fill="currentColor"/><rect x="26" y="20" width="5" height="14" fill="currentColor"/></svg>',
  shotgun: '<svg viewBox="0 0 64 40"><path d="M1 13h44v5H1zM40 12h10l4 6-6 10h-8l3-8h-5z" fill="currentColor"/><rect x="18" y="18" width="14" height="4" fill="currentColor"/></svg>',
  rifle: '<svg viewBox="0 0 64 40"><path d="M0 16h40v4H0zM34 14h12l12 4-4 10h-7l2-6H34z" fill="currentColor"/><rect x="18" y="9" width="16" height="5" rx="2" fill="currentColor"/><rect x="22" y="20" width="4" height="8" fill="currentColor"/></svg>',
};

export const LOCK_ICON = '<svg viewBox="0 0 24 24" class="lock"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>';
