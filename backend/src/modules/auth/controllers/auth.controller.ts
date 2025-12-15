import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Response,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { AuthService } from '../auth.service';
import { JwtAuthService, TokenPair } from '../services/jwt.service';
import { CsrfService } from '../services/csrf.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LoginRequestDto } from '../dto/login-request.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { RefreshRequestDto } from '../dto/refresh-request.dto';
import { RefreshResponseDto } from '../dto/refresh-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtAuthService,
    private readonly csrfService: CsrfService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Авторизация по email и паролю' })
  @ApiResponse({
    status: 200,
    description: 'Успешная авторизация',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неверные данные авторизации' })
  async login(
    @Body() loginDto: LoginRequestDto,
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponseDto> {
    this.logger.debug(`Запрос на вход: email=${loginDto.email}`);

    try {
      // Валидируем пользователя
      const user = await this.authService.validateEmailPassword(
        loginDto.email,
        loginDto.password,
      );

      // Генерируем токены с учетом rememberMe
      const rememberMe = loginDto.rememberMe ?? false;
      const tokenPair = await this.jwtService.generateTokenPair(
        user,
        req.ip,
        req.get('user-agent'),
        rememberMe,
      );

      // Устанавливаем httpOnly cookies с учетом rememberMe
      this.setAuthCookies(res, tokenPair, rememberMe);

      // Генерируем CSRF токен
      const csrfToken = this.csrfService.generateCsrfToken();
      this.setCsrfCookie(res, csrfToken);

      // Логируем успешный вход
      await this.authService.logAuthAction(
        user.id,
        await this.getAuthAction('LOGIN'),
        req.ip,
        req.get('user-agent'),
      );

      this.logger.log(`Успешный вход: ${loginDto.email}`);

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        accessTokenExpiresAt: tokenPair.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          bonusPoints: user.bonusPoints,
        },
      };
    } catch (error: any) {
      this.logger.error(`Ошибка входа для ${loginDto.email}: ${error.message}`);
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Обновление токенов' })
  @ApiResponse({
    status: 200,
    description: 'Токены обновлены',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неверный refresh token' })
  async refresh(
    @Body() refreshDto: RefreshRequestDto,
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<RefreshResponseDto> {
    try {
      // Обновляем токены
      const tokenPair = await this.jwtService.refreshTokens(
        refreshDto.refreshToken,
        req.ip,
        req.get('user-agent'),
      );

      // Определяем rememberMe по сроку жизни refresh token (30 дней = rememberMe, 7 дней = нет)
      const refreshTokenDays = Math.round(
        (tokenPair.refreshTokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      const rememberMe = refreshTokenDays >= 30;

      // Устанавливаем новые httpOnly cookies
      this.setAuthCookies(res, tokenPair, rememberMe);

      // Генерируем новый CSRF токен
      const csrfToken = this.csrfService.generateCsrfToken();
      this.setCsrfCookie(res, csrfToken);

      this.logger.log('Токены успешно обновлены');

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        accessTokenExpiresAt: tokenPair.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка обновления токенов: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход из системы' })
  async logout(
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ message: string }> {
    try {
      const user = req.user;

      // Инвалидируем все refresh tokens пользователя
      await this.jwtService.logout(user.sub);

      // Очищаем cookies
      this.clearAuthCookies(res);
      this.clearCsrfCookie(res);

      // Логируем выход
      await this.authService.logAuthAction(
        user.sub,
        await this.getAuthAction('LOGOUT'),
        req.ip,
        req.get('user-agent'),
      );

      this.logger.log(`Пользователь ${user.sub} вышел из системы`);

      return { message: 'Logged out successfully' };
    } catch (error: any) {
      this.logger.error(`Ошибка выхода: ${error.message}`);
      throw error;
    }
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход из системы на всех устройствах' })
  async logoutAll(
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ message: string }> {
    try {
      const user = req.user;

      // Инвалидируем все refresh tokens пользователя на всех устройствах
      await this.jwtService.logoutAllDevices(user.sub);

      // Очищаем cookies
      this.clearAuthCookies(res);
      this.clearCsrfCookie(res);

      this.logger.log(`Пользователь ${user.sub} вышел из системы на всех устройствах`);

      return { message: 'Logged out from all devices' };
    } catch (error: any) {
      this.logger.error(`Ошибка выхода со всех устройств: ${error.message}`);
      throw error;
    }
  }

  @Get('csrf-token')
  @ApiOperation({ summary: 'Получение CSRF токена' })
  async getCsrfToken(@Response({ passthrough: true }) res: ExpressResponse): Promise<{ csrfToken: string }> {
    const csrfToken = this.csrfService.generateCsrfToken();
    this.setCsrfCookie(res, csrfToken);

    return { csrfToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение текущего пользователя' })
  async getMe(@Request() req) {
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
  async register(
    @Body() registerDto: any, // TODO: Create proper DTO
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    this.logger.debug(`Запрос на регистрацию: email=${registerDto.email}`);

    try {
      const result = await this.authService.registerFirstAdmin(
        registerDto.email,
        registerDto.password,
        registerDto.firstName,
        registerDto.lastName,
        req.ip,
        req.get('user-agent'),
      );

      // Устанавливаем cookies для нового администратора (rememberMe=false при регистрации)
      const tokenPair: TokenPair = {
        accessToken: result.token,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      this.setAuthCookies(res, tokenPair, false);

      const csrfToken = this.csrfService.generateCsrfToken();
      this.setCsrfCookie(res, csrfToken);

      this.logger.log(`Успешная регистрация первого администратора: ${registerDto.email}`);

      return result;
    } catch (error: any) {
      this.logger.error(`Ошибка регистрации для ${registerDto.email}: ${error.message}`);
      throw error;
    }
  }

  private setAuthCookies(res: ExpressResponse, tokenPair: TokenPair, rememberMe: boolean = false): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token в httpOnly cookie (недоступен JS)
    res.cookie('access_token', tokenPair.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 минут
      path: '/',
    });

    // Refresh token в httpOnly cookie (недоступен JS)
    // Срок жизни зависит от rememberMe: 30 дней если true, 7 дней если false
    const refreshTokenMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    res.cookie('refresh_token', tokenPair.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: refreshTokenMaxAge,
      path: '/',
    });
  }

  private clearAuthCookies(res: ExpressResponse): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  private setCsrfCookie(res: ExpressResponse, csrfToken: string): void {
    const options = this.csrfService.getCsrfCookieOptions();
    res.cookie('csrf_token', csrfToken, options);
  }

  private clearCsrfCookie(res: ExpressResponse): void {
    res.clearCookie('csrf_token', { path: '/' });
  }

  private async getAuthAction(action: string) {
    // Импорт AuthAction enum
    const { AuthAction } = await import('../../../entities/auth-log.entity');
    return AuthAction[action as keyof typeof AuthAction];
  }
}
