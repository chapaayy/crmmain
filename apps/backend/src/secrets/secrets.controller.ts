import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateSecretVaultItemDto, RevealSecretDto, UpdateSecretVaultItemDto } from "./dto/secret.dto";
import { SecretVaultItemQueryDto } from "./dto/secret-query.dto";
import { SecretsService } from "./secrets.service";

@ApiTags("secrets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Get("secrets")
  @RequirePermissions("secrets.read_metadata")
  list(@Query() query: SecretVaultItemQueryDto, @CurrentUser("userId") actorId: string) {
    return this.secretsService.list(query, actorId);
  }

  @Post("secrets")
  @RequirePermissions("secrets.create")
  create(@Body() dto: CreateSecretVaultItemDto, @CurrentUser("userId") actorId: string, @Req() request: Request) {
    return this.secretsService.create(dto, actorId, requestContext(request));
  }

  @Get("secrets/:id")
  @RequirePermissions("secrets.read_metadata")
  get(@Param("id") id: string, @CurrentUser("userId") actorId: string, @Req() request: Request) {
    return this.secretsService.get(id, actorId, requestContext(request));
  }

  @Patch("secrets/:id")
  @RequirePermissions("secrets.update")
  update(@Param("id") id: string, @Body() dto: UpdateSecretVaultItemDto, @CurrentUser("userId") actorId: string, @Req() request: Request) {
    return this.secretsService.update(id, dto, actorId, requestContext(request));
  }

  @Delete("secrets/:id")
  @RequirePermissions("secrets.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string, @Req() request: Request) {
    return this.secretsService.delete(id, actorId, requestContext(request));
  }

  @Post("secrets/:id/reveal")
  @RequirePermissions("secrets.reveal")
  reveal(@Param("id") id: string, @Body() dto: RevealSecretDto, @CurrentUser("userId") actorId: string, @Req() request: Request) {
    return this.secretsService.reveal(id, dto, actorId, requestContext(request));
  }

  @Get("secrets/:id/access-logs")
  @RequirePermissions("secret_access_logs.read")
  listAccessLogs(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.secretsService.listAccessLogs(id, actorId);
  }

  @Get("responsibilities/:id/secrets")
  @RequirePermissions("secrets.read_metadata")
  listForResponsibility(@Param("id") id: string, @Query() query: SecretVaultItemQueryDto, @CurrentUser("userId") actorId: string) {
    return this.secretsService.listForResponsibility(id, query, actorId);
  }

  @Post("responsibilities/:id/secrets")
  @RequirePermissions("secrets.create")
  createForResponsibility(@Param("id") id: string, @Body() dto: CreateSecretVaultItemDto, @CurrentUser("userId") actorId: string, @Req() request: Request) {
    return this.secretsService.createForResponsibility(id, dto, actorId, requestContext(request));
  }
}

function requestContext(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent")
  };
}
