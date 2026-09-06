import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * @description Toggle switch that applies immediately. Uses a `<button role="switch">`
 * rather than a checkbox so assistive tech announces on/off semantics; `label` is
 * required because the control has no visible text.
 */
@Component({
  selector: 'ui-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      class="relative h-7 w-12 shrink-0 rounded-full border transition-colors
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      [class]="checked() ? 'border-brand-500 bg-brand-500' : 'border-slate-300 bg-slate-100'"
      (click)="checked.set(!checked())"
    >
      <span
        class="absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-surface
               text-[11px] shadow-sm transition-all"
        [class]="checked() ? 'left-6' : 'left-0.5'"
        aria-hidden="true"
        >{{ checked() ? onIcon() : offIcon() }}</span
      >
    </button>
  `,
})
export class UiSwitch {
  /** Two-way on/off state. */
  readonly checked = model.required<boolean>();
  /** Accessible name. */
  readonly label = input.required<string>();
  /** Optional glyph inside the knob when on. */
  readonly onIcon = input('');
  /** Optional glyph inside the knob when off. */
  readonly offIcon = input('');
}
