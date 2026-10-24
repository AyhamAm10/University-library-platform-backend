import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { StorageConfig } from "../config/storage.config";
import { BadRequestError } from "../common/errors/http.error";

const apkDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(StorageConfig.RELEASES_ROOT)) {
      fs.mkdirSync(StorageConfig.RELEASES_ROOT, { recursive: true });
    }
    cb(null, StorageConfig.RELEASES_ROOT);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const safeExt = path.extname(file.originalname).toLowerCase() || ".apk";
    cb(null, `release-${uniqueSuffix}${safeExt}`);
  },
});

const apkUpload = multer({
  storage: apkDiskStorage,
  limits: {
    fileSize: StorageConfig.MAX_APK_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!StorageConfig.ALLOWED_APK_EXTENSIONS.includes(ext)) {
      return cb(new BadRequestError("نوع الملف غير صالح، يجب أن يكون الملف بصيغة APK (.apk)"));
    }
    cb(null, true);
  },
});

export const apkUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  apkUpload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new BadRequestError("حجم ملف التطبيق يتجاوز الحد الأقصى المسموح به (250 ميغابايت)"));
        }
        return next(new BadRequestError(`خطأ أثناء رفع ملف التطبيق: ${err.message}`));
      }
      return next(err);
    }
    next();
  });
};
