import { Injectable, signal } from '@angular/core';
import type { Expense } from '@kitty/shared-types';

/**
 * @description Lets child tab routes ask the group shell to open the expense edit modal.
 * The modal lives in `group-shell`, which child routes inside `<router-outlet>` cannot call directly;
 * the shell reacts to `pending` with an effect.
 */
@Injectable({ providedIn: 'root' })
export class ExpenseEditorService {
  /** Expense awaiting edit, or null when there is no request. */
  readonly pending = signal<Expense | null>(null);

  requestEdit(expense: Expense): void {
    this.pending.set(expense);
  }

  /** Called by the shell after opening the modal so the next request fires again. */
  consume(): void {
    this.pending.set(null);
  }
}
