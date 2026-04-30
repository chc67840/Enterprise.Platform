/** Barrel for `@core/http/*`. */
export { API_BASE_URL } from './api-config.token';
export { BaseApiService } from './base-api.service';
export {
  X_CORRELATION_ID,
  X_IDEMPOTENCY_KEY,
  X_API_VERSION,
  X_REQUEST_ID,
  X_SKIP_ERROR_HANDLING,
  X_XSRF_TOKEN,
  X_REQUESTED_WITH,
  X_CONTENT_TYPE_OPTIONS,
  XSRF_TOKEN_COOKIE,
} from './http-headers.constants';
