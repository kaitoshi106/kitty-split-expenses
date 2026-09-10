import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Member } from '@kitty/shared-types';
import { I18nService } from '../../core/i18n/i18n.service';
import { UiAmount } from '../../ui/ui-amount/ui-amount';
import { UiAvatar } from '../../ui/ui-avatar/ui-avatar';
import { UiCard } from '../../ui/ui-card/ui-card';

export interface BalanceRow {
  member: Member;
  balanceMinor: number;
}

/**
 * @description Member balance rows, shared by the overview (truncated) and the full balances page
 * so both render the same figures identically. Lives in features/ rather than ui/ because it
 * takes the domain `Member` type.
 */
@Component({
  selector: 'app-balance-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiCard, UiAvatar, UiAmount],
  template: `
    <ui-card [padded]="false">
      <div class="divide-y divide-slate-100">
        @for (row of rows(); track row.member.id) {
          <a
            [routerLink]="['/g', groupId(), 'member', row.member.id]"
            class="flex min-h-14 items-center gap-3 px-4 hover:bg-slate-50"
          >
            <ui-avatar [name]="row.member.name" [color]="row.member.avatarColor" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{ row.member.name }}
                @if (row.member.id === currentMemberId()) {
                  <span class="text-xs font-normal text-slate-400">{{ i18n.t('common.you') }}</span>
                }
              </div>
              <div class="text-xs text-slate-500">{{ label(row.balanceMinor) }}</div>
            </div>
            <ui-amount [minor]="row.balanceMinor" [currency]="currency()" [signed]="true" />
            <span class="shrink-0 text-slate-300" aria-hidden="true">›</span>
          </a>
        }
      </div>
    </ui-card>
  `,
})
export class BalanceList {
  readonly rows = input.required<BalanceRow[]>();
  readonly groupId = input.required<string | null>();
  readonly currency = input.required<string>();
  readonly currentMemberId = input<string | null>(null);

  protected readonly i18n = inject(I18nService);

  protected label(balanceMinor: number): string {
    if (balanceMinor > 0) return this.i18n.t('overview.willReceive');
    if (balanceMinor < 0) return this.i18n.t('overview.owes');
    return this.i18n.t('overview.settled');
  }
}
