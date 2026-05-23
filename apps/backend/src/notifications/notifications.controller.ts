import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Query() query: NotificationQueryDto, @CurrentUser("userId") userId: string) {
    return this.notificationsService.list(userId, query);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser("userId") userId: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser("userId") userId: string) {
    return this.notificationsService.markAllRead(userId);
  }
}
