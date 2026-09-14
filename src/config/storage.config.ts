import path from "path";

export const StorageConfig = {
  // Base directory for physical file storage
  STORAGE_ROOT: path.resolve(process.cwd(), "storage"),

  // Maximum allowed file size in bytes (approx 15 MB)
  MAX_FILE_SIZE: 15 * 1024 * 1024,

  // Allowed MIME types
  ALLOWED_MIME_TYPES: ["application/pdf"],

  // Allowed file extensions
  ALLOWED_EXTENSIONS: [".pdf"],

  // PDF Magic Bytes (%PDF-)
  PDF_MAGIC_BYTES: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
};
