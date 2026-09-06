import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input,
  model, output, signal, untracked,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { UiButton } from '../ui-button/ui-button';
import { compressImage, formatBytes } from './image-compress';

/**
 * @description Takes or picks a receipt photo, compresses it and shows a preview.
 * Uses `capture="environment"` to open the rear camera on mobile instead of a custom
 * getUserMedia camera; a separate button picks an existing photo from the library.
 */
@Component({
  selector: 'ui-receipt-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton],
  template: `
    @if (previewUrl()) {
      <div class="relative overflow-hidden rounded-xl border border-slate-200">
        <!-- The small preview only confirms an attachment; click to view it full screen. -->
        <button
          type="button"
          class="block w-full"
          [attr.aria-label]="i18n.t('receipt.view')"
          (click)="openFullscreen()"
        >
          <img
            [src]="previewUrl()"
            [alt]="i18n.t('receipt.alt')"
            class="max-h-48 w-full bg-slate-50 object-contain"
          />
        </button>
        <div
          class="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2"
        >
          <span class="truncate text-xs text-slate-500">{{ sizeLabel() }}</span>
          <button
            type="button"
            class="shrink-0 text-xs font-medium text-debit hover:underline"
            [disabled]="busy()"
            (click)="clear()"
          >
            {{ i18n.t('common.delete') }}
          </button>
        </div>
      </div>
    } @else {
      <div class="flex gap-2">
        <!-- capture="environment" opens the rear camera on mobile; ignored on desktop. -->
        <input
          #cameraInput
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          (change)="onPick($event)"
        />
        <input
          #galleryInput
          type="file"
          accept="image/*"
          class="hidden"
          (change)="onPick($event)"
        />

        <!-- Camera button only on touch devices; on desktop it would duplicate the file picker. -->
        @if (hasCamera()) {
          <ui-button
            variant="secondary"
            [full]="true"
            [loading]="busy()"
            (click)="cameraInput.click()"
          >
            📷 {{ i18n.t('receipt.takePhoto') }}
          </ui-button>
        }
        <ui-button
          variant="secondary"
          [full]="true"
          [loading]="busy()"
          (click)="galleryInput.click()"
        >
          🖼️ {{ i18n.t('receipt.chooseFile') }}
        </ui-button>
      </div>
    }

    @if (error()) {
      <p class="mt-1 text-xs text-debit">{{ error() }}</p>
    }
  `,
})
export class UiReceiptPicker {
  /** Compressed file ready to upload; null when none is picked or it was removed. */
  readonly file = model<File | null>(null);

  /** Previously uploaded receipt, as a Blob, when editing. */
  readonly existing = input<Blob | null>(null);

  /** Emits when the user removes the attachment. */
  readonly removed = output<void>();

  /** Emits when the preview is clicked; the parent opens the viewer. */
  readonly viewRequested = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Touch device detection via `(pointer: coarse)`, which, unlike viewport width, reflects the input device. */
  protected readonly hasCamera = signal(
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
  );

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private readonly objectUrl = signal<string | null>(null);
  private readonly bytes = signal(0);

  protected readonly previewUrl = computed(() => this.objectUrl());
  protected readonly sizeLabel = computed(() =>
    this.bytes() ? formatBytes(this.bytes()) : '',
  );

  constructor() {
    /**
     * The preview is derived from a single source, `file() ?? existing()`, so it clears
     * whenever both become null, regardless of who resets them. An object URL is used
     * because the receipt endpoint requires an Authorization header that <img> cannot send.
     * Writes run in untracked() since revoke() reads objectUrl; tracking it would loop.
     */
    effect(() => {
      const source: Blob | null = this.file() ?? this.existing();
      untracked(() => {
        this.revoke();
        this.objectUrl.set(source ? URL.createObjectURL(source) : null);
        this.bytes.set(source?.size ?? 0);
      });
    });

    // Object URLs hold their blob in memory until revoked.
    this.destroyRef.onDestroy(() => this.revoke());
  }

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = ''; // allow picking the same file again
    if (!picked) return;

    this.busy.set(true);
    this.error.set('');
    try {
      const compressed = await compressImage(picked);
      // The constructor effect updates the preview.
      this.file.set(compressed);
    } catch {
      this.error.set(this.i18n.t('receipt.readFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  protected openFullscreen(): void {
    this.viewRequested.emit();
  }

  protected clear(): void {
    this.file.set(null);
    // The parent drops the existing server receipt; the preview clears once both inputs are null.
    this.removed.emit();
  }

  /**
   * @description Revokes the current object URL. Reads `objectUrl` untracked because it
   * is called from an effect that also writes it; tracking the read would loop forever.
   */
  private revoke(): void {
    const url = untracked(this.objectUrl);
    if (url) URL.revokeObjectURL(url);
    this.objectUrl.set(null);
  }
}
