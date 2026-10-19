// Each organization has its own URLs: /<slug>/login, /<slug>/dashboard, ...
// These first path segments belong to the app itself (kept in sync with
// RESERVED_SLUGS in backend/services/organizationService.js).
const APP_SEGMENTS = new Set([
  'api', 'login', 'signup', 'platform', 'onboarding', 'change-password', 'clock-in', 'dashboard', 'assets',
]);

/** The organization slug in the current URL, or null on app-level pages like /login. */
export const slugFromPath = (pathname: string = window.location.pathname): string | null => {
  const segment = pathname.split('/')[1];
  return segment && !APP_SEGMENTS.has(segment) ? decodeURIComponent(segment) : null;
};

/** Prefixes an app path ("/dashboard?module=x") with the organization slug. */
export const orgPath = (slug: string | null | undefined, path: string): string =>
  slug ? `/${encodeURIComponent(slug)}${path}` : path;
