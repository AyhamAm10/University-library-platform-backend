export class ApiResponse<T = any> {
  constructor(
    public readonly success: boolean,
    public readonly message: string,
    public readonly data?: T,
    public readonly meta?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }
  ) {}

  static success<T = any>(
    data: T,
    message = "Success",
    options?: {
      count?: number;
      page?: number;
      limit?: number;
    }
  ) {
    const response: any = {
      success: true,
      message,
      data,
    };

    if (
      options?.count !== undefined &&
      options?.page !== undefined &&
      options?.limit !== undefined
    ) {
      response.meta = {
        total: options.count,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(options.count / options.limit) || 1,
      };
    }

    return response;
  }

  static error<M = any>(message: string, errors?: M) {
    const response: any = {
      success: false,
      message,
    };
    if (errors !== undefined) response.errors = errors;
    return response;
  }
}
