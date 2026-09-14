import { ErrorMessages, Language } from "./ErrorMessages";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./http.error";

export class Ensure {
  private static lang: Language = "ar";

  static setLanguage(lang: Language) {
    this.lang = lang;
  }

  static exists(value: any, entity: string, customMessage?: string) {
    if (!value) {
      throw new NotFoundError(
        customMessage || ErrorMessages.generateErrorMessage(entity, "not found", this.lang)
      );
    }
  }

  static required(value: any, entity: string) {
    if (value === undefined || value === null || value === "") {
      throw new BadRequestError(
        ErrorMessages.generateErrorMessage(entity, "required", this.lang)
      );
    }
  }

  static min(value: string | number, min: number, entity: string) {
    if (
      (typeof value === "string" && value.length < min) ||
      (typeof value === "number" && value < min)
    ) {
      throw new BadRequestError(
        ErrorMessages.generateErrorMessage(entity, "min", this.lang)
      );
    }
  }

  static unauthorized(condition: boolean, entity: string = "user") {
    if (!condition) {
      throw new UnauthorizedError(
        ErrorMessages.generateErrorMessage(entity, "unauthorized", this.lang)
      );
    }
  }

  static isNumber(value: any, entity: string) {
    if (typeof value !== "number" || isNaN(value)) {
      throw new BadRequestError(
        ErrorMessages.generateErrorMessage(entity, "bad request", this.lang)
      );
    }
  }

  static forbidden(condition: boolean, entity: string = "resource") {
    if (!condition) {
      throw new ForbiddenError(
        ErrorMessages.generateErrorMessage(entity, "forbidden", this.lang)
      );
    }
  }

  static custom(condition: boolean, message: string) {
    if (!condition) {
      throw new BadRequestError(message);
    }
  }

  static alreadyExists(condition: boolean, entity: string) {
    if (condition) {
      throw new BadRequestError(
        ErrorMessages.generateErrorMessage(entity, "already exists", this.lang)
      );
    }
  }

  static isArray(value: any, entity: string) {
    if (!Array.isArray(value)) {
      throw new BadRequestError(
        ErrorMessages.generateErrorMessage(entity, "invalid", this.lang)
      );
    }
  }
}
