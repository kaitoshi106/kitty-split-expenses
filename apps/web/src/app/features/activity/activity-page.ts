import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, signal,
} from '@angular/core';
import type { ActivityEntry } from '@kitty/shared-types';
import { formatMoney } from '@kitty/shared-money';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { GroupStore } from '../../core/store/group.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiEmptyState } from '../../ui/ui-empty-state/ui-empty-state';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';

/**
 * @description Read-only activity log explaining why balances changed. Entries are written
 * server-side by ActivityService.log inside each mutation's transaction.
 */
@Component({
  selector: 'app-activity-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPageHeader, UiCard, UiEmptyState],
  template: `
    <main class="flex min-h-dvh flex-col gap-4 px-4 py-4 md:mx-auto md:max-w-2xl">
      <ui-page-header [backLink]="['/g', gid(), 'settings']" [title]="i18n.t('activity.title')" />

      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-14 animate-pulse rounded-2xl bg-slate-100"></div>
          }
        </div>
      } @else if (entries().length === 0) {
        <ui-empty-state
          icon="🕘"
          [title]="i18n.t('activity.empty')"
          [message]="i18n.t('activity.emptyHint')"
        />
      } @else {
        <ui-card [padded]="false">
          <ul class="divide-y divide-slate-100">
            @for (row of rows(); track row.entry.id) {
              <li class="flex gap-3 px-4 py-3">
                <span class="mt-0.5 shrink-0 text-lg" aria-hidden="true">{{ row.icon }}</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm">{{ row.text }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">{{ row.when }}</p>
                </div>
              </li>
            }
          </ul>
        </ui-card>

        @if (canLoadMore()) {
          <button
            type="button"
            class="min-h-11 rounded-xl border border-slate-200 text-sm font-medium
                   hover:bg-slate-50 disabled:text-slate-400"
            [disabled]="loadingMore()"
            (click)="loadMore()"
          >
            {{ loadingMore() ? i18n.t('common.loading') : i18n.t('activity.loadMore') }}
          </button>
        }
      }
    </main>
  `,
})
export class ActivityPage {
  readonly gid = input.required<string>();

  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly store = inject(GroupStore);

  protected readonly entries = signal<ActivityEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  /** False once a page comes back shorter than PAGE_SIZE. */
  protected readonly canLoadMore = signal(false);

  constructor() {
    effect(() => {
      const id = this.gid();
      void this.store.ensureLoaded(id);
      void this.load(id);
    });
  }

  private async load(groupId: string): Promise<void> {
    this.loading.set(true);
    try {
      const page = await firstValueFrom(this.api.listActivity(groupId));
      this.entries.set(page);
      this.canLoadMore.set(page.length >= PAGE_SIZE);
    } catch {
      this.entries.set([]);
      this.canLoadMore.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const last = this.entries().at(-1);
    if (!last || this.loadingMore()) return;

    this.loadingMore.set(true);
    try {
      // Keyset pagination on createdAt: fetch entries older than the last one shown.
      // Offsets would repeat rows when new activity arrives between page loads.
      const page = await firstValueFrom(this.api.listActivity(this.gid(), last.createdAt));
      this.entries.update((all) => [...all, ...page]);
      this.canLoadMore.set(page.length >= PAGE_SIZE);
    } finally {
      this.loadingMore.set(false);
    }
  }

  protected readonly rows = computed(() =>
    this.entries().map((entry) => ({
      entry,
      icon: ICONS[entry.action.split('.')[0]] ?? '•',
      text: this.describe(entry),
      when: this.formatWhen(entry.createdAt),
    })),
  );

  /**
   * @description Builds a sentence such as "<actor> <action> — <title> · <amount>". Details come
   * from the entry's `snapshot`, since the original record may have been deleted.
   * @param entry - Activity entry to describe.
   * @returns Localized description line.
   */
  private describe(entry: ActivityEntry): string {
    const who = entry.actorName ?? this.i18n.t('activity.someone');
    const snapshot = entry.snapshot ?? {};
    const title = typeof snapshot['title'] === 'string' ? snapshot['title'] : '';
    const amount =
      typeof snapshot['amountMinor'] === 'number'
        ? formatMoney(snapshot['amountMinor'], this.store.currency())
        : '';
    const name = typeof snapshot['name'] === 'string' ? snapshot['name'] : '';

    const detail = [title || name, amount].filter(Boolean).join(' · ');
    const what = this.i18n.tAction(entry.action);
    return detail ? `${who} ${what} — ${detail}` : `${who} ${what}`;
  }

  /**
   * @description Formats a timestamp as "d/m/yyyy · HH:mm". Always includes the full date so the
   * column stays uniform and scannable.
   * @param iso - ISO 8601 timestamp.
   */
  private formatWhen(iso: string): string {
    const d = new Date(iso);
    const time = d.toLocaleTimeString(this.i18n.lang() === 'en' ? 'en-GB' : 'vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} · ${time}`;
  }
}

/** Backend default page size; a shorter page means there is no more data. */
const PAGE_SIZE = 30;

const ICONS: Record<string, string> = {
  expense: '🧾',
  payment: '💸',
  member: '👤',
  group: '⚙️',
};
