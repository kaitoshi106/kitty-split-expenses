import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * @description List row with four content slots selected by attribute:
 * leading, title, subtitle and trailing.
 *
 *   <ui-list-item>
 *     <ui-avatar leading ... />
 *     <span title>Emma</span>
 *     <ui-amount trailing ... />
 *   </ui-list-item>
 */
@Component({
  selector: 'ui-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex w-full items-center gap-3 py-2" [class.min-h-11]="true">
      <ng-content select="[leading]" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-slate-900">
          <ng-content select="[title]" />
        </div>
        <div class="truncate text-xs text-slate-500">
          <ng-content select="[subtitle]" />
        </div>
      </div>
      <div class="shrink-0 text-right">
        <ng-content select="[trailing]" />
      </div>
      @if (chevron()) {
        <span class="shrink-0 text-slate-300" aria-hidden="true">›</span>
      }
    </div>
  `,
})
export class UiListItem {
  readonly chevron = input(false);
}
