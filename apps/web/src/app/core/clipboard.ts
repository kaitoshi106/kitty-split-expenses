/**
 * @description Copies text to the clipboard, including outside a secure context.
 * `navigator.clipboard` is unavailable over plain http (e.g. LAN testing on a phone), so this
 * falls back to the deprecated but still supported `execCommand('copy')`.
 * @param text - Text to copy.
 * @returns Whether the copy succeeded; callers show manual-copy instructions on false.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or the document is not focused; try the legacy path.
    }
  }

  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document.execCommand !== 'function') return false;

  const area = document.createElement('textarea');
  area.value = text;
  // Must be in the document and not display:none to be selectable, without shifting layout.
  // readonly keeps the mobile keyboard from opening.
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';

  /*
   * Attach to the topmost open modal dialog rather than document.body.
   * showModal() makes everything outside the dialog inert, so a textarea in body
   * can be selected but never focused, and execCommand('copy') copies nothing.
   */
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const host: HTMLElement = dialogs.length > 0 ? dialogs[dialogs.length - 1] : document.body;
  host.appendChild(area);

  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    // Restore the user's previous selection.
    if (previous && selection) {
      selection.removeAllRanges();
      selection.addRange(previous);
    }
  }
}
