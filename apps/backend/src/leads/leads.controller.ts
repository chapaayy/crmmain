import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateCommentDto } from "../customers/dto/comment.dto";
import { CreateLeadDto, UpdateLeadDto } from "./dto/lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { LeadsService } from "./leads.service";

@ApiTags("leads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @RequirePermissions("leads.read")
  list(@Query() query: LeadQueryDto) {
    return this.leadsService.list(query);
  }

  @Post()
  @RequirePermissions("leads.create")
  create(@Body() dto: CreateLeadDto, @CurrentUser("userId") actorId: string) {
    return this.leadsService.create(dto, actorId);
  }

  @Get(":id")
  @RequirePermissions("leads.read")
  get(@Param("id") id: string) {
    return this.leadsService.get(id);
  }

  @Patch(":id")
  @RequirePermissions("leads.update")
  update(@Param("id") id: string, @Body() dto: UpdateLeadDto, @CurrentUser("userId") actorId: string) {
    return this.leadsService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("leads.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.leadsService.delete(id, actorId);
  }

  @Post(":id/convert-to-customer")
  @RequirePermissions("leads.update", "customers.create")
  convertToCustomer(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.leadsService.convertToCustomer(id, actorId);
  }

  @Post(":id/comments")
  @RequirePermissions("leads.create")
  addComment(@Param("id") id: string, @Body() dto: CreateCommentDto, @CurrentUser("userId") actorId: string) {
    return this.leadsService.addComment(id, dto, actorId);
  }
}
