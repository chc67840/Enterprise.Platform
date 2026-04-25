/**
 * ─── ERROR INTERCEPTOR — UNIT TESTS ─────────────────────────────────────────────
 *
 * Proves the ownership policy + normalization contract:
 *   - 0 (network) → toast + normalized code `EP.Network`.
 *   - 401 → sticky warn + router.navigate(`/auth/login?returnUrl=…`).
 *   - 403 → error toast + router.navigate(`/error/forbidden`).
 *   - 404 → NO toast.
 *   - 409 → warn toast ("Record changed") without navigation.
 *   - 422 → NO toast (forms render per-field errors).
 *   - 5xx → error toast.
 *   - `X-Skip-Error-Handling: true` short-circuits and strips the header.
 */
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationService } from '@core/services/notification.service';

import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let notify: NotificationService;
  let router: Router;

  // Type the spies as `Mock<MethodSignature>` so `mockImplementation` accepts
  // them without a `as never` cast. Without the generic, vi.fn() defaults to
  // `Mock<Procedure | Constructable>` which is too loose for PrimeNG's
  // strongly-typed message-service signatures.
  let errorSpy: Mock<NotificationService['error']>;
  let warnSpy: Mock<NotificationService['warn']>;
  let stickySpy: Mock<NotificationService['sticky']>;
  let navigateSpy: Mock<Router['navigate']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        // NotificationService injects PrimeNG's MessageService — it isn't
        // auto-provided by the testing harness, so supply it here.
        MessageService,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    notify = TestBed.inject(NotificationService);
    router = TestBed.inject(Router);

    errorSpy = vi.fn<NotificationService['error']>();
    warnSpy = vi.fn<NotificationService['warn']>();
    stickySpy = vi.fn<NotificationService['sticky']>();
    navigateSpy = vi.fn<Router['navigate']>();

    vi.spyOn(notify, 'error').mockImplementation(errorSpy);
    vi.spyOn(notify, 'warn').mockImplementation(warnSpy);
    vi.spyOn(notify, 'sticky').mockImplementation(stickySpy);
    vi.spyOn(router, 'navigate').mockImplementation(navigateSpy);
    Object.defineProperty(router, 'url', {
      get: () => '/current-page',
      configurable: true,
    });
  });

  function trigger(status: number, body: string | object = 'boom'): void {
    http.get('/api/probe').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/probe');
    req.flush(body, { status, statusText: statusTextFor(status) });
  }

  function statusTextFor(status: number): string {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 409: return 'Conflict';
      case 422: return 'Unprocessable';
      case 500: return 'Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      default:  return '';
    }
  }

  it('toasts "offline" on a status-0 network failure', () => {
    http.get('/api/probe').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/probe');
    req.error(new ProgressEvent('error'), { status: 0 });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toBe('You appear to be offline');
  });

  it('shows sticky warn + navigates to /auth/login on 401', () => {
    trigger(401);
    expect(stickySpy).toHaveBeenCalledWith('warn', 'Session expired', expect.any(String));
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/auth/login'],
      { queryParams: { returnUrl: '/current-page' } },
    );
  });

  it('shows error toast + navigates to /error/forbidden on 403', () => {
    trigger(403);
    expect(errorSpy).toHaveBeenCalledWith('Access denied', expect.any(String));
    expect(navigateSpy).toHaveBeenCalledWith(['/error/forbidden']);
  });

  it('is silent on 404', () => {
    trigger(404);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('renders a "record changed" warn toast on 409 without navigation', () => {
    trigger(409);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe('Record changed');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('is silent on 422 (field errors projected inline by forms)', () => {
    trigger(422, { errors: { email: ['invalid'] } });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('shows a server-error toast on 500/502/503/504', () => {
    for (const status of [500, 502, 503, 504]) {
      errorSpy.mockClear();
      trigger(status);
      expect(errorSpy).toHaveBeenCalledWith('Server error', expect.any(String));
    }
  });

  it('warns with status on other 4xx failures', () => {
    trigger(418); // I'm a teapot
    expect(warnSpy).toHaveBeenCalledWith('Request failed (418)', expect.any(String));
  });

  it('strips X-Skip-Error-Handling and suppresses all side-effects', () => {
    http
      .get('/api/probe', { headers: { 'X-Skip-Error-Handling': 'true' } })
      .subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/probe');
    expect(req.request.headers.has('X-Skip-Error-Handling')).toBe(false);
    req.flush('boom', { status: 500, statusText: 'Server Error' });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(stickySpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
