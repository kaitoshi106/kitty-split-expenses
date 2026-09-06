import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * @description Placeholder for empty lists: icon, title, optional message and projected actions.
 */
@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div class="text-4xl" aria-hidden="true">{{ icon() }}</div>
      <p class="text-sm font-medium text-slate-700">{{ title() }}</p>
      @if (message()) {
        <p class="text-xs text-slate-500">{{ message() }}</p>
      }
      <div class="mt-2"><ng-content /></div>
    </div>
  `,
})
export class UiEmptyState {
  readonly icon = input('📭');
  readonly title = input.required<string>();
  readonly message = input('');
}
