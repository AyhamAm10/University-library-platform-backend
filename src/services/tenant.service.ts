import { RepoService } from "./repo.service";
import { TenantContext } from "../types/tenant.context";
import { PrismaClient } from "@prisma/client";
import { Ensure } from "../common/errors/Ensure.handler";
import { ForbiddenError } from "../common/errors/http.error";

export class TenantService<T = any> extends RepoService<T> {
  protected tenantContext: TenantContext;
  protected isPeriodScoped: boolean;

  constructor(
    modelName: keyof PrismaClient,
    entityName: string,
    tenantContext: TenantContext,
    isPeriodScoped: boolean = true
  ) {
    super(modelName, entityName);
    this.tenantContext = tenantContext;
    this.isPeriodScoped = isPeriodScoped;
  }

  get context(): TenantContext {
    return this.tenantContext;
  }

  protected get libraryId(): string {
    return this.tenantContext.libraryId;
  }

  protected get timePeriodId(): string | undefined {
    return this.tenantContext.timePeriodId;
  }

  protected buildTenantWhere(where: any = {}): any {
    const tenantFilter: any = {};

    if (this.tenantContext.libraryId) {
      tenantFilter.libraryId = this.tenantContext.libraryId;
    }

    if (this.isPeriodScoped && this.tenantContext.timePeriodId) {
      tenantFilter.timePeriodId = this.tenantContext.timePeriodId;
    }

    return {
      ...where,
      ...tenantFilter,
    };
  }

  protected buildTenantData(data: any): any {
    const tenantData = { ...data };

    if (this.tenantContext.libraryId && !tenantData.libraryId) {
      tenantData.libraryId = this.tenantContext.libraryId;
    }

    if (this.isPeriodScoped && this.tenantContext.timePeriodId && !tenantData.timePeriodId) {
      tenantData.timePeriodId = this.tenantContext.timePeriodId;
    }

    return tenantData;
  }

  override async create(data: any): Promise<T> {
    if (!this.tenantContext.libraryId && !this.tenantContext.isSuperAdmin) {
      throw new ForbiddenError("Tenant context missing library identification");
    }
    const scopedData = this.buildTenantData(data);
    return await super.create(scopedData);
  }

  override async createMany(data: any[]): Promise<{ count: number }> {
    if (!this.tenantContext.libraryId && !this.tenantContext.isSuperAdmin) {
      throw new ForbiddenError("Tenant context missing library identification");
    }
    const scopedData = data.map((item) => this.buildTenantData(item));
    return await super.createMany(scopedData);
  }

  override async update(id: string, data: any): Promise<T> {
    const where = this.buildTenantWhere({ id });
    const existing = await this.model.findFirst({ where });
    Ensure.exists(existing, this.entityName);
    return await this.model.update({
      where: { id },
      data,
    });
  }

  override async updateMany(where: any, data: any): Promise<{ count: number }> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.updateMany(scopedWhere, data);
  }

  override async delete(id: string): Promise<void> {
    const where = this.buildTenantWhere({ id });
    const existing = await this.model.findFirst({ where });
    Ensure.exists(existing, this.entityName);
    await this.model.delete({ where: { id } });
  }

  override async deleteMany(where: any): Promise<{ count: number }> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.deleteMany(scopedWhere);
  }

  override async getById(id: string, optionsOrInclude?: any): Promise<T | null> {
    const where = this.buildTenantWhere({ id });
    const opts = this.normalizeQueryOptions(optionsOrInclude);
    const existing = await this.model.findFirst({
      where,
      ...opts,
    });
    Ensure.exists(existing, this.entityName);
    return existing;
  }

  override async findById(id: string, optionsOrInclude?: any): Promise<T | null> {
    const where = this.buildTenantWhere({ id });
    const opts = this.normalizeQueryOptions(optionsOrInclude);
    return await this.model.findFirst({
      where,
      ...opts,
    });
  }

  override async getAll(options?: {
    where?: any;
    include?: any;
    orderBy?: any;
  }): Promise<T[]> {
    const scopedWhere = this.buildTenantWhere(options?.where);
    return await super.getAll({
      where: scopedWhere,
      include: options?.include,
      orderBy: options?.orderBy,
    });
  }

  override async getAllWithPagination(options?: {
    where?: any;
    include?: any;
    page?: number;
    limit?: number;
    orderBy?: any;
  }): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    const scopedWhere = this.buildTenantWhere(options?.where);
    return await super.getAllWithPagination({
      where: scopedWhere,
      include: options?.include,
      page: options?.page,
      limit: options?.limit,
      orderBy: options?.orderBy,
    });
  }

  override async findOne(where: any = {}, optionsOrInclude?: any): Promise<T | null> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.findOne(scopedWhere, optionsOrInclude);
  }

  override async findOneByCondition(where: any = {}, optionsOrInclude?: any): Promise<T | null> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.findOneByCondition(scopedWhere, optionsOrInclude);
  }

  override async findMany(
    where: any = {},
    optionsOrInclude?: any,
    orderBy?: any
  ): Promise<T[]> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.findMany(scopedWhere, optionsOrInclude, orderBy);
  }

  override async findManyByCondition(
    where: any = {},
    optionsOrInclude?: any,
    orderBy?: any
  ): Promise<T[]> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.findManyByCondition(scopedWhere, optionsOrInclude, orderBy);
  }

  override async exists(where: any = {}): Promise<boolean> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.exists(scopedWhere);
  }

  override async count(where: any = {}): Promise<number> {
    const scopedWhere = this.buildTenantWhere(where);
    return await super.count(scopedWhere);
  }

  // Backward-compatible delegates
  async createTenant(data: any): Promise<T> {
    return await this.create(data);
  }

  async updateTenant(id: string, data: any): Promise<T> {
    return await this.update(id, data);
  }

  async deleteTenant(id: string): Promise<void> {
    return await this.delete(id);
  }

  async getByIdTenant(id: string, include?: any): Promise<T | null> {
    return await this.getById(id, include);
  }

  async getAllTenant(options?: {
    where?: any;
    include?: any;
    orderBy?: any;
  }): Promise<T[]> {
    return await this.getAll(options);
  }

  async getAllWithPaginationTenant(options?: {
    where?: any;
    include?: any;
    page?: number;
    limit?: number;
    orderBy?: any;
  }): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    return await this.getAllWithPagination(options);
  }

  async findOneTenant(where: any = {}, include?: any): Promise<T | null> {
    return await this.findOne(where, include);
  }

  async findManyTenant(
    where: any = {},
    include?: any,
    orderBy?: any
  ): Promise<T[]> {
    return await this.findMany(where, include, orderBy);
  }

  async existsTenant(where: any = {}): Promise<boolean> {
    return await this.exists(where);
  }

  async countTenant(where: any = {}): Promise<number> {
    return await this.count(where);
  }
}
