import { Ensure } from "../common/errors/Ensure.handler";
import { prisma } from "../config/prisma";
import { PrismaClient } from "@prisma/client";

export class RepoService<T = any> {
  protected modelName: keyof PrismaClient;
  protected entityName: string;

  constructor(modelName: keyof PrismaClient, entityName: string = String(modelName)) {
    this.modelName = modelName;
    this.entityName = entityName;
  }

  protected get model(): any {
    return (prisma as any)[this.modelName];
  }

  async create(data: any): Promise<T> {
    return await this.model.create({ data });
  }

  async createMany(data: any[]): Promise<{ count: number }> {
    return await this.model.createMany({ data });
  }

  async update(id: string, data: any): Promise<T> {
    const existing = await this.model.findUnique({ where: { id } });
    Ensure.exists(existing, this.entityName);
    return await this.model.update({
      where: { id },
      data,
    });
  }

  async updateMany(where: any, data: any): Promise<{ count: number }> {
    return await this.model.updateMany({ where, data });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.model.findUnique({ where: { id } });
    Ensure.exists(existing, this.entityName);
    await this.model.delete({ where: { id } });
  }

  async deleteMany(where: any): Promise<{ count: number }> {
    return await this.model.deleteMany({ where });
  }

  protected normalizeQueryOptions(optionsOrInclude?: any): any {
    if (!optionsOrInclude) return {};
    if (
      optionsOrInclude.include !== undefined ||
      optionsOrInclude.select !== undefined ||
      optionsOrInclude.orderBy !== undefined
    ) {
      return optionsOrInclude;
    }
    return { include: optionsOrInclude };
  }

  async getById(id: string, optionsOrInclude?: any): Promise<T | null> {
    const opts = this.normalizeQueryOptions(optionsOrInclude);
    const existing = await this.model.findUnique({
      where: { id },
      ...opts,
    });
    Ensure.exists(existing, this.entityName);
    return existing;
  }

  async findById(id: string, optionsOrInclude?: any): Promise<T | null> {
    return await this.getById(id, optionsOrInclude);
  }

  async getAll(options?: {
    where?: any;
    include?: any;
    orderBy?: any;
  }): Promise<T[]> {
    return await this.model.findMany({
      where: options?.where,
      include: options?.include,
      orderBy: options?.orderBy,
    });
  }

  async getAllWithPagination(options?: {
    where?: any;
    include?: any;
    page?: number;
    limit?: number;
    orderBy?: any;
  }): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, options?.limit ?? 10);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.findMany({
        where: options?.where,
        include: options?.include,
        skip,
        take: limit,
        orderBy: options?.orderBy,
      }),
      this.model.count({ where: options?.where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(where: any, optionsOrInclude?: any): Promise<T | null> {
    const opts = this.normalizeQueryOptions(optionsOrInclude);
    return await this.model.findFirst({ where, ...opts });
  }

  async findOneByCondition(where: any, optionsOrInclude?: any): Promise<T | null> {
    const opts = this.normalizeQueryOptions(optionsOrInclude);
    return await this.model.findFirst({ where, ...opts });
  }

  async findMany(where?: any, optionsOrInclude?: any, orderBy?: any): Promise<T[]> {
    const opts = this.normalizeQueryOptions(optionsOrInclude);
    if (orderBy && !opts.orderBy) {
      opts.orderBy = orderBy;
    }
    return await this.model.findMany({ where, ...opts });
  }

  async findManyByCondition(
    where: any,
    optionsOrInclude?: any,
    orderBy?: any
  ): Promise<T[]> {
    return await this.findMany(where, optionsOrInclude, orderBy);
  }

  async exists(where: any): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }

  async count(where?: any): Promise<number> {
    return await this.model.count({ where });
  }

  async transaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
    return await prisma.$transaction(fn);
  }
}
