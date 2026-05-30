import { Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

const namespace = "crm";
const defaultSettings = {
  companyProfile: {
    name: "",
    shortName: "",
    phone: "",
    email: "",
    website: "",
    address: ""
  },
  requisites: {
    inn: "",
    kpp: "",
    ogrn: "",
    bankName: "",
    bik: "",
    account: "",
    correspondentAccount: ""
  }
};

type SettingsKey = keyof typeof defaultSettings;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getSettings() {
    const rows = await this.prisma.setting.findMany({
      where: {
        namespace,
        deletedAt: null
      }
    });
    const settings = { ...defaultSettings } as Record<SettingsKey, unknown>;

    for (const row of rows) {
      if (row.key in settings) {
        settings[row.key as SettingsKey] = row.value;
      }
    }

    return { settings };
  }

  async updateSettings(dto: UpdateSettingsDto, actorId: string) {
    const before = await this.getSettings();
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined) as [SettingsKey, Prisma.InputJsonValue][];

    for (const [key, value] of entries) {
      await this.prisma.setting.upsert({
        where: {
          namespace_key: {
            namespace,
            key
          }
        },
        update: {
          value,
          updatedById: actorId,
          deletedAt: null
        },
        create: {
          namespace,
          key,
          value,
          description: key,
          createdById: actorId,
          updatedById: actorId
        }
      });
    }

    const after = await this.getSettings();

    await this.auditService.log({
      actorId,
      action: AuditAction.UPDATE,
      entityType: "Setting",
      entityId: namespace,
      before: sanitizeJson(before.settings),
      after: sanitizeJson(after.settings)
    });

    return after;
  }
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
