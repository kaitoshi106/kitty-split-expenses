import type { HttpResponse } from '@angular/common/http';

/**
 * @description Saves a binary HTTP response as a file download.
 * A plain `<a download>` link cannot be used because the endpoint requires an
 * Authorization header, so the blob is fetched via HttpClient and saved through an object URL.
 * @param response - Blob response, optionally carrying Content-Disposition.
 * @param fallbackName - File name used when the server sends none.
 */
export function saveBlobResponse(response: HttpResponse<Blob>, fallbackName: string): void {
  const blob = response.body;
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(response) ?? fallbackName;

  // Firefox only honors a programmatic click() on an attached element.
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately cancels the download in Safari; defer it briefly.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * @description Extracts the file name from Content-Disposition, preferring the UTF-8
 * `filename*` form over the ASCII `filename` fallback.
 * @returns The file name, or null when the header is missing.
 */
function filenameFrom(response: HttpResponse<Blob>): string | null {
  const header = response.headers.get('Content-Disposition');
  if (!header) return null;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // Malformed percent-encoding; fall back to the ASCII name.
    }
  }

  const ascii = /filename="([^"]+)"/i.exec(header);
  return ascii ? ascii[1] : null;
}
