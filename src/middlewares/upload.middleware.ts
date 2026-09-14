import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { StorageConfig } from "../config/storage.config";
import { BadRequestError } from "../common/errors/http.error";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: StorageConfig.MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isPdfExt = StorageConfig.ALLOWED_EXTENSIONS.includes(ext);
    const isPdfMime = StorageConfig.ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase());

    if (!isPdfExt || !isPdfMime) {
      return cb(new BadRequestError("نوع الملف غير صالح، يُسمح فقط برفع ملفات بصيغة PDF"));
    }

    cb(null, true);
  },
});

/**
 * Middleware for single PDF upload with clean error handling for file size and format.
 */
export const pdfUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new BadRequestError("حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت)"));
        }
        return next(new BadRequestError(`خطأ أثناء رفع الملف: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};
