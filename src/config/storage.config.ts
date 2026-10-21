import path from "path";
import fs from "fs";

export const StorageConfig = {
  // Base directory for physical file storage
  STORAGE_ROOT: path.resolve(__dirname, "../../storage"),

  // Maximum allowed file size in bytes (approx 15 MB)
  MAX_FILE_SIZE: 15 * 1024 * 1024,

  // Allowed MIME types
  ALLOWED_MIME_TYPES: ["application/pdf", "application/x-pdf", "application/acrobat"],

  // Allowed file extensions
  ALLOWED_EXTENSIONS: [".pdf"],

  // PDF Magic Bytes (%PDF-)
  PDF_MAGIC_BYTES: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
};

// Ensure storage directory exists on startup
if (!fs.existsSync(StorageConfig.STORAGE_ROOT)) {
  try {
    fs.mkdirSync(StorageConfig.STORAGE_ROOT, { recursive: true });
  } catch (err) {
    console.error("[StorageConfig] Failed to ensure storage directory exists:", err);
  }
}

