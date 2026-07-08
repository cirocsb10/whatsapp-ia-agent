import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { GoogleLoginDto } from "./dto/google-login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@Controller("auth")
@Throttle({ default: { ttl: 60_000, limit: 5 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("forgot-password")
  @HttpCode(501)
  forgotPassword() {
    return { message: "Recuperação de senha ainda não implementada" };
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post("google")
  @HttpCode(200)
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto.accessToken);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshToken(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }

  @Post("socket-ticket")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async socketTicket(@Req() req: Request) {
    const user = req.user as { id: string };
    const ticket = await this.auth.issueSocketTicket(user.id);
    return { ticket };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const { passwordHash: _passwordHash, ...user } = req.user as Record<
      string,
      unknown
    >;
    return user;
  }

  @Patch("change-password")
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const user = req.user as { id: string };
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { success: true };
  }
}
