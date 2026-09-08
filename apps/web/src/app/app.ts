import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppUpdateService } from './core/app-update';
import { ThemeService } from './core/theme.service';
import { UiReceiptViewer } from './ui/ui-receipt-viewer/ui-receipt-viewer';
import { UiToastHost } from './ui/ui-toast-host/ui-toast-host';
import { UiScrollTop } from './ui/ui-scroll-top/ui-scroll-top';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastHost, UiReceiptViewer, UiScrollTop],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Started at the root so update polling lives for the whole session.
    inject(AppUpdateService).start();

    // Eagerly instantiate ThemeService: a root-provided service is only created
    // when injected, and its effect must run on every entry route to keep
    // <meta name="theme-color"> in sync with the active theme.
    inject(ThemeService);
  }
}
