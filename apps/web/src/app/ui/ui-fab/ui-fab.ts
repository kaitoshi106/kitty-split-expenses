import { ChangeDetectionStrategy, Component, input, output, signal, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

export interface FabAction {
  id: string;
  label: string;
  icon: string;
  /** One-line explanation shown under the label. */
  description?: string;
}

/**
 * @description Floating action button that expands into a list of actions.
 * Fixed to the viewport on mobile; positioned within the content frame from `md` up.
 */
@Component({
  selector: 'ui-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (openState()) {
      <!-- Backdrop: clicking outside closes the menu -->
      <button
        type="button"
        class="fixed inset-0 z-30 cursor-default bg-scrim transition-opacity"
        [attr.aria-label]="i18n.t('shell.closeMenu')"
        (click)="openState.set(false)"
      ></button>
    }

    <div class="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 md:absolute">
      @if (openState()) {
        <div class="flex flex-col items-end gap-2">
          @for (action of actions(); track action.id) {
            <!-- Optional description helps distinguish similar actions (expense vs. transfer). -->
            <button
              type="button"
              class="flex min-h-11 w-64 items-start gap-3 rounded-2xl bg-surface px-4 py-3
                     text-left shadow-lg transition hover:bg-slate-50
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-brand-500"
              (click)="pick(action.id)"
            >
              <span class="mt-0.5 shrink-0 text-lg" aria-hidden="true">{{ action.icon }}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-slate-900">{{ action.label }}</span>
                @if (action.description) {
                  <span class="block text-xs leading-snug text-slate-500">
                    {{ action.description }}
                  </span>
                }
              </span>
            </button>
          }
        </div>
      }

      <button
        type="button"
        class="grid h-14 w-14 place-items-center rounded-full bg-brand-500
               text-white shadow-lg transition hover:bg-brand-600
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
               focus-visible:ring-offset-2"
        [attr.aria-expanded]="openState()"
        [attr.aria-label]="i18n.t(openState() ? 'shell.closeMenu' : 'shell.openMenu')"
        (click)="openState.set(!openState())"
      >
        <!--
          SVG instead of a '+' glyph, which sits on the font baseline and looks off-center.
          Rotating it 45 degrees turns it into a close icon with a smooth transition.
        -->
        <svg
          class="h-6 w-6 transition-transform duration-200"
          [class.rotate-45]="openState()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  `,
})
export class UiFab {
  protected readonly i18n = inject(I18nService);

  readonly actions = input.required<FabAction[]>();
  /** Emits the id of the chosen action. */
  readonly actionSelected = output<string>();

  protected readonly openState = signal(false);

  protected pick(id: string): void {
    this.openState.set(false);
    this.actionSelected.emit(id);
  }
}
