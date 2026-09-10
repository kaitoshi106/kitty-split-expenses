import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { GroupStore } from '../../core/store/group.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';
import { UiCard } from '../../ui/ui-card/ui-card';
import { BalanceList } from './balance-list';

/**
 * @description Full balance list. The overview shows only the first rows; the rest live here
 * on a separate page rather than in a nested scroll area, which is error-prone on mobile.
 */
@Component({
  selector: 'app-balances-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPageHeader, UiCard, BalanceList],
  template: `
    <main class="flex min-h-dvh flex-col gap-4 px-4 py-4 md:mx-auto md:max-w-2xl">
      <ui-page-header [backLink]="['/g', gid(), 'overview']" [title]="i18n.t('balances.title')" />

      <ui-card>
        <p class="text-xs uppercase text-slate-400">{{ i18n.t('balances.netLine') }}</p>
        <p class="mt-1 text-sm text-slate-600">
          {{
            i18n.t('balances.summary', {
              owing: owingCount(),
              receiving: receivingCount(),
              settled: settledCount(),
            })
          }}
        </p>
      </ui-card>

      <app-balance-list
        [rows]="store.balanceRows()"
        [groupId]="store.groupId()"
        [currency]="store.currency()"
        [currentMemberId]="store.currentMemberId()"
      />
    </main>
  `,
})
export class BalancesPage {
  readonly gid = input.required<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(GroupStore);

  constructor() {
    effect(() => {
      void this.store.ensureLoaded(this.gid());
    });
  }

  protected readonly owingCount = computed(
    () => this.store.balanceRows().filter((r) => r.balanceMinor < 0).length,
  );
  protected readonly receivingCount = computed(
    () => this.store.balanceRows().filter((r) => r.balanceMinor > 0).length,
  );
  protected readonly settledCount = computed(
    () => this.store.balanceRows().filter((r) => r.balanceMinor === 0).length,
  );
}
