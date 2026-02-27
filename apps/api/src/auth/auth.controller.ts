import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { LoginRequestDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CurrentPrincipal,
  CurrentPrincipalData,
} from './decorators/current-principal.decorator';
import { LoginResponseDto } from '@govmunicipio/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginRequestDto): Promise<LoginResponseDto> {
    const principal = await this.authService.validatePrincipal(
      loginDto.username,
      loginDto.password,
    );

    return this.authService.login(principal.id, loginDto.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(
    @CurrentPrincipal() currentPrincipal: CurrentPrincipalData,
  ): Promise<CurrentPrincipalData> {
    return currentPrincipal;
  }

  @Post('otp/request')
  async requestOtp(@Body() dto: RequestOtpDto): Promise<{ code: string }> {
    const code = await this.otpService.requestOtp(dto.username);
    return { code };
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ message: string }> {
    await this.otpService.verifyOtp(dto.username, dto.code, dto.newPassword);
    return { message: 'Password updated successfully' };
  }
}
