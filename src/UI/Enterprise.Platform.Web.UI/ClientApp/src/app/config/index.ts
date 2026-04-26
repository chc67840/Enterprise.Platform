/** Barrel for `@config/*`. */
export { appConfig } from './app.config';
export { primeNgConfig } from './primeng.config';
export {
  RUNTIME_CONFIG,
  loadRuntimeConfig,
  type RuntimeConfigLoadOutcome,
  type LoadRuntimeConfigOptions,
} from './runtime-config';
export {
  RuntimeConfigSchema,
  type RuntimeConfig,
  type SessionRuntimeConfig,
} from './runtime-config.model';
