import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ImportProductsCsvDto } from "./dto/product-csv.dto";
import { CreateProductDto, UpdateProductDto } from "./dto/product.dto";
import { ProductQueryDto } from "./dto/product-query.dto";
import { CreateProductVariantDto, UpdateProductVariantDto } from "./dto/product-variant.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions("products.read")
  list(@Query() query: ProductQueryDto) {
    return this.productsService.listProducts(query);
  }

  @Post()
  @RequirePermissions("products.create")
  create(@Body() dto: CreateProductDto, @CurrentUser("userId") actorId: string) {
    return this.productsService.createProduct(dto, actorId);
  }

  @Post("import/csv")
  @RequirePermissions("products.create", "products.update")
  importCsv(@Body() dto: ImportProductsCsvDto, @CurrentUser("userId") actorId: string) {
    return this.productsService.importCsv(dto, actorId);
  }

  @Get("export/csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @RequirePermissions("products.read")
  async exportCsv(
    @Query() query: ProductQueryDto,
    @CurrentUser("userId") actorId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    response.setHeader("Content-Disposition", "attachment; filename=\"products.csv\"");
    return this.productsService.exportCsv(query, actorId);
  }

  @Get(":id")
  @RequirePermissions("products.read")
  get(@Param("id") id: string) {
    return this.productsService.getProduct(id);
  }

  @Patch(":id")
  @RequirePermissions("products.update")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto, @CurrentUser("userId") actorId: string) {
    return this.productsService.updateProduct(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("products.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.productsService.deleteProduct(id, actorId);
  }

  @Post(":id/variants")
  @RequirePermissions("products.create")
  createVariant(
    @Param("id") productId: string,
    @Body() dto: CreateProductVariantDto,
    @CurrentUser("userId") actorId: string
  ) {
    return this.productsService.createVariant(productId, dto, actorId);
  }

  @Patch(":id/variants/:variantId")
  @RequirePermissions("products.update")
  updateVariant(
    @Param("id") productId: string,
    @Param("variantId") variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentUser("userId") actorId: string
  ) {
    return this.productsService.updateVariant(productId, variantId, dto, actorId);
  }

  @Delete(":id/variants/:variantId")
  @RequirePermissions("products.delete")
  deleteVariant(
    @Param("id") productId: string,
    @Param("variantId") variantId: string,
    @CurrentUser("userId") actorId: string
  ) {
    return this.productsService.deleteVariant(productId, variantId, actorId);
  }
}
