/**
 * Shrinks product photos in the browser before upload. Phone pictures are
 * often 4000×3000 and several MB; customers would download them at full size
 * on every menu visit. Images are scaled so the longest side is at most
 * MAX_IMAGE_EDGE px and re-encoded as WebP (JPEG where the browser cannot
 * encode WebP). Re-encoding also drops camera metadata such as GPS location.
 */

export const MAX_IMAGE_EDGE = 1600;
const WEBP_QUALITY = 0.82;
// Small images that already fit are uploaded untouched.
const REENCODE_MIN_BYTES = 400 * 1024;

/** Scales (width, height) to fit within maxEdge, keeping the aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns a resized/re-encoded copy of `file`, or `file` itself when it is
 * not a raster image, already small, or the browser cannot process it.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // let the server report an unreadable image
  }

  try {
    const target = fitWithin(bitmap.width, bitmap.height);
    const needsResize =
      target.width !== bitmap.width || target.height !== bitmap.height;
    if (!needsResize && file.size < REENCODE_MIN_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
    // Browsers without WebP encoding return PNG; prefer JPEG unless the
    // image needs transparency (then keep the original).
    if (!blob || blob.type !== "image/webp") {
      if (file.type === "image/png") return file;
      blob = await toBlob(canvas, "image/jpeg", WEBP_QUALITY);
    }
    if (!blob || blob.size >= file.size) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}
