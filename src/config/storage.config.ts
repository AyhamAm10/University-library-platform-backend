import path from "path";
import fs from "fs";

export const StorageConfig = {
  // Base directory for physical file storage
  STORAGE_ROOT: path.resolve(__dirname, "../../storage"),
  RELEASES_ROOT: path.resolve(__dirname, "../../storage/releases"),

  // Maximum allowed file size in bytes (50 MB for PDFs, 250 MB for APKs)
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  MAX_APK_FILE_SIZE: 250 * 1024 * 1024,

  // Allowed MIME types
  ALLOWED_MIME_TYPES: ["application/pdf", "application/x-pdf", "application/acrobat"],

  // Allowed file extensions
  ALLOWED_EXTENSIONS: [".pdf"],
  ALLOWED_APK_EXTENSIONS: [".apk"],

  // PDF Magic Bytes (%PDF-)
  PDF_MAGIC_BYTES: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
};

// Ensure storage directories exist on startup
if (!fs.existsSync(StorageConfig.STORAGE_ROOT)) {
  try {
    fs.mkdirSync(StorageConfig.STORAGE_ROOT, { recursive: true });
  } catch (err) {
    console.error("[StorageConfig] Failed to ensure storage directory exists:", err);
  }
}

if (!fs.existsSync(StorageConfig.RELEASES_ROOT)) {
  try {
    fs.mkdirSync(StorageConfig.RELEASES_ROOT, { recursive: true });
  } catch (err) {
    console.error("[StorageConfig] Failed to ensure releases directory exists:", err);
  }
}

