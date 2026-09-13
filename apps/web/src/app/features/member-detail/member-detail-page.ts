import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiPageHeader } from '../../ui/ui-page-header/ui-page-header';
import { GroupStore } from '../../core/store/group.store';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiButton } from '../../ui/ui-button/ui-button';
import { UiCard } from '../../ui/ui-card/ui-card';
import { UiSegmentedTabs } from '../../ui/ui-segmented-tabs/ui-segmented-tabs';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-member-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPageHeader, UiCard, UiAvatar, UiAmount, UiButton, UiSegmentedTabs],
  template: `
    <main class="flex min-h-dvh flex-col gap-4 px-4 py-4 md:mx-auto md:max-w-2xl">
      <ui-page-header [backLink]="['/g', gid(), 'overview']" [title]="member()?.name ?? '…'" />

      @if (member(); as m) {
        <div class="flex flex-col items-center gap-2 py-4">
          <ui-avatar [name]="m.name" [color]="m.avatarColor" size="lg" />
          <ui-amount [minor]="balanceMinor()" [currency]="store.currency()" [signed]="true" size="lg" />
          <p class="text-xs text-slate-500">{{ balanceLabel() }}</p>
          @if (member()?.role === 'admin') {
            <span
              class="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
            >
              {{ i18n.t('memberDetail.admin') }}
            </span>
          }
        </div>

        <!--
          Balance breakdown: each line is a signed term and the lines add up to the
          balance, so users can verify the figure themselves.
        -->
        <ui-card [padded]="false">
          <p
            class="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {{ i18n.t('memberDetail.breakdownTitle') }}
          </p>
          <div class="divide-y divide-slate-100 px-4">
            @for (line of breakdown(); track line.key) {
              <div class="flex items-center justify-between gap-3 py-2.5">
                <span class="min-w-0 flex-1 text-sm text-slate-600">{{ line.label }}</span>
                <!-- Signed: the sign shows whether the line raises or lowers the balance. -->
                <ui-amount
                  [minor]="line.minor"
                  [currency]="store.currency()"
                  [signed]="true"
                  size="sm"
                />
              </div>
            } @empty {
              <p class="py-3 text-sm text-slate-400">{{ i18n.t('memberDetail.noActivity') }}</p>
            }
          </div>
          <div
            class="flex items-center justify-between gap-3 border-t-2 border-slate-200 px-4 py-3"
          >
            <span class="text-sm font-semibold">{{ i18n.t('memberDetail.balanceRow') }}</span>
            <ui-amount
              [minor]="balanceMinor()"
              [currency]="store.currency()"
              [signed]="true"
              size="md"
            />
          </div>
        </ui-card>

        <ui-segmented-tabs [tabs]="tabs()" [(active)]="activeTab" />

        <ui-card [padded]="false">
          <div class="divide-y divide-slate-100">
            <!-- Total sits above the list so it is visible without scrolling. -->
            @if (visibleRows().length) {
              <div class="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {{ i18n.t('memberDetail.listTotal') }}
                </span>
                <span class="font-semibold text-slate-700">
                  <ui-amount [minor]="totalMinor()" [currency]="store.currency()" size="sm" />
                </span>
              </div>
            }
            @for (row of visibleRows(); track row.id) {
              <div class="flex min-h-14 items-center gap-3 px-4">
                <span class="min-w-0 flex-1 truncate text-sm">{{ row.label }}</span>
                <ui-amount [minor]="row.amountMinor" [currency]="store.currency()" size="sm" />
              </div>
            } @empty {
              <p class="px-4 py-6 text-center text-sm text-slate-400">
                {{ i18n.t('common.noData') }}
              </p>
            }
          </div>
        </ui-card>

        <div class="flex gap-2 pt-2">
          @if (canRename()) {
            <ui-button variant="secondary" [full]="true" (click)="rename()">{{
              i18n.t('common.rename')
            }}</ui-button>
          }
          <!-- Hidden for non-admins as a UI convenience only; AdminGuard enforces it server-side. -->
          @if (store.isAdmin()) {
            <ui-button
              variant="danger"
              [full]="true"
              [disabled]="balanceMinor() !== 0"
              (click)="remove()"
            >
              {{ i18n.t('memberDetail.remove') }}
            </ui-button>
          }
        </div>
        @if (store.isAdmin() && balanceMinor() !== 0) {
          <p class="text-center text-xs text-slate-400">
            {{ i18n.t('memberDetail.removeBlocked') }}
          </p>
        }
        @if (!store.isAdmin()) {
          <p class="text-center text-xs text-slate-400">
            {{ i18n.t('memberDetail.adminOnlyRemove') }}
          </p>
        }

        <!-- Promote / demote admin, so admin rights can be handed over if the creator leaves. -->
        @if (store.isAdmin()) {
          <div class="border-t border-slate-100 pt-3">
            @if (m.role === 'admin') {
              <ui-button
                variant="ghost"
                [full]="true"
                [loading]="changingRole()"
                (click)="setRole('member')"
              >
                {{ i18n.t('memberDetail.demote') }}
              </ui-button>
            } @else {
              <ui-button
                variant="secondary"
                [full]="true"
                [loading]="changingRole()"
                (click)="setRole('admin')"
              >
                {{ i18n.t('memberDetail.promote') }}
              </ui-button>
            }
            <p class="mt-2 text-center text-xs text-slate-400">
              {{ i18n.t('memberDetail.adminHint') }}
            </p>
          </div>
        }
      }
    </main>
  `,
})
export class MemberDetailPage {
  protected readonly i18n = inject(I18nService);

  readonly gid = input.required<string>();
  readonly mid = input.required<string>();

  protected readonly store = inject(GroupStore);
  private readonly router = inject(Router);

  protected readonly tabs = computed(() => [
    { id: 'paid', label: this.i18n.t('memberDetail.tabPaid') },
    { id: 'owed', label: this.i18n.t('memberDetail.tabOwed') },
    { id: 'payments', label: this.i18n.t('memberDetail.tabPayments') },
  ]);
  protected readonly activeTab = signal('paid');
  protected readonly changingRole = signal(false);

  constructor() {
    effect(() => {
      void this.store.ensureLoaded(this.gid());
    });
  }

  protected readonly member = computed(() => this.store.memberById().get(this.mid()));

  protected readonly stats = computed(
    () =>
      this.store.balances().find((b) => b.memberId === this.mid()) ?? {
        memberId: this.mid(), paidMinor: 0, owedMinor: 0,
        sentMinor: 0, receivedMinor: 0, balanceMinor: 0,
      },
  );

  protected readonly balanceMinor = computed(() => this.stats().balanceMinor);

  /**
   * Signed terms that sum to the balance:
   *   balance = paid − share + sent − received
   * Sending money repays debt and so raises the balance; receiving lowers it.
   * Zero lines are omitted; this doesn't affect the sum.
   */
  protected readonly breakdown = computed(() => {
    const s = this.stats();
    return [
      { key: 'paid', label: this.i18n.t('memberDetail.paidForGroup'), minor: s.paidMinor },
      { key: 'share', label: this.i18n.t('memberDetail.ownShare'), minor: -s.owedMinor },
      { key: 'sent', label: this.i18n.t('memberDetail.transferredOut'), minor: s.sentMinor },
      { key: 'received', label: this.i18n.t('memberDetail.receivedIn'), minor: -s.receivedMinor },
    ].filter((line) => line.minor !== 0);
  });

  /** Members can rename themselves; renaming others requires admin. */
  protected readonly canRename = computed(
    () => this.store.isAdmin() || this.store.currentMemberId() === this.mid(),
  );

  protected readonly balanceLabel = computed(() => {
    const value = this.balanceMinor();
    if (value > 0) return this.i18n.t('overview.willReceive');
    if (value < 0) return this.i18n.t('memberDetail.owesGroup');
    return this.i18n.t('overview.settled');
  });

  /**
   * Sum of the visible rows. On the payments tab outgoing amounts are negative, so the
   * total is net (received − sent), matching what the column shows.
   */
  protected readonly totalMinor = computed(() =>
    this.visibleRows().reduce((sum, row) => sum + row.amountMinor, 0),
  );

  protected readonly visibleRows = computed(() => {
    const id = this.mid();
    if (this.activeTab() === 'paid') {
      return this.store
        .expenses()
        .filter((e) => e.payers.some((p) => p.memberId === id))
        .map((e) => ({
          id: e.id,
          label: e.title,
          amountMinor: e.payers.find((p) => p.memberId === id)?.amountMinor ?? 0,
        }));
    }
    if (this.activeTab() === 'owed') {
      return this.store
        .expenses()
        .filter((e) => e.shares.some((s) => s.memberId === id && s.amountMinor > 0))
        .map((e) => ({
          id: e.id,
          label: e.title,
          amountMinor: e.shares.find((s) => s.memberId === id)?.amountMinor ?? 0,
        }));
    }
    return this.store
      .payments()
      .filter((p) => p.fromMemberId === id || p.toMemberId === id)
      .map((p) => ({
        id: p.id,
        label:
          p.fromMemberId === id
            ? this.i18n.t('memberDetail.transferTo', {
                name: this.store.memberById().get(p.toMemberId)?.name ?? '?',
              })
            : this.i18n.t('memberDetail.receiveFrom', {
                name: this.store.memberById().get(p.fromMemberId)?.name ?? '?',
              }),
        amountMinor: p.fromMemberId === id ? -p.amountMinor : p.amountMinor,
      }));
  });

  protected async rename(): Promise<void> {
    const current = this.member()?.name ?? '';
    const next = prompt(this.i18n.t('memberDetail.newName'), current);
    if (next && next.trim() && next.trim() !== current) {
      await this.store.renameMember(this.mid(), next.trim());
    }
  }

  protected async setRole(role: 'admin' | 'member'): Promise<void> {
    this.changingRole.set(true);
    try {
      await this.store.setMemberRole(this.mid(), role);
    } finally {
      this.changingRole.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (!confirm(this.i18n.t('memberDetail.confirmRemove', { name: this.member()?.name ?? '' }))) return;
    const ok = await this.store.removeMember(this.mid());
    if (ok) await this.router.navigate(['/g', this.gid(), 'overview']);
  }
}
