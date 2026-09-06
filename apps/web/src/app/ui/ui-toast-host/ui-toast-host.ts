import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { ToastService } from '../../core/toast.service';

/**
 * @description Renders ToastService toasts; mounted once in app.html.
 * Modals opened with `showModal()` live in the browser top layer, above any z-index,
 * so the tray uses `popover` to enter the top layer too. Later entries stack on top,
 * so it is re-shown for each new toast to appear above an already open modal.
 */
@Component({
  selector: 'ui-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /*
      Reset the UA [popover] styles (border, background, padding, centered inset) so the
      element is a transparent tray. Positioning lives here rather than in Tailwind
      classes: both selectors have equal specificity, so mixing them depends on
      stylesheet order and can leave the UA top: 0 in place.
    */
    [popover] {
      position: fixed;
      /* top right bottom left; 6rem matches bottom-24 */
      inset: auto 0 6rem 0;
      margin: 0;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      border: 0;
      padding: 0;
      background: transparent;
      overflow: visible;
    }
  `,
  template: `
    <div
      #host
      popover="manual"
      class="pointer-events-none flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3
                 text-sm shadow-lg"
          [class]="
            t.tone === 'error'
              ? 'bg-debit text-white'
              : t.tone === 'success'
                ? 'bg-credit text-white'
                : 'bg-slate-900 text-slate-50'
          "
        >
          <span class="flex-1">{{ t.text }}</span>
          @if (t.actionLabel) {
            <button
              type="button"
              class="shrink-0 font-semibold underline underline-offset-2"
              (click)="run(t.id, t.action)"
            >
              {{ t.actionLabel }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class UiToastHost {
  protected readonly toast = inject(ToastService);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  constructor() {
    effect(() => {
      const hasToast = this.toast.toasts().length > 0;
      const el = this.host().nativeElement;
      // DOM calls only; keep them out of the effect's dependencies.
      untracked(() => this.promote(el, hasToast));
    });
  }

  /**
   * @description Moves the tray to the top of the top layer, or removes it when empty.
   * Hiding first is required: re-showing an open popover does not change its order.
   * @param el - Popover tray element.
   * @param hasToast - Whether any toast is visible.
   */
  private promote(el: HTMLElement, hasToast: boolean): void {
    // Without popover support toasts still render, just beneath open modals.
    if (typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (hasToast) el.showPopover();
    } catch {
      // showPopover throws if the element is not connected; the next toast retries.
    }
  }

  protected run(id: number, action?: () => void): void {
    action?.();
    this.toast.dismiss(id);
  }
}
