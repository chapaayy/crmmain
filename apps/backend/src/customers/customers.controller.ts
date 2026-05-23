import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateCommentDto } from "./dto/comment.dto";
import { CreateCustomerContactDto, UpdateCustomerContactDto } from "./dto/customer-contact.dto";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { CustomersService } from "./customers.service";

@ApiTags("customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions("customers.read")
  list(@Query() query: CustomerQueryDto) {
    return this.customersService.list(query);
  }

  @Post()
  @RequirePermissions("customers.create")
  create(@Body() dto: CreateCustomerDto, @CurrentUser("userId") actorId: string) {
    return this.customersService.create(dto, actorId);
  }

  @Get(":id")
  @RequirePermissions("customers.read")
  get(@Param("id") id: string) {
    return this.customersService.get(id);
  }

  @Patch(":id")
  @RequirePermissions("customers.update")
  update(@Param("id") id: string, @Body() dto: UpdateCustomerDto, @CurrentUser("userId") actorId: string) {
    return this.customersService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("customers.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.customersService.delete(id, actorId);
  }

  @Post(":id/contacts")
  @RequirePermissions("customers.create")
  createContact(@Param("id") id: string, @Body() dto: CreateCustomerContactDto, @CurrentUser("userId") actorId: string) {
    return this.customersService.createContact(id, dto, actorId);
  }

  @Patch(":id/contacts/:contactId")
  @RequirePermissions("customers.update")
  updateContact(
    @Param("id") id: string,
    @Param("contactId") contactId: string,
    @Body() dto: UpdateCustomerContactDto,
    @CurrentUser("userId") actorId: string
  ) {
    return this.customersService.updateContact(id, contactId, dto, actorId);
  }

  @Delete(":id/contacts/:contactId")
  @RequirePermissions("customers.delete")
  deleteContact(@Param("id") id: string, @Param("contactId") contactId: string, @CurrentUser("userId") actorId: string) {
    return this.customersService.deleteContact(id, contactId, actorId);
  }

  @Get(":id/timeline")
  @RequirePermissions("customers.read")
  timeline(@Param("id") id: string) {
    return this.customersService.timeline(id);
  }

  @Post(":id/comments")
  @RequirePermissions("customers.create")
  addComment(@Param("id") id: string, @Body() dto: CreateCommentDto, @CurrentUser("userId") actorId: string) {
    return this.customersService.addComment(id, dto, actorId);
  }
}
