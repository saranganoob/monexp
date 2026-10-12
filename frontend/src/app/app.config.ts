import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, LOCALE_ID, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { sessionInterceptor } from './core/auth/session.interceptor';
import { ThemeService } from './core/theme.service';
import { clientIdInterceptor } from './core/live.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([sessionInterceptor, clientIdInterceptor])),
    { provide: LOCALE_ID, useValue: 'en-US' },
    // Apply the saved light/dark theme before the first screen shows.
    provideAppInitializer(() => { inject(ThemeService); }),
  ],
};
