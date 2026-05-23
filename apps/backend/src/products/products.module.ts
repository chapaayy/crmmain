import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ProductCategoriesController } from "./product-categories.controller";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuditModule],
  controllers: [ProductCategoriesController, ProductsController],
  providers: [ProductsService, PermissionsGuard]
})
export class ProductsModule {}
