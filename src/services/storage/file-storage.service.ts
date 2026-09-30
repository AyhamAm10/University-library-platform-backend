import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Response } from "express";
import { StorageConfig } from "../../config/storage.config";
import { BadRequestError, NotFoundError, ForbiddenError } from "../../common/errors/http.error";

export class FileStorageService {
  /**
   * Verify PDF magic bytes to ensure file is genuinely a PDF.
   */
  static validatePdfMagicBytes(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 5) return false;
    return buffer.subarray(0, 5).equals(StorageConfig.PDF_MAGIC_BYTES);
  }

  /**
   * Derives a safe subject folder name using sanitized subject name and subjectId.
   */
  static getSubjectFolder(subjectName: string, subjectId: string): string {
    const cleanName = (subjectName || "subject")
      .trim()
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 40);
    const cleanId = subjectId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12);
    return `${cleanName}_${cleanId}`;
  }

  /**
   * Saves a validated PDF file buffer into the subject's folder.
   */
  static async savePdfFile(
    subjectFolder: string,
    buffer: Buffer
  ): Promise<{ storageKey: string; size: number }> {
    if (!this.validatePdfMagicBytes(buffer)) {
      throw new BadRequestError("الملف المرفوع تالف أو ليس مستند PDF حقيقي");
    }

    const folderPath = path.resolve(StorageConfig.STORAGE_ROOT, subjectFolder);

    // Prevent directory traversal
    if (!folderPath.startsWith(StorageConfig.STORAGE_ROOT)) {
      throw new ForbiddenError("مسار التخزين غير صالح");
    }

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileName = `${randomUUID()}.pdf`;
    const fullPath = path.join(folderPath, fileName);

    await fs.promises.writeFile(fullPath, buffer);

    const relativeKey = `${subjectFolder}/${fileName}`;
    return {
      storageKey: relativeKey,
      size: buffer.length,
    };
  }

  /**
   * Deletes a physical file from the storage directory.
   */
  static async deletePhysicalFile(storageKey: string): Promise<void> {
    if (!storageKey) return;

    const fullPath = path.resolve(StorageConfig.STORAGE_ROOT, storageKey);

    // Guard against directory traversal
    if (!fullPath.startsWith(StorageConfig.STORAGE_ROOT)) {
      throw new ForbiddenError("مسار الحذف غير مصرح به");
    }

    try {
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch (err) {
      console.error(`[FileStorageService] Failed to delete file at ${fullPath}:`, err);
    }
  }

  /**
   * Streams a file to an HTTP response supporting Range requests (HTTP 206).
   */
  static streamFile(
    res: Response,
    storageKey: string,
    rangeHeader?: string,
    originalName?: string
  ): void {
    const fullPath = path.resolve(StorageConfig.STORAGE_ROOT, storageKey);

    // Guard against directory traversal
    if (!fullPath.startsWith(StorageConfig.STORAGE_ROOT)) {
      throw new ForbiddenError("مسار الوصول للملف غير صالح");
    }

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError("الملف المطلوب غير موجود على الخادم");
    }

    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const safeFilename = encodeURIComponent(originalName || "document.pdf");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);

      const stream = fs.createReadStream(fullPath, { start, end });
      stream.on("error", (err) => {
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    } else {
      res.status(200);
      res.setHeader("Content-Length", fileSize);

      const stream = fs.createReadStream(fullPath);
      stream.on("error", (err) => {
        if (!res.headersSent) res.status(500).end();
      });
      stream.pipe(res);
    }
  }
}
