import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
