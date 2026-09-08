import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
  actionLabel?: string;
  action?: () => void;
}

/**
 * @description Transient notifications, optionally with an action button (used for undo after soft delete).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  /** Toasts currently on screen. */
  readonly toasts = signal<Toast[]>([]);

  /**
   * @description Adds a toast unless one with the same text and tone is already visible.
   * A group screen fires many parallel requests, so one network or session failure would
   * otherwise stack identical error toasts.
   * @param toast - Toast content.
   * @param timeoutMs - Auto-dismiss delay.
   */
  private push(toast: Omit<Toast, 'id'>, timeoutMs: number): void {
    const duplicate = this.toasts().some((t) => t.text === toast.text && t.tone === toast.tone);
    if (duplicate) return;

    const id = this.nextId++;
    this.toasts.update((list) => [...list, { ...toast, id }]);
    setTimeout(() => this.dismiss(id), timeoutMs);
  }

  info(text: string) { this.push({ text, tone: 'info' }, 4000); }
  error(text: string) { this.push({ text, tone: 'error' }, 6000); }
  success(text: string) { this.push({ text, tone: 'success' }, 4000); }

  /** @description Shows a toast with an action button, kept longer so the user can react. */
  undo(text: string, actionLabel: string, action: () => void): void {
    this.push({ text, tone: 'info', actionLabel, action }, 8000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
