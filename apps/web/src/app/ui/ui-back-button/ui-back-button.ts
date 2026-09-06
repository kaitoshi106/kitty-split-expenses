import { ChangeDetectionStrategy, Component, input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Shared back link for page headers.
 * Uses an SVG chevron instead of the '‹' glyph, whose font metrics misalign it
 * next to the title; the 40x40 box also meets the minimum touch target.
 */
@Component({
  selector: 'ui-back-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="link()"
      class="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full
             text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      [attr.aria-label]="label() || i18n.t('common.back')"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18 9 12l6-6" />
      </svg>
    </a>
  `,
})
export class UiBackButton {
  protected readonly i18n = inject(I18nService);

  /** Router link target. */
  readonly link = input.required<string | unknown[]>();
  /** Accessible label; falls back to the translated "back" text. */
  readonly label = input('');
}
