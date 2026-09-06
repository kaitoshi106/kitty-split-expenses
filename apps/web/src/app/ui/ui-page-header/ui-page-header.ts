import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiBackButton } from '../ui-back-button/ui-back-button';

/**
 * @description Sticky header for sub-pages: back button plus title, so navigation
 * stays reachable on long pages. It needs an opaque background because content
 * scrolls beneath it, and sits at z-20, below the FAB backdrop (z-30), so the
 * backdrop dims it along with the rest of the page.
 */
@Component({
  selector: 'ui-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiBackButton],
  template: `
    <header class="sticky top-0 z-20 flex items-center gap-3 bg-surface py-3">
      <ui-back-button [link]="backLink()" />
      <h1 class="min-w-0 flex-1 truncate text-lg font-semibold">{{ title() }}</h1>
    </header>
  `,
  host: {
    /**
     * display: contents removes the host box so the header becomes a direct child of
     * the page container. Sticky only works within its parent; an inline host exactly
     * as tall as the header would leave it no room to stick.
     */
    class: 'contents',
  },
})
export class UiPageHeader {
  /** Router link commands, e.g. ['/g', gid, 'overview']. */
  readonly backLink = input.required<unknown[]>();
  readonly title = input.required<string>();
}
