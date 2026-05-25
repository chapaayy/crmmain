import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [MeService, JwtAuthGuard]
})
export class MeModule {}
