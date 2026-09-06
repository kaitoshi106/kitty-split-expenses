import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { UiAvatar } from '../ui-avatar/ui-avatar';

/** Plain shape instead of the domain `Member` type, keeping ui/ free of domain types. */
export interface PickerMember {
  id: string;
  name: string;
  color: string;
}

/**
 * @description Selectable member list supporting single or multiple selection.
 */
@Component({
  selector: 'ui-member-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiAvatar],
  template: `
    <div class="flex flex-col gap-1">
      @for (m of members(); track m.id) {
        <button
          type="button"
          class="flex min-h-11 items-center gap-3 rounded-xl px-2 text-left transition-colors
                 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-brand-500"
          [class.bg-brand-50]="isSelected(m.id)"
          [attr.aria-pressed]="isSelected(m.id)"
          (click)="toggle(m.id)"
        >
          <span
            class="grid h-5 w-5 shrink-0 place-items-center rounded border text-xs text-white"
            [class]="
              isSelected(m.id)
                ? 'border-brand-500 bg-brand-500'
                : 'border-slate-300 bg-surface'
            "
            aria-hidden="true"
          >
            {{ isSelected(m.id) ? '✓' : '' }}
          </span>
          <ui-avatar [name]="m.name" [color]="m.color" size="sm" />
          <span class="flex-1 truncate text-sm">{{ m.name }}</span>
          <ng-content />
        </button>
      }
    </div>
  `,
})
export class UiMemberPicker {
  readonly members = input.required<PickerMember[]>();
  /** Two-way list of selected member ids. */
  readonly selectedIds = model<string[]>([]);
  readonly mode = input<'single' | 'multi'>('multi');

  protected isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  protected toggle(id: string): void {
    if (this.mode() === 'single') {
      this.selectedIds.set([id]);
      return;
    }
    const current = this.selectedIds();
    this.selectedIds.set(
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }
}
