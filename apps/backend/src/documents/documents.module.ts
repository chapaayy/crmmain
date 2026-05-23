import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, PermissionsGuard],
  exports: [DocumentsService]
})
export class DocumentsModule {}
