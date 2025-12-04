import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService, TelegramAuthData } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Авторизация по email и паролю' })
  @ApiResponse({ status: 200, description: 'Успешная авторизация' })
  @ApiResponse({ status: 401, description: 'Неверные данные авторизации' })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    this.logger.debug(`Запрос на вход: email=${loginDto.email}`);
    try {
      const user = await this.authService.validateEmailPassword(
        loginDto.email,
        loginDto.password,
      );
      const result = await this.authService.login(
        user,
        req.ip,
        req.get('user-agent'),
      );
      this.logger.log(`Успешный вход: ${loginDto.email}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка входа для ${loginDto.email}: ${error.message}`);
      throw error;
    }
  }

  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Авторизация через Telegram' })
  @ApiResponse({ status: 200, description: 'Успешная авторизация' })
  @ApiResponse({ status: 401, description: 'Неверные данные авторизации' })
  async telegramAuth(@Body() data: TelegramAuthData, @Request() req) {
    const user = await this.authService.validateTelegramAuth(data);
    return await this.authService.login(
      user,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление токена' })
  @ApiResponse({ status: 200, description: 'Токен обновлен' })
  @ApiResponse({ status: 401, description: 'Неверный refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string, @Request() req) {
    return await this.authService.refreshToken(
      refreshToken,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход из системы' })
  async logout(@Body('refreshToken') refreshToken: string, @Request() req) {
    return await this.authService.logout(
      refreshToken,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Post('phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновление номера телефона' })
  async updatePhone(@Request() req, @Body() dto: UpdatePhoneDto) {
    return await this.authService.updatePhone(req.user.sub, dto.phone);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение текущего пользователя' })
  async getMe(@Request() req) {
    return req.user;
  }
}

