import {
  ChangeDetectionStrategy, Component, DestroyRef, NgZone, inject, signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Scroll-to-top button, mounted once in app.html.
 * A fixed wrapper matching the centered app frame anchors the button to the content's
 * right edge rather than the viewport's; it ignores pointer events so it does not
 * swallow clicks. The button stays in flow (flex, not absolute) so `bottom-24` marks
 * its bottom edge and it clears the FAB below.
 */
@Component({
  selector: 'ui-scroll-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="pointer-events-none fixed bottom-24 left-1/2 z-30 flex w-full max-w-[480px]
               -translate-x-1/2 justify-end pr-5 md:max-w-3xl"
      >
        <button
          type="button"
          class="pointer-events-auto grid h-11 w-11 place-items-center
                 rounded-full border border-slate-200 bg-surface text-slate-600 shadow-lg
                 transition hover:bg-slate-50 focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-brand-500"
          [attr.aria-label]="i18n.t('common.scrollTop')"
          (click)="toTop()"
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
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      </div>
    }
  `,
})
export class UiScrollTop {
  protected readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visible = signal(false);

  /**
   * Visibility threshold relative to each page's scroll range, since a fixed pixel value
   * cannot suit pages of different lengths: clamp(40% of max scroll, 80px, 400px).
   * Pages that cannot scroll never show the button.
   */
  private readonly MIN = 80;
  private readonly MAX = 400;
  private readonly RATIO = 0.4;

  constructor() {
    const evaluate = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (maxScroll <= 0) {
        this.visible.set(false);
        return;
      }
      const threshold = Math.min(this.MAX, Math.max(this.MIN, maxScroll * this.RATIO));
      this.visible.set(window.scrollY > threshold);
    };
    const onScroll = evaluate;

    /**
     * Listen outside the Angular zone so frequent scroll events do not trigger app-wide
     * change detection; the signal write schedules the update on its own.
     */
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', evaluate, { passive: true });
    });

    /**
     * Re-evaluate when the document height changes (navigation, data loading) without a
     * scroll event. ResizeObserver keeps this ui/ component independent of the router.
     */
    const observer = new ResizeObserver(() => evaluate());
    observer.observe(document.documentElement);

    evaluate();

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', evaluate);
      observer.disconnect();
    });
  }

  protected toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
