export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  USER_BLOCKED = 423,
  INTERNAL_SERVER = 500,
}

export class APIError extends Error {
  public readonly name: string;
  public readonly httpCode: HttpStatusCode;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly description?: string;

  constructor(
    httpCode: HttpStatusCode,
    message: string,
    code: string = "API_ERROR",
    description?: string,
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "APIError";
    this.httpCode = httpCode;
    this.code = code;
    this.description = description;
    this.isOperational = isOperational;
    Error.captureStackTrace(this);
  }
}
