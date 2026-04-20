/**
 * Application bootstrap.
 *
 * Keep this file minimal. All provider wiring lives in `src/app/config/app.config.ts`.
 * Pre-Angular code here should be rare and scoped — global DOM observers, feature
 * polyfills, or feature-detection. If in doubt, move it into a service and register
 * it via `provideAppInitializer()` inside `app.config.ts`.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appConfig } from './app/config/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  // Bootstrap failures are fatal — log to console so they surface in devtools
  // and in the telemetry pipeline once that wire-up lands (Phase 3).
  // eslint-disable-next-line no-console
  console.error('Application bootstrap failed:', err);
});
