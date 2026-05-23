import { Body, Controller, Delete, Get, Param, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { createReadStream } from "node:fs";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateDocumentDto, GenerateOrderDocumentDto } from "./dto/document.dto";
import { DocumentQueryDto } from "./dto/document-query.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("documents")
  @RequirePermissions("documents.read")
  list(@Query() query: DocumentQueryDto) {
    return this.documentsService.list(query);
  }

  @Post("documents")
  @RequirePermissions("documents.manage")
  create(@Body() dto: CreateDocumentDto, @CurrentUser("userId") actorId: string) {
    return this.documentsService.create(dto, actorId);
  }

  @Get("documents/:id/download")
  @RequirePermissions("documents.read")
  async download(@Param("id") id: string) {
    const file = await this.documentsService.getDownload(id);

    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType,
      disposition: `attachment; filename="${safeHeaderFilename(file.filename)}"`
    });
  }

  @Get("documents/:id")
  @RequirePermissions("documents.read")
  get(@Param("id") id: string) {
    return this.documentsService.get(id);
  }

  @Delete("documents/:id")
  @RequirePermissions("documents.manage")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.documentsService.delete(id, actorId);
  }

  @Post("orders/:id/documents/invoice")
  @RequirePermissions("documents.manage")
  generateInvoice(@Param("id") id: string, @Body() dto: GenerateOrderDocumentDto, @CurrentUser("userId") actorId: string) {
    return this.documentsService.generateInvoice(id, dto, actorId);
  }

  @Post("orders/:id/documents/commercial-offer")
  @RequirePermissions("documents.manage")
  generateCommercialOffer(@Param("id") id: string, @Body() dto: GenerateOrderDocumentDto, @CurrentUser("userId") actorId: string) {
    return this.documentsService.generateCommercialOffer(id, dto, actorId);
  }
}

function safeHeaderFilename(value: string) {
  return value.replace(/["\\\r\n]/g, "_");
}
