import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface SegmentTab {
  id: string;
  label: string;
}

/**
 * @description Segmented control that switches between tabs by id.
 */
@Component({
  selector: 'ui-segmented-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- tablist/tab roles with aria-selected expose this as tabs to assistive tech -->
    <div class="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="active() === tab.id"
          class="min-h-9 flex-1 rounded-lg px-3 text-sm font-medium transition-colors
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          [class]="
            active() === tab.id
              ? 'bg-surface text-brand-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          "
          (click)="active.set(tab.id)"
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class UiSegmentedTabs {
  readonly tabs = input.required<SegmentTab[]>();
  /** Two-way id of the active tab. */
  readonly active = model.required<string>();
}
