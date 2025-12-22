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
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { AuthService, TelegramAuthData } from '../auth.service';
import { JwtAuthService, TokenPair } from '../services/jwt.service';
import { CsrfService } from '../services/csrf.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt-auth.guard';
import { LoginRequestDto } from '../dto/login-request.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { RefreshRequestDto } from '../dto/refresh-request.dto';
import { RefreshResponseDto } from '../dto/refresh-response.dto';
import { TelegramPhoneRequestDto } from '../dto/telegram-phone-request.dto';
import { TelegramPhoneVerifyDto } from '../dto/telegram-phone-verify.dto';
import { TelegramAuthResponseDto } from '../dto/telegram-auth-response.dto';
import { TelegramQrGenerateResponseDto } from '../dto/telegram-qr-generate.dto';
import { TelegramQrStatusResponseDto, QrTokenStatus } from '../dto/telegram-qr-status.dto';
import { Telegram2FAVerifyDto } from '../dto/telegram-2fa-verify.dto';

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
      // Получаем refresh token из body или из cookies (приоритет cookies, так как они httpOnly)
      const refreshTokenFromCookie = req.cookies?.refresh_token;
      const refreshTokenFromBody = refreshDto.refreshToken;
      const refreshToken = refreshTokenFromCookie || refreshTokenFromBody;
      
      this.logger.debug(`Refresh request: hasCookie=${!!refreshTokenFromCookie}, hasBody=${!!refreshTokenFromBody}, ip=${req.ip}`);
      this.logger.debug(`Cookies received: ${JSON.stringify(Object.keys(req.cookies || {}))}`);
      this.logger.debug(`Refresh token from cookie length: ${refreshTokenFromCookie?.length || 0}, from body length: ${refreshTokenFromBody?.length || 0}`);
      
      if (!refreshToken) {
        this.logger.warn('Refresh token отсутствует в cookies и body', {
          cookies: Object.keys(req.cookies || {}),
          hasBody: !!refreshTokenFromBody,
          cookieValue: refreshTokenFromCookie ? 'present' : 'missing',
          bodyValue: refreshTokenFromBody ? 'present' : 'missing',
        });
        throw new UnauthorizedException('Refresh token is required');
      }
      
      // Логируем хеш токена для отладки (первые 8 символов)
      const tokenHashPreview = refreshToken.substring(0, 8) + '...';
      this.logger.debug(`Attempting to refresh token with hash preview: ${tokenHashPreview}`);

      // Обновляем токены
      const tokenPair = await this.jwtService.refreshTokens(
        refreshToken,
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
      this.logger.error(`Ошибка обновления токенов: ${error.message}`, error.stack);
      // Если это ошибка валидации токена, возвращаем более информативное сообщение
      if (error.message?.includes('expired')) {
        throw new UnauthorizedException('Refresh token expired');
      }
      if (error.message?.includes('not found') || error.message?.includes('Invalid')) {
        throw new UnauthorizedException('Invalid refresh token');
      }
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
    // Используем 'lax' вместо 'strict' для работы через прокси/nginx
    res.cookie('access_token', tokenPair.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax', // Изменено с 'strict' на 'lax' для работы через прокси
      maxAge: 15 * 60 * 1000, // 15 минут
      path: '/',
    });

    // Refresh token в httpOnly cookie (недоступен JS)
    // Срок жизни зависит от rememberMe: 30 дней если true, 7 дней если false
    const refreshTokenMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    res.cookie('refresh_token', tokenPair.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax', // Изменено с 'strict' на 'lax' для работы через прокси
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

  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Авторизация через Telegram Mini App' })
  @ApiResponse({
    status: 200,
    description: 'Успешная авторизация через Telegram Mini App',
  })
  @ApiResponse({ status: 401, description: 'Неверные данные авторизации' })
  async telegramAuth(
    @Body() data: TelegramAuthData,
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    console.log(`[TELEGRAM AUTH] Telegram Mini App авторизация: ${data.id}`);
    console.log(`[TELEGRAM AUTH] Полученные данные:`, JSON.stringify({ ...data, hash: data.hash ? `${data.hash.substring(0, 20)}...` : 'empty' }, null, 2));
    this.logger.log(`[TELEGRAM AUTH] Telegram Mini App авторизация: ${data.id}`);
    this.logger.log(`[TELEGRAM AUTH] Полученные данные: ${JSON.stringify({ ...data, hash: data.hash ? `${data.hash.substring(0, 20)}...` : 'empty' })}`);
    try {
      const user = await this.authService.validateTelegramAuth(data);
      
      // Генерируем JWT токены для авторизации в приложении
      const tokenPair = await this.jwtService.generateTokenPair(
        user,
        req.ip,
        req.get('user-agent'),
        false,
      );

      // Устанавливаем cookies
      this.setAuthCookies(res, tokenPair, false);

      const csrfToken = this.csrfService.generateCsrfToken();
      this.setCsrfCookie(res, csrfToken);

      // Логируем вход
      await this.authService.logAuthAction(
        user.id,
        await this.getAuthAction('LOGIN'),
        req.ip,
        req.get('user-agent'),
      );

      this.logger.log(`Успешная авторизация через Telegram Mini App: ${data.id}`);

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
      this.logger.error(`Ошибка авторизации через Telegram Mini App: ${error.message}`);
      throw error;
    }
  }

  @Post('telegram/phone/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Запрос кода подтверждения для авторизации по номеру телефона' })
  @ApiResponse({
    status: 200,
    description: 'Код отправлен',
    schema: {
      type: 'object',
      properties: {
        phoneCodeHash: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Неверный номер телефона или ошибка отправки кода' })
  async requestPhoneCode(
    @Body() dto: TelegramPhoneRequestDto,
    @Request() req,
  ): Promise<{ phoneCodeHash: string }> {
    this.logger.debug(`Запрос кода для телефона: ${dto.phoneNumber}`);
    try {
      // Передаем userId авторизованного пользователя, если он есть
      const authenticatedUserId = req.user?.sub || undefined;
      return await this.authService.requestPhoneCode(dto.phoneNumber, authenticatedUserId);
    } catch (error: any) {
      this.logger.error(`Ошибка запроса кода: ${error.message}`);
      throw error;
    }
  }

  @Post('telegram/phone/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверка кода подтверждения и авторизация по номеру телефона' })
  @ApiResponse({
    status: 200,
    description: 'Успешная авторизация',
    type: TelegramAuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неверный код или ошибка авторизации' })
  async verifyPhoneCode(
    @Body() dto: TelegramPhoneVerifyDto,
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<TelegramAuthResponseDto> {
    this.logger.log(`[Phone Verify] Запрос на проверку кода для телефона: ${dto?.phoneNumber || 'не указан'}`);
    this.logger.log(`[Phone Verify] Полученные данные: phoneNumber=${dto?.phoneNumber || 'не указан'}, code=${dto?.code ? '***' : 'не указан'}, phoneCodeHash=${dto?.phoneCodeHash ? dto.phoneCodeHash.substring(0, 20) + '...' : 'не указан'}`);
    try {
      // Сессия сохраняется для пользователя, найденного/созданного по телефону
      const result = await this.authService.verifyPhoneCode(
        dto.phoneNumber,
        dto.code,
        dto.phoneCodeHash,
        req.ip,
        req.get('user-agent'),
      );

      if (result.requires2FA) {
        return {
          success: false,
          requires2FA: true,
          passwordHint: result.passwordHint,
        };
      }

      // НЕ устанавливаем cookies - авторизация Telegram не должна авторизовывать в дашборде
      // Только создаем Telegram сессию для работы с Telegram API

      this.logger.log(`Telegram сессия создана по телефону: ${dto.phoneNumber}`);

      return {
        success: true,
        requires2FA: false,
        user: {
          id: result.user.id,
          phoneNumber: result.user.phone,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          username: result.user.username,
        },
        tokens: null, // Не возвращаем токены для дашборда
      };
    } catch (error: any) {
      this.logger.error(`Ошибка проверки кода: ${error.message}`);
      throw error;
    }
  }

  @Post('telegram/qr/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Генерация QR-кода для авторизации через Telegram' })
  @ApiResponse({
    status: 200,
    description: 'QR-код успешно сгенерирован',
    type: TelegramQrGenerateResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Ошибка генерации QR-кода' })
  async generateQrCode(): Promise<TelegramQrGenerateResponseDto> {
    this.logger.debug('Запрос на генерацию QR-кода');
    try {
      return await this.authService.generateQrCode();
    } catch (error: any) {
      this.logger.error(`Ошибка генерации QR-кода: ${error.message}`);
      throw error;
    }
  }

  @Get('telegram/qr/status/:tokenId')
  @UseGuards(OptionalJwtAuthGuard) // Опциональный guard - если токен есть, req.user будет доступен
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Проверка статуса QR токена' })
  @ApiResponse({
    status: 200,
    description: 'Статус токена',
    type: TelegramQrStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'QR токен не найден или истек' })
  async checkQrTokenStatus(
    @Param('tokenId') tokenId: string,
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<TelegramQrStatusResponseDto> {
    this.logger.debug(`Проверка статуса QR токена: ${tokenId}`);
    
    // ВАЖНО: Telegram авторизация доступна только для авторизованных админов
    // Если нет JWT - выбрасываем ошибку
    if (!req.user?.sub) {
      this.logger.warn('[QR] Попытка проверки статуса QR токена без JWT токена');
      throw new UnauthorizedException('Telegram авторизация доступна только для авторизованных пользователей админ-панели');
    }
    
    try {
      // Передаем userId из JWT для сохранения сессии
      const result = await this.authService.checkQrTokenStatus(tokenId, req.user?.sub);

      if (result.status === 'accepted' && result.user) {
        // НЕ устанавливаем cookies - авторизация Telegram не должна авторизовывать в дашборде
        // Только создаем Telegram сессию для работы с Telegram API

        this.logger.log(`Telegram сессия создана через QR для пользователя: ${result.user.id}`);
      }

      return {
        status: result.status as QrTokenStatus,
        user: result.user
          ? {
              id: result.user.id,
              phoneNumber: result.user.phone,
              firstName: result.user.firstName,
              lastName: result.user.lastName,
              username: result.user.username,
            }
          : undefined,
        tokens: result.tokens,
        expiresAt: result.expiresAt,
        timeRemaining: result.timeRemaining,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка проверки статуса QR токена: ${error.message}`);
      throw error;
    }
  }

  @Post('telegram/2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Проверка 2FA пароля и завершение авторизации' })
  @ApiResponse({
    status: 200,
    description: 'Успешная авторизация с 2FA',
    type: TelegramAuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Неверный 2FA пароль или ошибка авторизации' })
  async verify2FA(
    @Body() dto: Telegram2FAVerifyDto,
    @Request() req,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<TelegramAuthResponseDto> {
    this.logger.log(`[2FA] Запрос на проверку 2FA для телефона: ${dto.phoneNumber}, phoneCodeHash: ${dto.phoneCodeHash}`);
    this.logger.log(`[2FA] Пароль получен: ${dto.password ? 'да' : 'нет'}, длина: ${dto.password?.length || 0}`);
    this.logger.debug(`[2FA] Получен DTO: ${JSON.stringify(dto)}`); // Добавлено логирование DTO
    try {
      // Сессия сохраняется для пользователя, найденного/созданного по телефону
      const result = await this.authService.verify2FAPassword(
        dto.phoneNumber,
        dto.password,
        dto.phoneCodeHash,
        req.ip,
        req.get('user-agent'),
      );

      // НЕ устанавливаем cookies - авторизация Telegram не должна авторизовывать в дашборде
      // Только создаем Telegram сессию для работы с Telegram API

      this.logger.log(`Telegram сессия создана с 2FA: ${dto.phoneNumber}`);

      return {
        success: true,
        requires2FA: false,
        user: {
          id: result.user.id,
          phoneNumber: result.user.phone,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          username: result.user.username,
        },
        tokens: null, // Не возвращаем токены для дашборда
      };
    } catch (error: any) {
      this.logger.error(`Ошибка проверки 2FA: ${error.message}`, error.stack);
      this.logger.error(`Request data: phoneNumber=${dto.phoneNumber}, phoneCodeHash=${dto.phoneCodeHash}`);
      throw error;
    }
  }

  private async getAuthAction(action: string) {
    // Импорт AuthAction enum
    const { AuthAction } = await import('../../../entities/auth-log.entity');
    return AuthAction[action as keyof typeof AuthAction];
  }
}
