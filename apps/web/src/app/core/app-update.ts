import { inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { I18nService } from './i18n/i18n.service';
import { ToastService } from './toast.service';

/**
 * sessionStorage flag set right before reloading into a new version, so the
 * reloaded page can confirm the update. Scoped to the tab that updated.
 */
const JUST_UPDATED_KEY = 'kitty.justUpdated';

/**
 * @description Delivers new builds to installed PWAs. The service worker keeps serving the
 * cached version until every app tab closes, which an installed iOS PWA rarely does.
 * When a new version is ready the user is offered a reload via toast rather than forced,
 * so in-progress form input is not lost. An `unrecoverable` state reloads immediately.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  /** @description Subscribes to service worker update events and checks for a new version. */
  start(): void {
    // Runs before the isEnabled check: a pending flag must be cleared either way.
    this.announceUpdateApplied();

    // Disabled in dev and in browsers without service worker support.
    if (!this.updates.isEnabled) return;

    this.updates.versionUpdates.subscribe((e) => {
      if (e.type === 'VERSION_READY') {
        this.toast.undo(
          this.i18n.t('update.ready'),
          this.i18n.t('update.reload'),
          () => this.activate(),
        );
      }
    });

    this.updates.unrecoverable.subscribe(() => {
      // The cache is broken beyond repair; staying on this version would hang the app.
      document.location.reload();
    });

    // Check on startup in addition to Angular's periodic checks.
    void this.updates.checkForUpdate().catch(() => undefined);
  }

  private async activate(): Promise<void> {
    try {
      await this.updates.activateUpdate();
    } finally {
      // Set the flag before reloading; in-memory state does not survive the reload.
      try {
        sessionStorage.setItem(JUST_UPDATED_KEY, '1');
      } catch {
        /* Storage may be blocked (e.g. private mode); only the confirmation is lost. */
      }
      document.location.reload();
    }
  }

  /**
   * @description Shows a confirmation toast once the new version is running.
   * The flag is cleared on read so a later manual reload does not repeat it.
   */
  private announceUpdateApplied(): void {
    let justUpdated = false;
    try {
      justUpdated = sessionStorage.getItem(JUST_UPDATED_KEY) === '1';
      if (justUpdated) sessionStorage.removeItem(JUST_UPDATED_KEY);
    } catch {
      return;
    }
    if (justUpdated) this.toast.success(this.i18n.t('update.done'));
  }
}
