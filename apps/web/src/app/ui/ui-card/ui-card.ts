import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * @description Surface container with optional padding and a clickable hover state.
 */
@Component({
  selector: 'ui-card',

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div [class]="classes()">
      <ng-content />
    </div>
  `,
})
export class UiCard {
  /** Applies the default inner padding. */
  readonly padded = input(true);
  /** Adds pointer cursor and hover/press feedback. */
  readonly clickable = input(false);

  protected readonly classes = computed(() =>
    [
      // No max width: the parent layout decides the card width.
      'w-full rounded-2xl bg-surface shadow-sm',
      this.padded() ? 'p-4' : '',
      this.clickable()
        ? 'cursor-pointer transition hover:shadow-md active:scale-[0.995]'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
