import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MeService } from "./me.service";

@ApiTags("me")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get("summary")
  summary(@CurrentUser("userId") userId: string) {
    return this.meService.summary(userId);
  }
}
