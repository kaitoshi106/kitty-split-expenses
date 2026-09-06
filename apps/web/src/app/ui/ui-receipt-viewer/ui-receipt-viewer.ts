import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect,
  inject, signal, untracked, viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ReceiptRequest, ReceiptViewerService } from '../../core/receipt-viewer.service';

/**
 * @description Full-screen receipt viewer with zoom. Mounted once in app.html, like
 * ui-toast-host; open it anywhere through `ReceiptViewerService.show()`.
 */
@Component({
  selector: 'ui-receipt-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/90"
      (close)="viewer.close()"
      (mousedown)="onBackdrop($event)"
    >
      <div class="flex h-dvh w-screen flex-col">
        <header class="flex shrink-0 items-center justify-between gap-2 px-4 py-3 text-white">
          <span class="text-sm">{{ i18n.t('receipt.alt') }}</span>
          <div class="flex items-center gap-1">
            @if (blobUrl()) {
              <button
                type="button"
                class="grid h-10 w-10 place-items-center rounded-full text-xl
                       hover:bg-white/10"
                [attr.aria-label]="i18n.t(zoomed() ? 'receipt.zoomOut' : 'receipt.zoomIn')"
                (click)="zoomed.set(!zoomed())"
              >
                {{ zoomed() ? '🔍−' : '🔍+' }}
              </button>
            }
            <button
              type="button"
              class="grid h-10 w-10 place-items-center rounded-full text-xl hover:bg-white/10"
              [attr.aria-label]="i18n.t('common.close')"
              (click)="viewer.close()"
            >
              ✕
            </button>
          </div>
        </header>

        <div
          class="flex-1 overflow-auto"
          [class.grid]="!zoomed()"
          [class.place-items-center]="!zoomed()"
        >
          @if (loading()) {
            <p class="p-8 text-center text-sm text-white/70">{{ i18n.t('common.loading') }}</p>
          } @else if (error()) {
            <p class="p-8 text-center text-sm text-white/70">{{ error() }}</p>
          } @else if (blobUrl()) {
            <img
              [src]="blobUrl()"
              [alt]="i18n.t('receipt.alt')"
              [class]="
                zoomed()
                  ? 'max-w-none'
                  : 'max-h-full max-w-full object-contain'
              "
            />
          }
        </div>
      </div>
    </dialog>
  `,
})
export class UiReceiptViewer {
  protected readonly viewer = inject(ReceiptViewerService);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Optional rather than `viewChild.required`: the effect may run before the view is
   * created, and a throw in this root-level overlay would break the whole app.
   */
  private readonly dlg = viewChild<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  private readonly url = signal<string | null>(null);
  protected readonly blobUrl = computed(() => this.url());
  protected readonly zoomed = signal(false);

  constructor() {
    effect(() => {
      const request = this.viewer.request();
      const el = this.dlg()?.nativeElement;
      if (!el) return;

      // apply() reads and writes url/loading/error; keep it untracked to avoid a loop.
      untracked(() => this.apply(el, request));
    });

    this.destroyRef.onDestroy(() => this.revoke());
  }

  /**
   * @description Opens or closes the dialog for the current request. Call inside untracked().
   * @param el - Dialog element.
   * @param request - Receipt to show, or null to close.
   */
  private apply(el: HTMLDialogElement, request: ReceiptRequest | null): void {
    if (!request) {
      if (el.open) el.close();
      document.body.style.overflow = '';
      this.revoke();
      return;
    }

    if (!el.open) el.showModal();
    document.body.style.overflow = 'hidden';
    this.zoomed.set(false);
    void this.load(request.groupId, request.receiptId);
  }

  private async load(groupId: string, receiptId: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.revoke();
    try {
      // The endpoint requires an Authorization header, which <img src> cannot send.
      const blob = await firstValueFrom(this.api.downloadReceipt(groupId, receiptId));
      this.url.set(URL.createObjectURL(blob));
    } catch {
      this.error.set(this.i18n.t('receipt.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dlg()?.nativeElement) this.viewer.close();
  }

  /**
   * @description Revokes the current object URL. Reads `url` untracked because this runs
   * inside an effect that also writes it.
   */
  private revoke(): void {
    const current = untracked(this.url);
    if (current) URL.revokeObjectURL(current);
    this.url.set(null);
  }
}
