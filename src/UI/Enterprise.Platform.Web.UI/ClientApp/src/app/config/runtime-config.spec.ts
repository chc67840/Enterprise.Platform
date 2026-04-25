/**
 * ─── RUNTIME CONFIG LOADER — UNIT TESTS ─────────────────────────────────────────
 *
 * TODO 2.1.5 scope:
 *   - `loadRuntimeConfig` handles 200 (happy path)
 *   - 404 / network failure → fallback to build-time defaults
 *   - Malformed JSON body → throws (loud deploy-error surface)
 *   - Schema-invalid payload → throws
 *   - Timeout → fallback
 *
 * SCOPE
 *   Pure function tests — no Angular TestBed required. Each case injects a
 *   fake `fetch` via the `fetchImpl` option so tests stay deterministic and
 *   run in under a millisecond apiece.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RUNTIME_CONFIG_HOLDER,
  loadRuntimeConfig,
  __resetRuntimeConfigForTests,
} from './runtime-config';

/** Builds a minimal schema-valid runtime config payload. */
function validPayload() {
  return {
    apiBaseUrl: 'https://api.example.test/api/v1',
    bffBaseUrl: 'https://app.example.test',
  };
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

describe('loadRuntimeConfig', () => {
  beforeEach(() => {
    __resetRuntimeConfigForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies the fetched payload and returns "fetched" on 200 OK', async () => {
    const payload = validPayload();
    const fetchImpl = vi.fn(async () => jsonResponse(payload));

    const outcome = await loadRuntimeConfig({ fetchImpl });

    expect(outcome).toBe('fetched');
    expect(RUNTIME_CONFIG_HOLDER.apiBaseUrl).toBe(payload.apiBaseUrl);
    expect(RUNTIME_CONFIG_HOLDER.bffBaseUrl).toBe(payload.bffBaseUrl);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('applies Zod defaults for optional fields that are omitted', async () => {
    // `telemetry`, `session`, and `features` are optional with defaults.
    const fetchImpl = vi.fn(async () => jsonResponse(validPayload()));

    await loadRuntimeConfig({ fetchImpl });

    expect(RUNTIME_CONFIG_HOLDER.telemetry.appInsightsConnectionString).toBe('');
    expect(RUNTIME_CONFIG_HOLDER.telemetry.sampleRate).toBe(1);
    expect(RUNTIME_CONFIG_HOLDER.session.warningLeadTimeSeconds).toBe(120);
    expect(RUNTIME_CONFIG_HOLDER.features).toEqual({});
  });

  it('falls back to build-time defaults when the fetch 404s', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));

    const outcome = await loadRuntimeConfig({ fetchImpl });

    expect(outcome).toBe('fallback');
    // Fallback comes from environment.ts — apiBaseUrl exists but points at dev.
    expect(RUNTIME_CONFIG_HOLDER.apiBaseUrl.length).toBeGreaterThan(0);
  });

  it('falls back when the fetch rejects with a network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    const outcome = await loadRuntimeConfig({ fetchImpl });

    expect(outcome).toBe('fallback');
  });

  it('falls back when the fetch is aborted past the timeout window', async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          // Honour the abort signal — AbortController dispatches after the timeout.
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const outcome = await loadRuntimeConfig({ fetchImpl, timeoutMs: 1 });

    expect(outcome).toBe('fallback');
  });

  it('throws when the body is not valid JSON (loud deploy error)', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('not json at all', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(loadRuntimeConfig({ fetchImpl })).rejects.toThrow(/non-JSON/i);
  });

  it('throws when the payload fails schema validation (loud deploy error)', async () => {
    const fetchImpl = vi.fn(
      async () =>
        jsonResponse({
          // Missing required `apiBaseUrl`.
          bffBaseUrl: 'https://foo',
        }),
    );

    await expect(loadRuntimeConfig({ fetchImpl })).rejects.toThrow(/schema validation/i);
  });

  it('invokes the onOutcome callback with the resolved outcome', async () => {
    const onOutcome = vi.fn();
    const fetchImpl = vi.fn(async () => jsonResponse(validPayload()));

    await loadRuntimeConfig({ fetchImpl, onOutcome });

    expect(onOutcome).toHaveBeenCalledWith('fetched');
  });

  it('sends the request with cache: no-cache and credentials: same-origin', async () => {
    // Type the mock as `typeof fetch` so `mock.calls[0]` is typed as the
    // fetch arg tuple `[input, init?]` instead of the `[]` Vitest infers
    // from the no-arg arrow body.
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(validPayload()));

    await loadRuntimeConfig({ fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/config.json');
    expect(init?.cache).toBe('no-cache');
    expect(init?.credentials).toBe('same-origin');
  });
});
