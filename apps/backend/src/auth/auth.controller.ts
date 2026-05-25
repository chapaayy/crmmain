import { BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RequestWithCookies } from "./types";

type CookieRequest = Request & RequestWithCookies;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto);

    this.setRefreshCookie(response, session.refreshToken);
    return session;
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = this.getRefreshToken(request, dto.refreshToken);
    const session = await this.authService.refresh(refreshToken);

    this.setRefreshCookie(response, session.refreshToken);
    return session;
  }

  @Public()
  @Post("logout")
  async logout(
    @Body() dto: LogoutDto,
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const refreshToken = this.getRefreshToken(request, dto.refreshToken);

    await this.authService.logout(refreshToken);
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  async logoutAll(@CurrentUser("userId") userId: string, @Res({ passthrough: true }) response: Response) {
    await this.authService.logoutAll(userId);
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser("userId") userId: string) {
    return this.authService.me(userId);
  }

  private getRefreshToken(request: CookieRequest, bodyToken?: string) {
    const cookieToken = request.cookies?.[this.authService.refreshCookieName];
    const refreshToken = bodyToken || cookieToken;

    if (!refreshToken) {
      throw new BadRequestException("Refresh token is required");
    }

    return refreshToken;
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(this.authService.refreshCookieName, refreshToken, this.authService.refreshCookieOptions);
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(this.authService.refreshCookieName, this.authService.expiredRefreshCookieOptions);
  }
}
