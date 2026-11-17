import type { AcceptedMimeType } from "@briefklar/shared";

/**
 * Detects the real file type from its first bytes ("magic numbers").
 * The browser-provided MIME type and extension can be faked, the content cannot.
 */
export function detectFileType(
  buffer: Buffer,
): { mime: AcceptedMimeType; ext: ".pdf" | ".jpg" | ".png" } | null {
  if (buffer.length < 4) return null;

  // %PDF
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return { mime: "application/pdf", ext: ".pdf" };
  }
  // FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  // 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: "image/png", ext: ".png" };
  }
  return null;
}
