import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  AssignResponsibilityDto,
  CreateResponsibilityChecklistItemDto,
  CreateResponsibilityDto,
  CreateResponsibilityInstructionDto,
  UpdateResponsibilityChecklistItemDto,
  UpdateResponsibilityDto,
  UpdateResponsibilityInstructionDto
} from "./dto/responsibility.dto";
import { ResponsibilityQueryDto } from "./dto/responsibility-query.dto";
import { ResponsibilitiesService } from "./responsibilities.service";

@ApiTags("responsibilities")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ResponsibilitiesController {
  constructor(private readonly responsibilitiesService: ResponsibilitiesService) {}

  @Get("responsibilities")
  @RequirePermissions("responsibilities.read")
  list(@Query() query: ResponsibilityQueryDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.list(query, actorId);
  }

  @Post("responsibilities")
  @RequirePermissions("responsibilities.create")
  create(@Body() dto: CreateResponsibilityDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.create(dto, actorId);
  }

  @Get("responsibilities/:id")
  @RequirePermissions("responsibilities.read")
  get(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.get(id, actorId);
  }

  @Patch("responsibilities/:id")
  @RequirePermissions("responsibilities.update")
  update(@Param("id") id: string, @Body() dto: UpdateResponsibilityDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.update(id, dto, actorId);
  }

  @Delete("responsibilities/:id")
  @RequirePermissions("responsibilities.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.delete(id, actorId);
  }

  @Post("responsibilities/:id/assign")
  @RequirePermissions("responsibilities.assign")
  assign(@Param("id") id: string, @Body() dto: AssignResponsibilityDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.assign(id, dto, actorId);
  }

  @Delete("responsibilities/:id/assignments/:assignmentId")
  @RequirePermissions("responsibilities.assign")
  deleteAssignment(@Param("id") id: string, @Param("assignmentId") assignmentId: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.deleteAssignment(id, assignmentId, actorId);
  }

  @Get("employees/:id/responsibilities")
  @RequirePermissions("responsibilities.read")
  listForEmployee(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.listForEmployee(id, actorId);
  }

  @Get("users/:id/responsibilities")
  @RequirePermissions("responsibilities.read")
  listForUser(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.listForUser(id, actorId);
  }

  @Get("responsibilities/:id/instructions")
  @RequirePermissions("instructions.read")
  listInstructions(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.listInstructions(id, actorId);
  }

  @Post("responsibilities/:id/instructions")
  @RequirePermissions("instructions.manage")
  createInstruction(@Param("id") id: string, @Body() dto: CreateResponsibilityInstructionDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.createInstruction(id, dto, actorId);
  }

  @Patch("responsibility-instructions/:id")
  @RequirePermissions("instructions.manage")
  updateInstruction(@Param("id") id: string, @Body() dto: UpdateResponsibilityInstructionDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.updateInstruction(id, dto, actorId);
  }

  @Delete("responsibility-instructions/:id")
  @RequirePermissions("instructions.manage")
  deleteInstruction(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.deleteInstruction(id, actorId);
  }

  @Get("responsibilities/:id/checklist")
  @RequirePermissions("responsibilities.read")
  listChecklist(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.listChecklist(id, actorId);
  }

  @Post("responsibilities/:id/checklist")
  @RequirePermissions("responsibilities.update")
  createChecklistItem(@Param("id") id: string, @Body() dto: CreateResponsibilityChecklistItemDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.createChecklistItem(id, dto, actorId);
  }

  @Patch("responsibility-checklist/:id")
  @RequirePermissions("responsibilities.update")
  updateChecklistItem(@Param("id") id: string, @Body() dto: UpdateResponsibilityChecklistItemDto, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.updateChecklistItem(id, dto, actorId);
  }

  @Delete("responsibility-checklist/:id")
  @RequirePermissions("responsibilities.update")
  deleteChecklistItem(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.responsibilitiesService.deleteChecklistItem(id, actorId);
  }
}
