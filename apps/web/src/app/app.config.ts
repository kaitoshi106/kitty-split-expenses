import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ApiService } from './core/api/api.service';
import { HttpApiService } from './core/api/http-api.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    /**
     * @description Zoneless change detection: views re-render only when a signal changes.
     * Saves ~35 kB raw / ~11.5 kB transferred from the initial bundle.
     *
     * All rendered state must live in signals. A plain property bound in a
     * template will silently stop updating; there is no runtime error.
     */
    provideZonelessChangeDetection(),

    // Route params bind directly to component inputs (e.g. `gid = input.required<string>()`).
    provideRouter(appRoutes, withComponentInputBinding()),

    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),

    // Backend switch: swap HttpApiService for MockApiService to run without the API.
    { provide: ApiService, useClass: HttpApiService },

    /**
     * @description Service worker for PWA install and static asset caching.
     * Disabled in dev to avoid stale cached builds. Registration waits until the
     * app is stable (max 30 s) so it does not compete with initial requests.
     * ngsw-config.json caches only static build files; API responses are never
     * served from cache, since stale balances would be worse than waiting.
     */
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
