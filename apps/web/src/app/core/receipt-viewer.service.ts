import { Injectable, signal } from '@angular/core';

/** Receipt requested for viewing. */
export interface ReceiptRequest {
  groupId: string;
  receiptId: string;
}

/**
 * @description Opens a receipt image in the single full-screen viewer mounted at the app root,
 * so any screen can show a receipt without embedding its own viewer.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptViewerService {
  /** Receipt currently shown, or null when the viewer is closed. */
  readonly request = signal<ReceiptRequest | null>(null);

  show(groupId: string, receiptId: string): void {
    this.request.set({ groupId, receiptId });
  }

  close(): void {
    this.request.set(null);
  }
}
