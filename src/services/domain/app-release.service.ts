import fs from "fs";
import path from "path";
import { AppRelease } from "@prisma/client";
import { RepoService } from "../repo.service";
import { StorageConfig } from "../../config/storage.config";
import { CreateAppReleaseDto } from "../../dto/app-release.dto";
import { Ensure } from "../../common/errors/Ensure.handler";
import { NotFoundError, BadRequestError } from "../../common/errors/http.error";
import { prisma } from "../../config/prisma";

export class AppReleaseService extends RepoService<AppRelease> {
  constructor() {
    super("appRelease", "appRelease");
  }

  /**
   * Helper to format BigInt fileSize for JSON serialization
   */
  private formatRelease(release: any) {
    if (!release) return null;
    return {
      ...release,
      fileSize: typeof release.fileSize === "bigint" ? Number(release.fileSize) : release.fileSize,
    };
  }

  /**
   * Publish a new APK release.
   * Marks older releases as inactive and physically deletes their APK files from disk to save storage.
   */
  async publishRelease(dto: CreateAppReleaseDto, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestError("ملف تطبيق الأندرويد (.apk) مطلوب لرفع إصدار جديد");
    }

    // 1. Check if version or versionCode already exists
    const existing = await this.findOneByCondition({
      OR: [{ version: dto.version }, { versionCode: dto.versionCode }],
    });

    if (existing) {
      // If upload failed, clean up uploaded file immediately
      if (fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      throw new BadRequestError(
        existing.version === dto.version
          ? `رقم الإصدار (${dto.version}) موجود مسبقاً، يرجى تحديد رقم إصدار تزايدي جديد`
          : `كود الإصدار الرقمي (${dto.versionCode}) مستخدم مسبقاً`
      );
    }

    // 2. Fetch existing active releases to delete their physical APK files
    const activeReleases = await this.findManyByCondition({ isActive: true });

    for (const old of activeReleases) {
      const oldFilePath = path.join(StorageConfig.RELEASES_ROOT, old.fileName);
      if (fs.existsSync(oldFilePath)) {
        try {
          await fs.promises.unlink(oldFilePath);
        } catch (err) {
          console.error(`[AppReleaseService] Failed to delete old release APK ${oldFilePath}:`, err);
        }
      }
    }

    // 3. Mark all previous releases as inactive
    await prisma.appRelease.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // 4. Create the new active release
    const newRelease = await this.create({
      version: dto.version,
      versionCode: dto.versionCode,
      releaseNotes: dto.releaseNotes || null,
      fileName: file.filename,
      storageKey: `releases/${file.filename}`,
      fileSize: BigInt(file.size),
      mimeType: file.mimetype || "application/vnd.android.package-archive",
      isActive: true,
      downloadCount: 0,
    });

    return this.formatRelease(newRelease);
  }

  /**
   * Get the current active release for the platform
   */
  async getActiveRelease() {
    const active = await prisma.appRelease.findFirst({
      where: { isActive: true },
      orderBy: { versionCode: "desc" },
    });

    return this.formatRelease(active);
  }

  /**
   * Check if a client app needs an update
   */
  async checkVersion(clientVersion?: string | null, clientVersionCode?: number | null) {
    const active = await this.getActiveRelease();

    if (!active) {
      return {
        hasUpdate: false,
        message: "لا توجد إصدارات منشورة حالياً",
      };
    }

    let hasUpdate = false;

    if (typeof clientVersionCode === "number" && !isNaN(clientVersionCode)) {
      hasUpdate = clientVersionCode < active.versionCode;
    } else if (clientVersion) {
      hasUpdate = clientVersion !== active.version;
    } else {
      // If client didn't supply any version, advise update
      hasUpdate = true;
    }

    if (!hasUpdate) {
      return {
        hasUpdate: false,
        currentActiveVersion: active.version,
        currentActiveVersionCode: active.versionCode,
      };
    }

    return {
      hasUpdate: true,
      isMandatory: true, // Non-dismissible mandatory update
      currentActiveVersion: active.version,
      currentActiveVersionCode: active.versionCode,
      releaseNotes: active.releaseNotes,
      downloadUrl: "/api/app-releases/download",
      fileSize: active.fileSize,
      publishedAt: active.createdAt,
    };
  }

  /**
   * Get file information to stream APK download to mobile app
   */
  async getDownloadStream() {
    const active = await prisma.appRelease.findFirst({
      where: { isActive: true },
      orderBy: { versionCode: "desc" },
    });

    Ensure.exists(active, "appRelease", "لا يوجد إصدار نشط متاح للتحميل حالياً");

    const physicalPath = path.join(StorageConfig.RELEASES_ROOT, active.fileName);
    if (!fs.existsSync(physicalPath)) {
      throw new NotFoundError("ملف تطبيق الـ APK غير موجود على السيرفر");
    }

    // Increment download counter asynchronously
    prisma.appRelease
      .update({
        where: { id: active.id },
        data: { downloadCount: { increment: 1 } },
      })
      .catch((err: any) => console.error("[AppReleaseService] Failed to increment download count:", err));

    return {
      physicalPath,
      fileName: active.fileName,
      originalDownloadName: `app-release-v${active.version}.apk`,
      fileSize: Number(active.fileSize),
      mimeType: active.mimeType,
    };
  }

  /**
   * Get all releases history (for Super Admin dashboard)
   */
  async getReleasesHistory() {
    const releases = await prisma.appRelease.findMany({
      orderBy: { createdAt: "desc" },
    });

    return releases.map((r: any) => this.formatRelease(r));
  }
}
