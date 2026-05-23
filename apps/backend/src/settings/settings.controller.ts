import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions("settings.manage")
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @RequirePermissions("settings.manage")
  updateSettings(@Body() dto: UpdateSettingsDto, @CurrentUser("userId") actorId: string) {
    return this.settingsService.updateSettings(dto, actorId);
  }
}
