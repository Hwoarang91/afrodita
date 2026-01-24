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
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRequest } from '../../common/types/request.types';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService, TelegramAuthData } from './auth.service';
import { JwtAuthService } from './services/jwt.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtAuthService: JwtAuthService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Авторизация по email и паролю' })
  @ApiResponse({ status: 200, description: 'Успешная авторизация' })
  @ApiResponse({ status: 401, description: 'Неверные данные авторизации' })
  async login(@Body() loginDto: LoginDto, @Request() req: AuthRequest) {
    this.logger.debug(`Запрос на вход: email=${loginDto.email}`);
    try {
      const user = await this.authService.validateEmailPassword(
        loginDto.email,
        loginDto.password,
      );
      // Используем JwtAuthService для генерации токенов
      const tokenPair = await this.jwtAuthService.generateTokenPair(
        user,
        req.ip,
        req.get('user-agent'),
        false, // rememberMe=false по умолчанию для старого контроллера
      );

      // Логируем вход
      await this.authService.logAuthAction(
        user.id,
        await this.getAuthAction('LOGIN'),
        req.ip,
        req.get('user-agent'),
      );

      this.logger.log(`Успешный вход: ${loginDto.email}`);
      return {
        accessToken: tokenPair.accessToken,
        token: tokenPair.accessToken, // Для совместимости
        refreshToken: tokenPair.refreshToken,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          role: user.role,
          bonusPoints: user.bonusPoints,
        },
      };
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
  async telegramAuth(@Body() data: TelegramAuthData, @Request() req: AuthRequest) {
    const user = await this.authService.validateTelegramAuth(data);
    // Используем JwtAuthService для генерации токенов
    const tokenPair = await this.jwtAuthService.generateTokenPair(
      user,
      req.ip,
      req.get('user-agent'),
      false, // rememberMe=false по умолчанию
    );

    // Логируем вход
    await this.authService.logAuthAction(
      user.id,
      await this.getAuthAction('LOGIN'),
      req.ip,
      req.get('user-agent'),
    );

    return {
      accessToken: tokenPair.accessToken,
      token: tokenPair.accessToken, // Для совместимости
      refreshToken: tokenPair.refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
        bonusPoints: user.bonusPoints,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление токена' })
  @ApiResponse({ status: 200, description: 'Токен обновлен' })
  @ApiResponse({ status: 401, description: 'Неверный refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string, @Request() req: AuthRequest) {
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
  async logout(@Request() req: AuthRequest) {
    return await this.authService.logout(req.user!.sub!, req.ip, req.get('user-agent'));
  }

  @Post('phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновление номера телефона' })
  async updatePhone(@Request() req: AuthRequest, @Body() dto: UpdatePhoneDto) {
    return await this.authService.updatePhone(req.user!.sub!, dto.phone);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение текущего пользователя' })
  async getMe(@Request() req: AuthRequest) {
    if (!req.user) {
      this.logger.warn('getMe: req.user не установлен');
      throw new UnauthorizedException('User not authenticated');
    }
    
    this.logger.debug(`getMe: Возвращаем данные пользователя: ${req.user.email || req.user.sub}`);
    
    // Возвращаем только необходимые поля пользователя
    return {
      id: req.user.sub || req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: req.user.role,
      bonusPoints: req.user.bonusPoints || 0,
    };
  }

  @Get('check-setup')
  @ApiOperation({ summary: 'Проверка наличия администраторов в системе' })
  @ApiResponse({ status: 200, description: 'Статус настройки системы' })
  async checkSetup() {
    const hasUsers = await this.authService.checkHasUsers();
    return { hasUsers, needsSetup: !hasUsers };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Регистрация первого администратора' })
  @ApiResponse({ status: 201, description: 'Администратор успешно зарегистрирован' })
  @ApiResponse({ status: 400, description: 'Администратор уже существует' })
  async register(@Body() registerDto: RegisterDto, @Request() req: AuthRequest) {
    this.logger.debug(`Запрос на регистрацию: email=${registerDto.email}`);
    try {
      const result = await this.authService.registerFirstAdmin(
        registerDto.email,
        registerDto.password,
        registerDto.firstName ?? '',
        registerDto.lastName,
        req.ip,
        req.get('user-agent'),
      );
      this.logger.log(`Успешная регистрация первого администратора: ${registerDto.email}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка регистрации для ${registerDto.email}: ${error.message}`);
      throw error;
    }
  }

  private async getAuthAction(action: string) {
    // Импорт AuthAction enum
    const { AuthAction } = await import('../../entities/auth-log.entity');
    return AuthAction[action as keyof typeof AuthAction];
  }
}

