import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, model, output, viewChild } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * @description Modal built on the native `<dialog>` element, which provides focus
 * trapping, Esc to close, a ::backdrop and an inert background via `showModal()`.
 * Renders as a bottom sheet on mobile and a centered dialog from `md` up.
 */
@Component({
  selector: 'ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      tabindex="-1"
      class="m-0 mt-auto max-h-[90dvh] w-full max-w-lg overflow-hidden rounded-t-3xl p-0
             backdrop:bg-scrim open:flex open:flex-col
             md:m-auto md:rounded-2xl"
      (close)="handleClose()"
      (mousedown)="onBackdropMouseDown($event)"
    >
      <!--
        min-h-0: flex items default to min-height: auto and would grow to their content,
        pushing header/footer out and preventing the inner overflow-y-auto from scrolling.
        flex-auto, not flex-1: the dialog has only a max-height, and WebKit resolves a
        0% flex basis to 0px height, so the dialog would render empty on Safari.
      -->
      <div class="flex min-h-0 flex-auto flex-col bg-surface">
        <!--
          shrink-0 on header and footer keeps the close and action buttons from being
          squeezed to zero height when the body content is tall.
        -->
        <header
          class="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3"
        >
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500
                   hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-brand-500"
            [attr.aria-label]="i18n.t('common.close')"
            (click)="close()"
          >
            ✕
          </button>
          <h2 class="min-w-0 flex-1 truncate text-base font-semibold">{{ title() }}</h2>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <ng-content />
        </div>

        <footer
          class="flex shrink-0 gap-2 border-t border-slate-100 px-4 py-3"
        >
          <ng-content select="[footer]" />
        </footer>
      </div>
    </dialog>
  `,
})
export class UiModal {
  protected readonly i18n = inject(I18nService);

  /** Two-way open state, e.g. `[(open)]="showExpenseModal"`. */
  readonly open = model(false);
  readonly title = input('');
  /** Emits after the dialog closes by any means. */
  readonly closed = output<void>();

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    // Sync the `open` signal with the imperative <dialog> API.
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open()) {
        if (!el.open) {
          el.showModal();
          // showModal() focuses the close button first; move focus to the dialog
          // immediately, then pick the field once rendering settles.
          el.focus();
          queueMicrotask(() => this.focusInitial(el));
        }
        // <dialog> does not lock background scrolling on its own.
        document.body.style.overflow = 'hidden';
      } else {
        if (el.open) el.close();
        document.body.style.overflow = '';
      }
    });
  }

  /**
   * @description Focuses the `[data-autofocus]` field, but only when it is empty
   * (creating rather than editing), to avoid popping the mobile keyboard for a
   * field the user did not intend to change. A data attribute is used instead of
   * `autofocus`, which angular-eslint forbids at page level.
   * Runs in a microtask because the effect fires mid change detection, before
   * prefilled values (e.g. through ui-currency-input) reach the DOM.
   * @param el - The open dialog element.
   */
  private focusInitial(el: HTMLDialogElement): void {
    if (!el.open) return; // closed before the microtask ran
    const target = el.querySelector<HTMLInputElement>('[data-autofocus]');
    if (target && !target.value?.trim()) target.focus();
  }

  close(): void {
    this.open.set(false);
  }

  /** Handles native close (Esc or `close()`) and syncs the signal back. */
  handleClose(): void {
    document.body.style.overflow = '';
    if (this.open()) this.open.set(false);
    this.closed.emit();
  }

  /**
   * @description Closes on backdrop press. The inner wrapper fills the content box, so
   * the target is the `<dialog>` itself only when the press lands outside it.
   * Keyboard users close with Esc, which `showModal()` handles natively.
   * @param event - Mousedown on the dialog.
   */
  onBackdropMouseDown(event: MouseEvent): void {
    if (event.target === this.dlg().nativeElement) this.close();
  }
}
