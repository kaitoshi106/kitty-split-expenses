import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatMoney } from '@kitty/shared-money';
import { RouterLink } from '@angular/router';
import { GroupStore } from '../../core/store/group.store';
import { ToastService } from '../../core/toast.service';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiModal } from '../../ui/ui-modal/ui-modal';
import { UiEmptyState } from '../../ui/ui-empty-state/ui-empty-state';
import { BalanceList } from '../balances/balance-list';
import { UiPieChart, type PieSlice } from '../../ui/ui-pie-chart/ui-pie-chart';
import { I18nService } from '../../core/i18n/i18n.service';
import { copyText } from '../../core/clipboard';
import { canShare, mailLink, share, smsLink } from '../../core/share';

/**
 * @description Group overview: total spent, balances, settle-up/summary links and invite sharing.
 * Balances are a computed() over expenses and payments, so the view updates on any change
 * without an explicit refresh.
 */
@Component({
  selector: 'app-overview-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiCard, UiAmount, UiButton, UiEmptyState, UiPieChart, BalanceList, UiModal],
  template: `
    <!--
      Layout: the total-spent card spans the full width (a half column is too narrow for
      the donut plus legend); balances and actions form two columns below.
      Mobile order: total → balances → actions → invite.
    -->
    <div class="flex flex-col gap-5 md:grid md:grid-cols-2 md:items-start md:gap-x-6 md:gap-y-4">
      <section class="flex flex-col gap-2 md:col-span-2">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ i18n.t('overview.totalSpent') }}
        </h2>
        <ui-card>
          <!--
            Wide card lays out horizontally (amount beside chart) to save vertical space.
            The @2xl container breakpoint leaves the chart enough width to stay horizontal itself.
          -->
          <div class="@container">
            <div class="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:gap-6">
              <div class="@2xl:w-44 @2xl:shrink-0">
                <ui-amount
                  [minor]="store.totalSpentMinor()"
                  [currency]="store.currency()"
                  size="lg"
                />
                <p class="mt-1 text-xs text-slate-500">
                  {{
                    i18n.t('overview.summaryLine', {
                      members: store.members().length,
                      expenses: store.expenses().length,
                    })
                  }}
                </p>
              </div>

              @if (spendSlices().length > 0) {
                <!-- Label distinguishes amounts paid out from the balances below. -->
                <div
                  class="min-w-0 flex-1 border-t border-slate-100 pt-4
                         @2xl:border-l @2xl:border-t-0 @2xl:pl-6 @2xl:pt-0"
                >
                  <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {{ i18n.t('overview.whoSpent') }}
                  </p>
                  <ui-pie-chart [slices]="spendSlices()" />
                </div>
              }
            </div>
          </div>
        </ui-card>
      </section>

      <section class="flex flex-col gap-2">
        <!-- "See all" shares the heading row so the column height stays aligned with its neighbor. -->
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ i18n.t('overview.balances') }}
          </h2>
          @if (hasMore()) {
            <a
              [routerLink]="['/g', store.groupId(), 'balances']"
              class="text-xs font-medium text-brand-600 hover:underline"
            >
              {{ i18n.t('overview.seeAll', { n: store.balanceRows().length }) }} ›
            </a>
          }
        </div>

        @if (store.members().length === 0) {
          <ui-empty-state
            icon="👥"
            [title]="i18n.t('overview.noMembers')"
            [message]="i18n.t('overview.noMembersHint')"
          />
        } @else {
          <app-balance-list
            [rows]="previewRows()"
            [groupId]="store.groupId()"
            [currency]="store.currency()"
            [currentMemberId]="store.currentMemberId()"
          />
        }
      </section>

      <div class="flex flex-col gap-5">
        <div class="grid grid-cols-2 gap-2">
          <a [routerLink]="['/g', store.groupId(), 'settle-up']" class="contents">
            <ui-button variant="secondary" [full]="true">{{ i18n.t('overview.settleUp') }}</ui-button>
          </a>
          <a [routerLink]="['/g', store.groupId(), 'summary']" class="contents">
            <ui-button variant="secondary" [full]="true">{{ i18n.t('overview.summary') }}</ui-button>
          </a>
        </div>

        <section class="flex flex-col gap-2">
          <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ i18n.t('overview.invite') }}
          </h2>
          <ui-card>
            <div class="flex flex-col items-center gap-3">
              <p class="text-center text-xs text-slate-500">
                {{ i18n.t('overview.inviteHint') }}
              </p>
              <!-- break-all + smaller text on mobile keep the letter-spaced code from overflowing. -->
              <div
                class="w-full break-all rounded-xl bg-slate-50 px-4 py-3 text-center text-xl
                       font-bold tracking-[0.25em] tabular-nums sm:text-2xl"
              >
                {{ store.group()?.inviteCode ?? '········' }}
              </div>
              <!-- A single button opens a prioritized list of share channels. -->
              <ui-button [full]="true" (click)="shareOpen.set(true)">
                {{ i18n.t('overview.share') }}
              </ui-button>
            </div>
          </ui-card>

          <ui-modal [(open)]="shareOpen" [title]="i18n.t('overview.share')">
            <div class="flex flex-col divide-y divide-slate-100">
              @for (o of shareOptions(); track o.id) {
                <!-- sms/mailto are navigations, so links; copy and system share are actions, so buttons. -->
                @if (o.href) {
                  <a
                    [href]="o.href"
                    class="flex min-h-14 items-center gap-3 px-1 text-left hover:bg-slate-50"
                    (click)="shareOpen.set(false)"
                  >
                    <span class="text-xl" aria-hidden="true">{{ o.icon }}</span>
                    <span class="flex-1 text-sm font-medium">{{ o.label }}</span>
                    <span class="text-slate-300" aria-hidden="true">›</span>
                  </a>
                } @else {
                  <button
                    type="button"
                    class="flex min-h-14 items-center gap-3 px-1 text-left hover:bg-slate-50
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-brand-500"
                    (click)="runShareOption(o.id)"
                  >
                    <span class="text-xl" aria-hidden="true">{{ o.icon }}</span>
                    <span class="flex-1 text-sm font-medium">{{ o.label }}</span>
                    <span class="text-slate-300" aria-hidden="true">›</span>
                  </button>
                }
              }
            </div>
          </ui-modal>
        </section>
      </div>
    </div>
  `,
})
export class OverviewTab {
  protected readonly i18n = inject(I18nService);

  protected readonly store = inject(GroupStore);
  private readonly toast = inject(ToastService);

  /** Rows in the truncated balance list; 4 × 56px matches the height of the adjacent column on desktop. */
  private readonly PREVIEW_ROWS = 4;

  protected readonly previewRows = computed(() =>
    this.store.balanceRows().slice(0, this.PREVIEW_ROWS),
  );

  protected readonly hasMore = computed(
    () => this.store.balanceRows().length > this.PREVIEW_ROWS,
  );

  /**
   * Amount each member paid out (not their balance). Slices use the member's avatar color
   * so they match the balance list.
   */
  protected readonly spendSlices = computed<PieSlice[]>(() => {
    const colorById = new Map(this.store.members().map((m) => [m.id, m.avatarColor]));
    return this.store.report().byMember.map((row) => ({
      label: row.label,
      percent: row.percent,
      valueLabel: this.money(row.totalMinor),
      color: row.id ? colorById.get(row.id) : undefined,
    }));
  });

  protected money(minor: number): string {
    return formatMoney(minor, this.store.currency());
  }

  /** Whether navigator.share is available; constant for the session, so not a signal. */
  protected readonly canShare = canShare();
  protected readonly shareOpen = signal(false);

  /**
   * Share channels in priority order:
   * - system share sheet (only when navigator.share exists): the only route to apps such as
   *   Zalo, Instagram and TikTok, which expose no web share links;
   * - SMS and email via plain links, which work everywhere;
   * - copy link / copy code as the always-available fallback.
   */
  protected readonly shareOptions = computed(() => {
    const { title, text, url } = this.inviteMessage();
    const options: { id: string; icon: string; label: string; href?: string }[] = [];
    if (this.canShare) {
      options.push({ id: 'system', icon: '📤', label: this.i18n.t('overview.shareSystem') });
    }
    options.push(
      { id: 'sms', icon: '💬', label: this.i18n.t('overview.shareSms'), href: smsLink(`${text} ${url}`) },
      { id: 'mail', icon: '✉️', label: this.i18n.t('overview.shareEmail'), href: mailLink(title, `${text}\n\n${url}`) },
      { id: 'link', icon: '🔗', label: this.i18n.t('overview.copyLink') },
      { id: 'code', icon: '#️⃣', label: this.i18n.t('overview.copyCode') },
    );
    return options;
  });

  protected async runShareOption(id: string): Promise<void> {
    if (id === 'system') {
      const result = await share(this.inviteMessage());
      if (result === 'unavailable') this.toast.error(this.i18n.t('overview.shareFailed'));
    } else if (id === 'link') {
      await this.copyLink();
    } else if (id === 'code') {
      await this.copyCode();
    }
    this.shareOpen.set(false);
  }

  /** Invite payload shared by the system share sheet and the SMS/email links. */
  private inviteMessage(): { title: string; text: string; url: string } {
    const group = this.store.group();
    const code = group?.inviteCode ?? '';
    return {
      title: this.i18n.t('overview.shareTitle', { group: group?.name ?? '' }),
      text: this.i18n.t('overview.shareText', { group: group?.name ?? '', code }),
      url: `${location.origin}/join/${code}`,
    };
  }




  protected async copyCode(): Promise<void> {
    await this.copy(this.store.group()?.inviteCode ?? '', this.i18n.t('overview.copiedCode'));
  }

  protected async copyLink(): Promise<void> {
    const code = this.store.group()?.inviteCode ?? '';
    await this.copy(`${location.origin}/join/${code}`, this.i18n.t('overview.copiedLink'));
  }

  private async copy(text: string, message: string): Promise<void> {
    // copyText falls back when navigator.clipboard is missing (non-secure http, e.g. LAN).
    if (await copyText(text)) this.toast.success(message);
    else this.toast.error(this.i18n.t('overview.copyFailed'));
  }
}
