/**
 * ─── SECURITY INTERCEPTOR ───────────────────────────────────────────────────────
 *
 * WHY
 *   Adds the static, always-on transport headers our API expects on every
 *   call. None of these are auth tokens (MSAL owns that); they're defense-
 *   in-depth affordances.
 *
 * HEADERS
 *   - `X-Requested-With: XMLHttpRequest`
 *         Distinguishes XHR / fetch from full-page navigations server-side —
 *         the backend's anti-forgery / CSRF middleware uses this to decide
 *         whether to re-read the XSRF token.
 *
 *   - `X-XSRF-TOKEN: <cookie value>`
 *         When the BFF (Enterprise.Platform.Web.UI) sets an anti-forgery
 *         cookie (`XSRF-TOKEN` by convention), we echo its value back as a
 *         header. The BFF's anti-forgery middleware verifies they match —
 *         the classic double-submit CSRF defense.
 *
 *   - `X-Content-Type-Options: nosniff`
 *         Asks the server/browser not to MIME-sniff responses. Redundant with
 *         server-set headers, but cheap belt-and-braces.
 *
 * SCOPE
 *   Applied only to calls hitting our API (by URL inspection). External calls
 *   (MS Graph, CDN static assets) are untouched so we don't leak
 *   implementation headers.
 */
import { type HttpInterceptorFn } from '@angular/common/http';

import {
  X_CONTENT_TYPE_OPTIONS,
  X_REQUESTED_WITH,
  X_XSRF_TOKEN,
  XSRF_TOKEN_COOKIE,
} from '@core/http';

/** Returns `true` when the URL points at our platform API. */
function isPlatformApi(url: string): boolean {
  return url.includes('/api/');
}

/**
 * Reads a cookie value by name. Returns `null` when the cookie is absent.
 * Implemented inline (rather than via a service) because cookie reading is
 * pure + tiny and the interceptor chain's only client for it.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  // `name` is a controlled constant from this file (not user input); safe to
  // interpolate. Escape regex metachars defensively so this stays robust if
  // the cookie name is ever changed to include special characters.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // eslint-disable-next-line security/detect-non-literal-regexp -- name is a controlled constant, defensively escaped
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

export const securityInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformApi(req.url)) {
    return next(req);
  }

  const headers: Record<string, string> = {
    [X_REQUESTED_WITH]: 'XMLHttpRequest',
    [X_CONTENT_TYPE_OPTIONS]: 'nosniff',
  };

  const xsrf = readCookie(XSRF_TOKEN_COOKIE);
  if (xsrf) {
    headers[X_XSRF_TOKEN] = xsrf;
  }

  return next(req.clone({ setHeaders: headers }));
};
