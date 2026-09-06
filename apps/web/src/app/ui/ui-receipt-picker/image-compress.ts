/** Longest edge after downscaling; enough to read receipt text. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/**
 * @description Downscales and re-encodes an image as JPEG on the client before upload,
 * typically cutting phone photos (3–8 MB) by around 90%. Compression is best effort:
 * small files, undecodable images or larger results return the original file.
 * @param file - Picked image file.
 * @returns The compressed JPEG, or the original file.
 */
export async function compressImage(file: File): Promise<File> {
  /*
   * Do not filter by MIME type: iOS often reports an empty type, and Safari 17+
   * decodes HEIC. Let createImageBitmap decide; the catch handles undecodable files.
   */
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((done) =>
      canvas.toBlob(done, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // keep the original if not smaller

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * @description Formats a byte count as B, KB or MB.
 * @param bytes - Size in bytes.
 * @returns Human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
