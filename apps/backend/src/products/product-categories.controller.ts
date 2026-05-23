import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateProductCategoryDto, UpdateProductCategoryDto } from "./dto/product-category.dto";
import { ProductsService } from "./products.service";

@ApiTags("product-categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("product-categories")
export class ProductCategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions("products.read")
  list() {
    return this.productsService.listCategories();
  }

  @Post()
  @RequirePermissions("products.create")
  create(@Body() dto: CreateProductCategoryDto, @CurrentUser("userId") actorId: string) {
    return this.productsService.createCategory(dto, actorId);
  }

  @Patch(":id")
  @RequirePermissions("products.update")
  update(@Param("id") id: string, @Body() dto: UpdateProductCategoryDto, @CurrentUser("userId") actorId: string) {
    return this.productsService.updateCategory(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("products.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.productsService.deleteCategory(id, actorId);
  }
}
