export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = 'shared' | 'cancelled' | 'unavailable';

/**
 * @description Whether the native OS share sheet (`navigator.share`) is available.
 * It covers every installed app without third-party SDKs, but exists only in a secure context.
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * @description Opens the native share sheet. Must be called directly from a user gesture,
 * with no setTimeout or prior await.
 * @param payload - Title, text and URL to share.
 * @returns 'shared', 'cancelled' when the user dismissed the sheet, or 'unavailable'.
 */
export async function share(payload: SharePayload): Promise<ShareResult> {
  if (!canShare()) return 'unavailable';
  try {
    await navigator.share(payload);
    return 'shared';
  } catch (err) {
    // Dismissing the sheet rejects with AbortError; that is a cancellation, not a failure.
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}

/** @description Builds an `sms:` link that opens the messaging app with a prefilled body. */
export function smsLink(text: string): string {
  // '?&' works on both platforms: iOS expects '&', Android expects '?'.
  return `sms:?&body=${encodeURIComponent(text)}`;
}

/** @description Builds a `mailto:` link with a prefilled subject and body. */
export function mailLink(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
