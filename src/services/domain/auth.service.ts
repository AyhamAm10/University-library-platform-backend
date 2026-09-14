import { RepoService } from "../repo.service";
import { User } from "@prisma/client";
import { Ensure } from "../../common/errors/Ensure.handler";
import { UnauthorizedError } from "../../common/errors/http.error";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Environment } from "../../config/environment";
import { LoginDto } from "../../dto/auth.dto";
import { TimePeriodService } from "./time-period.service";

export class AuthService extends RepoService<User> {
  constructor() {
    super("user", "user");
  }

  async findByPhone(phone: string): Promise<User | null> {
    return await this.findOne({ phone: phone.trim() });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.findOne({ email: email.toLowerCase().trim() });
  }

  async createUser(data: any): Promise<User> {
    return await this.create(data);
  }

  async login(dto: LoginDto) {
    const identifier = (dto.phone || dto.email || "").trim();
    const user = await this.findOne(
      {
        OR: [
          { phone: identifier },
          { email: identifier.toLowerCase() },
        ],
      },
      { include: { library: true } }
    );

    Ensure.exists(user, "user", "بيانات تسجيل الدخول أو كلمة المرور غير صحيحة");

    const isPasswordValid = await bcrypt.compare(dto.password, user!.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("بيانات تسجيل الدخول أو كلمة المرور غير صحيحة");
    }

    if (!user!.isActive) {
      throw new UnauthorizedError("تم تعطيل هذا الحساب، يرجى مراجعة إدارة المنصة");
    }

    // Resolve active period if library admin via TimePeriodService
    let activeTimePeriod = null;
    if (user!.libraryId) {
      const periodService = new TimePeriodService({ libraryId: user!.libraryId });
      activeTimePeriod = await periodService.getCurrentActivePeriod();
    }

    const accessToken = jwt.sign(
      {
        userId: user!.id,
        role: user!.role,
        libraryId: user!.libraryId,
      },
      Environment.JWT_ACCESS_SECRET,
      { expiresIn: "8h" }
    );

    const refreshToken = jwt.sign(
      { userId: user!.id },
      Environment.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    const safeUser = {
      id: user!.id,
      phone: user!.phone,
      email: user!.email,
      fullName: user!.fullName,
      role: user!.role,
      libraryId: user!.libraryId,
      library: (user as any).library,
      activeTimePeriod,
    };

    return {
      user: safeUser,
      accessToken,
      refreshToken,
    };
  }

  async getMe(userId: string) {
    const user = await this.getById(userId, {
      include: {
        library: true,
      },
    });

    Ensure.exists(user, "user");

    let activeTimePeriod = null;
    if (user!.libraryId) {
      const periodService = new TimePeriodService({ libraryId: user!.libraryId });
      activeTimePeriod = await periodService.getCurrentActivePeriod();
    }

    return {
      id: user!.id,
      phone: user!.phone,
      email: user!.email,
      fullName: user!.fullName,
      role: user!.role,
      libraryId: user!.libraryId,
      library: (user as any).library,
      activeTimePeriod,
    };
  }
}
