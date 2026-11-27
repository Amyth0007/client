/** Accept attribute for every image picker: any image, plus explicit camera formats some browsers don't map to image/*. */
export const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.heic,.heif,.avif,.tif,.tiff";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

const GENERIC_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream", "application/unknown"]);

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

/** True for any photo/image. Camera captures sometimes arrive with an empty MIME type, so the extension is checked too. */
export function isImageFile(file: File) {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return GENERIC_TYPES.has(type) && extensionOf(file.name) in IMAGE_EXTENSION_MIME;
}

const MAX_DIMENSION = 2560;
const COMPRESS_ABOVE_BYTES = 2 * 1024 * 1024;

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall back to <img>, which decodes HEIC on Safari and some formats createImageBitmap rejects.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode failed"));
      element.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/**
 * Makes a photo safe to upload: fixes a missing MIME type, converts formats browsers can't preview (HEIC/TIFF)
 * and shrinks large camera photos to a JPEG under the upload limit. Returns the original file if it can't be decoded.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase();
  const inferredType = type.startsWith("image/") ? type : IMAGE_EXTENSION_MIME[extensionOf(file.name)] ?? "image/jpeg";
  const needsConversion = !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(inferredType);
  const needsShrink = file.size > COMPRESS_ABOVE_BYTES;

  if (!needsConversion && !needsShrink) {
    return type === inferredType ? file : new File([file], file.name, { type: inferredType, lastModified: file.lastModified });
  }
  if (inferredType === "image/gif" && !needsShrink) return file;

  try {
    const decoded = await decodeImage(file);
    try {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      let blob: Blob | null = null;
      for (const quality of [0.85, 0.7, 0.55]) {
        blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
      }
      if (!blob) throw new Error("encode failed");
      const baseName = file.name.replace(/\.[^.]+$/, "") || `photo-${Date.now()}`;
      return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      decoded.release();
    }
  } catch {
    // The browser can't decode this format (e.g. HEIC on Chrome); send the original and let the server store it.
    return type === inferredType ? file : new File([file], file.name, { type: inferredType, lastModified: file.lastModified });
  }
}
