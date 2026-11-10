export const VIDEO_TYPES = {
  "video/mp4": "MP4",
  "video/quicktime": "MOV",
  "video/webm": "WebM",
} as const;

const IMAGE_BRANDS = new Set(["heic", "heix", "hevc", "mif1", "msf1", "avif", "avis"]);

export type VideoType = keyof typeof VIDEO_TYPES;

/** Detects the container from the file signature instead of trusting the browser-provided type. */
export function detectVideoType(head: Uint8Array): VideoType | null {
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return "video/webm";
  }
  if (head.length >= 12 && String.fromCharCode(...head.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (IMAGE_BRANDS.has(brand)) return null;
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  return null;
}

export function maxUploadBytes() {
  const megabytes = Number(process.env.MAX_UPLOAD_MB ?? 300);
  if (!Number.isFinite(megabytes) || megabytes <= 0) throw new Error("MAX_UPLOAD_MB must be a positive number.");
  return Math.floor(megabytes * 1024 * 1024);
}
