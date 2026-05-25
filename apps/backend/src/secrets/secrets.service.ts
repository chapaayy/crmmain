import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction, Prisma, RoleCode, SecretAccessAction, SecretVaultItemType } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { AuditService } from "../audit/audit.service";
import { createPaginationMeta } from "../common/dto/paginated-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSecretVaultItemDto, RevealSecretDto, UpdateSecretVaultItemDto } from "./dto/secret.dto";
import { SecretVaultItemQueryDto } from "./dto/secret-query.dto";

const userSelect = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const employeeSummarySelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  position: true,
  department: true,
  userId: true
} satisfies Prisma.EmployeeProfileSelect;

const responsibilitySummarySelect = {
  id: true,
  title: true,
  category: true,
  status: true,
  ownerUserId: true,
  ownerEmployeeId: true,
  assignments: {
    select: {
      userId: true,
      employeeId: true
    }
  }
} satisfies Prisma.ResponsibilitySelect;

const secretSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  url: true,
  username: true,
  login: true,
  phone: true,
  email: true,
  encryptedSecret: true,
  encryptedNotes: true,
  responsibilityId: true,
  ownerUserId: true,
  ownerEmployeeId: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  responsibility: { select: responsibilitySummarySelect },
  ownerUser: { select: userSelect },
  ownerEmployee: { select: employeeSummarySelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect }
} satisfies Prisma.SecretVaultItemSelect;

const accessLogSelect = {
  id: true,
  secretId: true,
  userId: true,
  action: true,
  reason: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  user: { select: userSelect }
} satisfies Prisma.SecretAccessLogSelect;

type SecretPayload = Prisma.SecretVaultItemGetPayload<{ select: typeof secretSelect }>;

interface ActorAccess {
  isSuperAdmin: boolean;
  permissions: Set<string>;
  employeeId?: string;
  userId: string;
}

interface SecretRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

interface SecretEnvelope {
  iv: string;
  authTag: string;
  data: string;
}

@Injectable()
export class SecretsService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService
  ) {
    const rawKey = this.configService.get<string>("secrets.encryptionKey") ?? process.env.SECRETS_ENCRYPTION_KEY ?? "";
    this.encryptionKey = createHash("sha256").update(rawKey || "change_me_32_plus_chars_secret_key").digest();
  }

  async list(query: SecretVaultItemQueryDto, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secrets.read_metadata");
    const where = this.applySecretScope(access, this.buildWhere(query));
    const [total, secrets] = await Promise.all([
      this.prisma.secretVaultItem.count({ where }),
      this.prisma.secretVaultItem.findMany({
        where,
        select: secretSelect,
        orderBy: { updatedAt: "desc" },
        skip: query.skip,
        take: query.limit
      })
    ]);

    return {
      data: secrets.map((secret) => this.serializeSecret(secret)),
      meta: createPaginationMeta(query.page, query.limit, total)
    };
  }

  async create(dto: CreateSecretVaultItemDto, actorId: string, context?: SecretRequestContext) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secrets.create");
    const owner = await this.resolveOwner(dto.ownerUserId, dto.ownerEmployeeId);

    if (dto.responsibilityId) {
      await this.requireResponsibility(dto.responsibilityId);
    }

    const secret = await this.prisma.secretVaultItem.create({
      data: {
        title: requiredString(dto.title, "Secret title"),
        description: nullableString(dto.description),
        type: dto.type ?? SecretVaultItemType.OTHER,
        url: nullableString(dto.url),
        username: nullableString(dto.username),
        login: nullableString(dto.login),
        phone: nullableString(dto.phone),
        email: nullableString(dto.email),
        encryptedSecret: this.encryptNullable(dto.secret),
        encryptedNotes: this.encryptNullable(dto.notes),
        responsibilityId: nullableString(dto.responsibilityId),
        ownerUserId: owner.userId,
        ownerEmployeeId: owner.employeeId,
        createdById: actorId
      },
      select: secretSelect
    });

    await Promise.all([
      this.auditService.log({
        actorId,
        action: AuditAction.CREATE,
        entityType: "SecretVaultItem",
        entityId: secret.id,
        after: sanitizeJson(this.serializeSecret(secret))
      }),
      this.logSecretAccess(secret.id, actorId, SecretAccessAction.CREATED, undefined, context)
    ]);

    return { secret: this.serializeSecret(secret) };
  }

  async get(id: string, actorId: string, context?: SecretRequestContext) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secrets.read_metadata");
    const secret = await this.requireSecret(id);
    this.ensureCanViewSecret(access, secret);
    await this.logSecretAccess(secret.id, actorId, SecretAccessAction.METADATA_VIEWED, undefined, context);
    return { secret: this.serializeSecret(secret) };
  }

  async update(id: string, dto: UpdateSecretVaultItemDto, actorId: string, context?: SecretRequestContext) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secrets.update");
    const before = await this.requireSecret(id);
    const data: Prisma.SecretVaultItemUncheckedUpdateInput = { updatedById: actorId };
    const writable = data as Record<string, unknown>;

    assignIfDefined(writable, "title", dto.title, (value) => requiredString(value, "Secret title"));
    assignIfDefined(writable, "description", dto.description, nullableString);
    assignIfDefined(writable, "type", dto.type);
    assignIfDefined(writable, "url", dto.url, nullableString);
    assignIfDefined(writable, "username", dto.username, nullableString);
    assignIfDefined(writable, "login", dto.login, nullableString);
    assignIfDefined(writable, "phone", dto.phone, nullableString);
    assignIfDefined(writable, "email", dto.email, nullableString);
    assignIfDefined(writable, "responsibilityId", dto.responsibilityId, nullableString);

    if (dto.secret !== undefined) {
      data.encryptedSecret = this.encryptNullable(dto.secret);
    }

    if (dto.notes !== undefined) {
      data.encryptedNotes = this.encryptNullable(dto.notes);
    }

    if (dto.ownerUserId !== undefined || dto.ownerEmployeeId !== undefined) {
      const owner = await this.resolveOwner(dto.ownerUserId, dto.ownerEmployeeId);
      data.ownerUserId = owner.userId;
      data.ownerEmployeeId = owner.employeeId;
    }

    if (dto.responsibilityId) {
      await this.requireResponsibility(dto.responsibilityId);
    }

    const secret = await this.prisma.secretVaultItem.update({
      where: { id },
      data,
      select: secretSelect
    });

    await Promise.all([
      this.auditService.log({
        actorId,
        action: AuditAction.UPDATE,
        entityType: "SecretVaultItem",
        entityId: id,
        before: sanitizeJson(this.serializeSecret(before)),
        after: sanitizeJson(this.serializeSecret(secret))
      }),
      this.logSecretAccess(secret.id, actorId, SecretAccessAction.UPDATED, undefined, context)
    ]);

    return { secret: this.serializeSecret(secret) };
  }

  async delete(id: string, actorId: string, context?: SecretRequestContext) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secrets.delete");
    const before = await this.requireSecret(id);
    await this.prisma.secretVaultItem.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: actorId }
    });
    await Promise.all([
      this.auditService.log({
        actorId,
        action: AuditAction.DELETE,
        entityType: "SecretVaultItem",
        entityId: id,
        before: sanitizeJson(this.serializeSecret(before))
      }),
      this.logSecretAccess(id, actorId, SecretAccessAction.DELETED, undefined, context)
    ]);

    return { success: true };
  }

  async reveal(id: string, dto: RevealSecretDto, actorId: string, context?: SecretRequestContext) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secrets.reveal");
    const reason = nullableString(dto.reason);

    if (this.requireReasonOnReveal && !reason) {
      throw new BadRequestException("Reveal reason is required");
    }

    const secret = await this.requireSecret(id);
    this.ensureCanRevealSecret(access, secret);
    await Promise.all([
      this.enableRevealAudit ? this.logSecretAccess(id, actorId, SecretAccessAction.REVEALED, reason ?? undefined, context) : Promise.resolve(),
      this.auditService.log({
        actorId,
        action: AuditAction.UPDATE,
        entityType: "SecretVaultItemReveal",
        entityId: id,
        after: sanitizeJson({ id, title: secret.title, reason: reason ?? null })
      })
    ]);

    return {
      id: secret.id,
      title: secret.title,
      secret: this.decryptNullable(secret.encryptedSecret),
      notes: this.decryptNullable(secret.encryptedNotes)
    };
  }

  async listAccessLogs(secretId: string, actorId: string) {
    const access = await this.getActorAccess(actorId);
    this.requirePermission(access, "secret_access_logs.read");
    await this.requireSecret(secretId);
    const data = await this.prisma.secretAccessLog.findMany({
      where: { secretId },
      select: accessLogSelect,
      orderBy: { createdAt: "desc" }
    });

    return { data };
  }

  async listForResponsibility(responsibilityId: string, query: SecretVaultItemQueryDto, actorId: string) {
    return this.list(Object.assign(query, { responsibilityId }), actorId);
  }

  async createForResponsibility(responsibilityId: string, dto: CreateSecretVaultItemDto, actorId: string, context?: SecretRequestContext) {
    return this.create({ ...dto, responsibilityId }, actorId, context);
  }

  private get requireReasonOnReveal() {
    return this.configService.get<boolean>("secrets.requireReasonOnReveal") ?? true;
  }

  private get enableRevealAudit() {
    return this.configService.get<boolean>("secrets.enableRevealAudit") ?? true;
  }

  private buildWhere(query: SecretVaultItemQueryDto): Prisma.SecretVaultItemWhereInput {
    return {
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.responsibilityId ? { responsibilityId: query.responsibilityId } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.ownerEmployeeId ? { ownerEmployeeId: query.ownerEmployeeId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { url: { contains: query.search, mode: "insensitive" } },
              { username: { contains: query.search, mode: "insensitive" } },
              { login: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { responsibility: { title: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private applySecretScope(access: ActorAccess, where: Prisma.SecretVaultItemWhereInput): Prisma.SecretVaultItemWhereInput {
    if (this.hasGlobalSecretsAccess(access)) {
      return where;
    }

    return {
      AND: [
        where,
        {
          OR: [
            { ownerUserId: access.userId },
            { createdById: access.userId },
            ...(access.employeeId ? [{ ownerEmployeeId: access.employeeId }] : []),
            { responsibility: { ownerUserId: access.userId } },
            ...(access.employeeId ? [{ responsibility: { ownerEmployeeId: access.employeeId } }] : []),
            { responsibility: { assignments: { some: { userId: access.userId } } } },
            ...(access.employeeId ? [{ responsibility: { assignments: { some: { employeeId: access.employeeId } } } }] : [])
          ]
        }
      ]
    };
  }

  private serializeSecret(secret: SecretPayload) {
    const { encryptedSecret, encryptedNotes, ...metadata } = secret;
    const mask = this.configService.get<boolean>("secrets.maskByDefault") ?? true;

    return {
      ...metadata,
      hasSecret: Boolean(encryptedSecret),
      hasNotes: Boolean(encryptedNotes),
      secretMasked: encryptedSecret && mask ? "********" : null,
      notesMasked: encryptedNotes && mask ? "********" : null
    };
  }

  private encryptNullable(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const envelope: SecretEnvelope = {
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64")
    };

    return JSON.stringify(envelope);
  }

  private decryptNullable(value: string | null) {
    if (!value) {
      return null;
    }

    const envelope = JSON.parse(value) as SecretEnvelope;
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);

    return decrypted.toString("utf8");
  }

  private async resolveOwner(userIdValue?: string | null, employeeIdValue?: string | null) {
    let userId = nullableString(userIdValue);
    const employeeId = nullableString(employeeIdValue);

    if (employeeId) {
      const employee = await this.prisma.employeeProfile.findFirst({
        where: { id: employeeId, deletedAt: null, isActive: true },
        select: { id: true, userId: true }
      });

      if (!employee) {
        throw new BadRequestException("Owner employee not found or inactive");
      }

      userId = userId ?? employee.userId;
    }

    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null, isActive: true },
        select: { id: true }
      });

      if (!user) {
        throw new BadRequestException("Owner user not found or inactive");
      }
    }

    return { userId, employeeId };
  }

  private async requireResponsibility(id: string) {
    const responsibility = await this.prisma.responsibility.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });

    if (!responsibility) {
      throw new BadRequestException("Responsibility not found");
    }
  }

  private async requireSecret(id: string): Promise<SecretPayload> {
    const secret = await this.prisma.secretVaultItem.findFirst({
      where: { id, deletedAt: null },
      select: secretSelect
    });

    if (!secret) {
      throw new NotFoundException("Secret not found");
    }

    return secret;
  }

  private ensureCanViewSecret(access: ActorAccess, secret: SecretPayload) {
    if (this.hasGlobalSecretsAccess(access) || isOwnSecret(access, secret)) {
      return;
    }

    throw new ForbiddenException("You can only view assigned secret metadata");
  }

  private ensureCanRevealSecret(access: ActorAccess, secret: SecretPayload) {
    if (access.isSuperAdmin || access.permissions.has("secrets.reveal") || isOwnSecret(access, secret)) {
      return;
    }

    throw new ForbiddenException("You cannot reveal this secret");
  }

  private hasGlobalSecretsAccess(access: ActorAccess) {
    return access.isSuperAdmin || ["secrets.create", "secrets.update", "secrets.delete", "secrets.assign"].some((permission) => access.permissions.has(permission));
  }

  private requirePermission(access: ActorAccess, permission: string) {
    if (access.isSuperAdmin || access.permissions.has(permission)) {
      return;
    }

    throw new ForbiddenException(`Missing permission: ${permission}`);
  }

  private async logSecretAccess(secretId: string, userId: string, action: SecretAccessAction, reason?: string, context?: SecretRequestContext) {
    await this.prisma.secretAccessLog.create({
      data: {
        secretId,
        userId,
        action,
        reason: nullableString(reason),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent
      }
    });
  }

  private async getActorAccess(actorId: string): Promise<ActorAccess> {
    const user = await this.prisma.user.findFirst({
      where: { id: actorId, deletedAt: null, isActive: true },
      select: {
        primaryRole: true,
        employeeProfile: { select: { id: true } },
        roles: {
          where: { deletedAt: null },
          select: {
            role: {
              select: {
                code: true,
                deletedAt: true,
                permissions: {
                  where: { deletedAt: null },
                  select: { permission: { select: { key: true, deletedAt: true } } }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new ForbiddenException("User is inactive or deleted");
    }

    const roleCodes = new Set(user.roles.filter(({ role }) => !role.deletedAt).map(({ role }) => role.code));
    const permissions = new Set(
      user.roles.flatMap(({ role }) =>
        role.deletedAt ? [] : role.permissions.filter(({ permission }) => !permission.deletedAt).map(({ permission }) => permission.key)
      )
    );

    return {
      isSuperAdmin: user.primaryRole === RoleCode.SUPER_ADMIN || roleCodes.has(RoleCode.SUPER_ADMIN),
      permissions,
      employeeId: user.employeeProfile?.id,
      userId: actorId
    };
  }
}

function isOwnSecret(access: ActorAccess, secret: SecretPayload) {
  return (
    secret.ownerUserId === access.userId ||
    secret.createdById === access.userId ||
    Boolean(access.employeeId && secret.ownerEmployeeId === access.employeeId) ||
    secret.responsibility?.ownerUserId === access.userId ||
    Boolean(access.employeeId && secret.responsibility?.ownerEmployeeId === access.employeeId) ||
    Boolean(secret.responsibility?.assignments.some((assignment) => assignment.userId === access.userId || Boolean(access.employeeId && assignment.employeeId === access.employeeId)))
  );
}

function assignIfDefined<V>(target: Record<string, unknown>, key: string, value: V | undefined, mapper?: (value: V) => unknown) {
  if (value !== undefined) {
    target[key] = mapper ? mapper(value) : value;
  }
}

function requiredString(value: string | undefined, field: string) {
  const normalized = nullableString(value);

  if (!normalized) {
    throw new BadRequestException(`${field} is required`);
  }

  return normalized;
}

function nullableString(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
