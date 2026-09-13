import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, signal,
} from '@angular/core';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';
import { formatMoney } from '@kitty/shared-money';
import { firstValueFrom } from 'rxjs';
import { ApiService, type ExportFormat } from '../../core/api/api.service';
import { saveBlobResponse } from '../../core/download-file';
import { GroupStore } from '../../core/store/group.store';
import { ToastService } from '../../core/toast.service';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiPieChart, type PieSlice } from '../../ui/ui-pie-chart/ui-pie-chart';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-summary-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPageHeader, UiCard, UiAvatar, UiAmount, UiButton, UiPieChart],
  template: `
    <main class="flex min-h-dvh flex-col gap-4 px-4 py-4 md:mx-auto md:max-w-2xl">
      <ui-page-header [backLink]="['/g', gid(), 'overview']" [title]="i18n.t('summary.title')" />

      <ui-card>
        <p class="text-xs uppercase text-slate-400">{{ i18n.t('summary.totalSpent') }}</p>
        <ui-amount [minor]="store.totalSpentMinor()" [currency]="store.currency()" size="lg" />
        <p class="mt-1 text-xs text-slate-500">
          {{
            i18n.t('summary.line', {
              expenses: store.expenses().length,
              members: store.members().length,
            })
          }}
        </p>
      </ui-card>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ i18n.t('summary.whoSpent') }}
        </h2>
        <ui-card [padded]="false">
          <div class="divide-y divide-slate-100">
            @for (row of perMember(); track row.member.id) {
              <div class="flex min-h-14 items-center gap-3 px-4">
                <ui-avatar [name]="row.member.name" [color]="row.member.avatarColor" size="sm" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ row.member.name }}</span>
                <!-- Plain CSS share bar -->
                <div class="hidden h-2 w-24 overflow-hidden rounded-full bg-slate-100 md:block">
                  <div class="h-full bg-brand-500" [style.width.%]="row.percent"></div>
                </div>
                <ui-amount [minor]="row.spentMinor" [currency]="store.currency()" size="sm" />
              </div>
            }
          </div>
        </ui-card>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ i18n.t('summary.byCategory') }}
        </h2>
        <ui-card>
          <ui-pie-chart
            [slices]="categorySlices()"
            [centerLabel]="i18n.t('summary.totalSpent')"
            [centerValue]="money(store.totalSpentMinor())"
            [emptyLabel]="i18n.t('common.noData')"
          />
        </ui-card>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ i18n.t('summary.export') }}
        </h2>
        <ui-card>
          <p class="mb-3 text-sm text-slate-500">{{ i18n.t('summary.exportHint') }}</p>
          <div class="flex flex-col gap-2 md:flex-row">
            <ui-button
              variant="secondary"
              [full]="true"
              [loading]="busy() === 'pdf'"
              [disabled]="busy() !== null"
              (click)="download('pdf')"
            >
              📄 {{ i18n.t('summary.exportPdf') }}
            </ui-button>
            <ui-button
              variant="secondary"
              [full]="true"
              [loading]="busy() === 'xlsx'"
              [disabled]="busy() !== null"
              (click)="download('xlsx')"
            >
              📊 {{ i18n.t('summary.exportXlsx') }}
            </ui-button>
          </div>
        </ui-card>
      </section>
    </main>
  `,
})
export class SummaryPage {
  protected readonly i18n = inject(I18nService);

  readonly gid = input.required<string>();
  protected readonly store = inject(GroupStore);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  constructor() {
    effect(() => {
      void this.store.ensureLoaded(this.gid());
    });
  }

  protected readonly perMember = computed(() => {
    const total = this.store.totalSpentMinor() || 1;
    const spent = new Map(this.store.members().map((m) => [m.id, 0]));
    for (const e of this.store.expenses()) {
      for (const p of e.payers) spent.set(p.memberId, (spent.get(p.memberId) ?? 0) + p.amountMinor);
    }
    return this.store
      .members()
      .map((member) => {
        const spentMinor = spent.get(member.id) ?? 0;
        return { member, spentMinor, percent: Math.round((spentMinor / total) * 100) };
      })
      .sort((a, b) => b.spentMinor - a.spentMinor);
  });

  /** Category slices; same figures as the by-category section of the exported report. */
  protected readonly categorySlices = computed<PieSlice[]>(() =>
    this.store.report().byCategory.map((row) => ({
      label: row.label,
      percent: row.percent,
      valueLabel: this.money(row.totalMinor),
    })),
  );

  /** Format currently being exported, or null when idle. */
  protected readonly busy = signal<ExportFormat | null>(null);

  protected async download(format: ExportFormat): Promise<void> {
    if (this.busy()) return;
    this.busy.set(format);
    try {
      const response = await firstValueFrom(
        this.api.exportSummary(this.gid(), format, this.i18n.lang()),
      );
      saveBlobResponse(response, `${this.i18n.t('summary.title')}.${format}`);
    } catch {
      this.toast.error(this.i18n.t('summary.exportFailed'));
    } finally {
      this.busy.set(null);
    }
  }

  protected money(minor: number): string {
    return formatMoney(minor, this.store.currency());
  }
}
