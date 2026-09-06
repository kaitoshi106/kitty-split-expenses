import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

const SIZE = {
  sm: 'h-7 w-7 text-xs', //  28px
  md: 'h-10 w-10 text-sm', //  40px
  lg: 'h-14 w-14 text-lg', //  56px
} as const;

/**
 * @description Circular avatar showing the first character of a name on a colored background.
 */
@Component({
  selector: 'ui-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [class]="classes()"
      [style.backgroundColor]="color()"
      [attr.title]="name()"
    >
      {{ initial() }}
    </span>
  `,
})
export class UiAvatar {
  /** Display name; also used as the tooltip. */
  readonly name = input.required<string>();

  readonly color = input('#6366f1');

  readonly size = input<keyof typeof SIZE>('md');

  /** First character of the trimmed name, or '?' when empty. */
  protected readonly initial = computed(() => {
    const trimmed = this.name().trim();
    if (!trimmed) return '?';

    // Array.from splits by code point; indexing would cut surrogate pairs (emoji) in half.
    return Array.from(trimmed)[0].toUpperCase();
  });

  protected readonly classes = computed(() =>
    [
      // shrink-0 keeps the circle intact next to long text in a flex row.
      'inline-flex shrink-0 select-none items-center justify-center',
      'rounded-full font-semibold text-white',
      SIZE[this.size()],
    ].join(' '),
  );
}
