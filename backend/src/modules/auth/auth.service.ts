import { Injectable, UnauthorizedException, Logger, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';
import { Request } from 'express';
import { ErrorCode } from '../../common/interfaces/error-response.interface';
import { buildErrorResponse } from '../../common/utils/error-response.builder';
import { getErrorMessage, getErrorStack } from '../../common/utils/error-message';
import { mapTelegramErrorToResponse } from '../telegram-user-api/utils/telegram-error-mapper';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../../entities/user.entity';
import { AuthLog, AuthAction } from '../../entities/auth-log.entity';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ReferralService } from '../users/referral.service';
import { JwtAuthService } from './services/jwt.service';
import { TelegramUserClientService } from '../telegram-user-api/services/telegram-user-client.service';
import { Client, checkPassword } from '@mtkruto/node';
import { validate } from '@tma.js/init-data-node';
import { v4 as uuidv4 } from 'uuid';

export interface TelegramAuthData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  phone?: string;
  auth_date: number;
  hash: string;
  user?: string; // Оригинальная JSON строка из initData (для валидации hash)
  query_id?: string; // query_id из initData (если есть)
  signature?: string; // signature из initData (Bot API 8.0+, не включается в data_check_string)
  initData?: string; // Оригинальная initData строка для валидации (альтернативный способ)
}

export interface JwtPayload {
  sub: string;
  telegramId?: string;
  role: UserRole;
  email?: string;
}

export interface AuthUserResponse {
  id: string;
  telegramId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  role: string;
  bonusPoints: number;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);

  // Интервал периодической очистки (5 минут)
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Временное хранилище для phone code hash (в production лучше использовать Redis)
  // Теперь храним sessionId для правильного lifecycle
  private phoneCodeHashStore: Map<string, { hash: string; client: Client; sessionId: string; expiresAt: Date }> = new Map();

  // Временное хранилище для QR токенов (в production лучше использовать Redis)
  // Теперь храним sessionId для правильного lifecycle
  private qrTokenStore: Map<
    string,
    {
      token: Uint8Array;
      client: Client;
      sessionId: string;
      expiresAt: Date;
      status: 'pending' | 'accepted' | 'expired';
      user?: User;
      tokens?: { accessToken: string; refreshToken: string };
    }
  > = new Map();

  // Временное хранилище для 2FA данных (в production лучше использовать Redis)
  // Теперь храним sessionId для правильного lifecycle
  private twoFactorStore: Map<
    string,
    {
      client: Client;
      sessionId: string;
      phoneCodeHash: string;
      expiresAt: Date;
      passwordHint?: string;
    }
  > = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuthLog)
    private authLogRepository: Repository<AuthLog>,
    private configService: ConfigService,
    private usersService: UsersService,
    private referralService: ReferralService,
    private jwtAuthService: JwtAuthService,
    private telegramUserClientService: TelegramUserClientService,
  ) {
    // Запускаем периодическую очистку истекших сессий каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredPhoneCodeHashes();
      this.cleanExpired2FASessions();
      this.cleanExpiredQrTokens();
    }, 5 * 60 * 1000);
  }

  /**
   * Очистка ресурсов при остановке модуля
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Отключаем все клиенты в хранилищах
    this.disconnectAllClients();
  }

  /**
   * Безопасное отключение клиента с обработкой ошибок
   */
  private async safeDisconnectClient(client: Client, context: string): Promise<void> {
    try {
      if (client && client.connected) {
        await client.disconnect();
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to disconnect client (${context}): ${getErrorMessage(error)}`);
    }
  }

  /**
   * Отключает все клиенты во всех хранилищах
   */
  private async disconnectAllClients(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    // Отключаем клиенты из phoneCodeHashStore
    for (const [phone, stored] of this.phoneCodeHashStore.entries()) {
      disconnectPromises.push(this.safeDisconnectClient(stored.client, `phoneCodeHash:${phone}`));
    }

    // Отключаем клиенты из twoFactorStore
    for (const [phone, stored] of this.twoFactorStore.entries()) {
      disconnectPromises.push(this.safeDisconnectClient(stored.client, `twoFactor:${phone}`));
    }

    // Отключаем клиенты из qrTokenStore
    for (const [tokenId, stored] of this.qrTokenStore.entries()) {
      disconnectPromises.push(this.safeDisconnectClient(stored.client, `qrToken:${tokenId}`));
    }

    await Promise.allSettled(disconnectPromises);
    
    this.phoneCodeHashStore.clear();
    this.twoFactorStore.clear();
    this.qrTokenStore.clear();
    
    this.logger.log('All auth clients disconnected and stores cleared');
  }

  /**
   * Очистка истекших 2FA сессий с отключением клиентов
   */
  private cleanExpired2FASessions(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [phone, stored] of this.twoFactorStore.entries()) {
      if (stored.expiresAt < now) {
        this.safeDisconnectClient(stored.client, `expired2FA:${phone}`);
        this.twoFactorStore.delete(phone);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} expired 2FA sessions`);
    }
  }

  /**
   * Очистка истекших QR токенов с отключением клиентов
   */
  private cleanExpiredQrTokens(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [tokenId, stored] of this.qrTokenStore.entries()) {
      if (stored.expiresAt < now) {
        this.safeDisconnectClient(stored.client, `expiredQR:${tokenId}`);
        this.qrTokenStore.delete(tokenId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned ${cleaned} expired QR tokens`);
    }
  }

  async validateEmailPassword(email: string, password: string): Promise<User> {
    this.logger.debug(`Попытка входа: email=${email}`);
    // Поиск пользователя без учета регистра email (email обычно не чувствителен к регистру)
    // Используем createQueryBuilder для case-insensitive поиска
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.email)) = :normalizedEmail', { normalizedEmail })
      .getOne();

    if (!user) {
      this.logger.warn(`Пользователь не найден: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.password) {
        this.logger.warn(`У пользователя нет пароля: ${email}`);
        throw new UnauthorizedException('Invalid email or password');
      }

    this.logger.debug(`Пользователь найден, проверка пароля: ${email}`);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Неверный пароль для: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      this.logger.warn(`Аккаунт неактивен: ${email}`);
      throw new UnauthorizedException('User account is inactive');
    }

    this.logger.log(`Успешная аутентификация: ${email}`);
    return user;
  }

  async validateTelegramAuth(data: TelegramAuthData): Promise<User> {
    this.logger.log(`[TELEGRAM AUTH] validateTelegramAuth called with data: ${JSON.stringify(data)}`);
    // Валидация Telegram auth data
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.logger.log(`[TELEGRAM AUTH] Bot token exists: ${!!botToken}, length: ${botToken?.length || 0}`);
    if (!botToken) {
      throw new UnauthorizedException('Telegram bot not configured');
    }
    const isValid = this.verifyTelegramAuth(data, botToken);
    this.logger.log(`[TELEGRAM AUTH] verifyTelegramAuth result: ${isValid}`);
    if (!isValid) {
      this.logger.error(`Telegram auth validation failed for user id: ${data.id}`);
      throw new UnauthorizedException('Invalid Telegram authentication');
    }

    // Поиск пользователя по Telegram ID
    let user = await this.userRepository.findOne({
      where: { telegramId: data.id },
    });

    // Если пользователь не найден по Telegram ID, но есть телефон в данных
    // (хотя в Telegram Mini App обычно нет телефона, но на всякий случай)
    if (!user && data.phone) {
      const normalizedPhone = this.usersService.normalizePhone(data.phone);
      user = await this.userRepository.findOne({
        where: { phone: normalizedPhone },
      });
      
      if (user) {
        // Объединяем: добавляем Telegram ID к существующему пользователю
        // Роль пользователя сохраняется (может быть ADMIN, MASTER или CLIENT)
        user.telegramId = data.id;
        user.firstName = data.first_name || user.firstName;
        user.lastName = data.last_name || user.lastName;
        user.username = data.username || user.username;
        await this.userRepository.save(user);
        return user;
      }
    }

    if (!user) {
      // Создаем нового пользователя с ролью CLIENT по умолчанию
      // Роль можно будет изменить через админ-панель позже
      user = this.userRepository.create({
        telegramId: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        username: data.username,
        role: UserRole.CLIENT,
      });
      await this.userRepository.save(user);

      // Обрабатываем реферальную регистрацию для нового пользователя
      try {
        await this.referralService.processReferralRegistration(user.id);
        this.logger.log(`Обработана регистрация через Telegram Web App для пользователя ${user.id}`);
      } catch (error: unknown) {
        this.logger.error(`Ошибка обработки реферальной регистрации: ${getErrorMessage(error)}`);
      }
    } else {
      // Обновление данных существующего пользователя
      // Роль сохраняется (если пользователь был назначен админом/мастером через админ-панель)
      user.firstName = data.first_name;
      user.lastName = data.last_name ?? user.lastName;
      user.username = data.username ?? user.username;
      // Роль НЕ меняется - она управляется через админ-панель
      await this.userRepository.save(user);
    }

    return user;
  }


  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    return this.jwtAuthService.refreshTokens(refreshToken, ipAddress, userAgent);
  }

  async logout(userId: string, ipAddress?: string, userAgent?: string) {
    await this.jwtAuthService.logout(userId);
    await this.logAuthAction(userId, AuthAction.LOGOUT, ipAddress, userAgent);
  }

  async validatePhone(phone: string): Promise<boolean> {
    // Простая валидация формата телефона
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  async updatePhone(userId: string, phone: string): Promise<User> {
    if (!(await this.validatePhone(phone))) {
      throw new UnauthorizedException('Invalid phone number format');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.phone = phone;
    return await this.userRepository.save(user);
  }

  private verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
    try {
      if (!botToken) {
        this.logger.error('TELEGRAM_BOT_TOKEN не установлен');
        return false;
      }

      // Используем официальную библиотеку @tma.js/init-data-node для валидации
      // Она правильно обрабатывает все нюансы Bot API 8.0+ включая signature
      if (data.initData) {
        this.logger.log(`[TELEGRAM AUTH] Using @tma.js/init-data-node for validation`);

        try {
          // Валидируем initData с помощью официальной библиотеки
          validate(data.initData, botToken);
          this.logger.log(`[TELEGRAM AUTH] Validation successful`);
          return true;
        } catch (error: unknown) {
          this.logger.log(`[TELEGRAM AUTH] Validation failed: ${getErrorMessage(error)}`);
          return false;
        }
      }

      // Fallback: если нет initData, используем старую логику (для обратной совместимости)
      this.logger.log(`[TELEGRAM AUTH] No initData provided, using fallback validation`);

      const crypto = require('crypto');

      if (!data.hash && !data.signature) {
        this.logger.error('Hash и signature отсутствуют в данных Telegram');
        return false;
      }

      // Fallback валидация для случаев, когда нет initData
      let dataCheckString: string;

      // Создаем копию данных без hash, photo_url и signature для проверки
      const { hash, photo_url, signature, ...userData } = data;

      // Создаем строку для проверки: сортируем ключи и формируем строку
      dataCheckString = Object.keys(userData)
        .sort()
        .filter((key: string) => {
          const value = (userData as Record<string, unknown>)[key];
          return value !== undefined && value !== null && value !== '';
        })
        .map((key: string) => {
          const value = (userData as Record<string, unknown>)[key];
          // Для числовых значений преобразуем в строку
          if (typeof value === 'number') {
            return `${key}=${value}`;
          }
          // Для строк используем как есть
          return `${key}=${value}`;
        })
        .join('\n');

      this.logger.log(`[TELEGRAM AUTH] Fallback dataCheckString: ${dataCheckString}`);

      // Вычисляем секретный ключ из bot token
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // Вычисляем хеш: HMAC-SHA-256 от data_check_string с секретным ключом
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      this.logger.log(`[TELEGRAM AUTH] Fallback calculated hash: ${calculatedHash}`);

      // Проверяем hash
      const isValid = calculatedHash === data.hash;

      if (!isValid) {
        this.logger.warn(`Telegram auth hash mismatch. Received: ${data.hash}, Calculated: ${calculatedHash}`);
      }

      return isValid;
    } catch (error: unknown) {
      this.logger.error(`Ошибка при проверке Telegram auth: ${getErrorMessage(error)}`, getErrorStack(error));
      return false;
    }
  }

  async checkHasUsers(): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });
    return count > 0;
  }

  async registerFirstAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; token: string; refreshToken: string; user: AuthUserResponse }> {
    // Проверяем, есть ли уже администраторы
    const hasAdmins = await this.checkHasUsers();
    if (hasAdmins) {
      throw new UnauthorizedException('Регистрация недоступна. Администратор уже существует.');
    }

    // Проверяем, не существует ли уже пользователь с таким email (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.email)) = :normalizedEmail', { normalizedEmail })
      .getOne();
    if (existingUser) {
      throw new UnauthorizedException('Пользователь с таким email уже существует');
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем администратора
    const admin = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      isActive: true,
    });

    const savedAdmin = await this.userRepository.save(admin);

    // Логируем регистрацию
    await this.logAuthAction(savedAdmin.id, AuthAction.LOGIN, ipAddress, userAgent);

    // Выполняем вход для нового администратора используя JwtAuthService
    const tokenPair = await this.jwtAuthService.generateTokenPair(
      savedAdmin,
      ipAddress,
      userAgent,
      false, // rememberMe=false при регистрации
    );

    return {
      accessToken: tokenPair.accessToken,
      token: tokenPair.accessToken, // Для совместимости с админкой
      refreshToken: tokenPair.refreshToken,
      user: {
        id: savedAdmin.id,
        telegramId: savedAdmin.telegramId,
        firstName: savedAdmin.firstName,
        lastName: savedAdmin.lastName,
        username: savedAdmin.username,
        email: savedAdmin.email,
        role: savedAdmin.role,
        bonusPoints: savedAdmin.bonusPoints,
      },
    };
  }

  async logAuthAction(
    userId: string,
    action: AuthAction,
    ipAddress?: string,
    userAgent?: string,
    error?: string,
  ) {
    const log = this.authLogRepository.create({
      userId,
      action,
      ipAddress,
      userAgent,
      error,
    });
    await this.authLogRepository.save(log);
  }

  /**
   * Запрашивает код подтверждения для авторизации по номеру телефона
   */
  async requestPhoneCode(phoneNumber: string, authenticatedUserId?: string): Promise<{ phoneCodeHash: string }> {
    try {
      this.logger.debug(`Запрос кода для телефона: ${phoneNumber}, authenticatedUserId: ${authenticatedUserId || 'none'}`);

      // Валидация номера телефона
      if (!(await this.validatePhone(phoneNumber))) {
        throw new UnauthorizedException('Invalid phone number format');
      }

      // Получаем API credentials
      const apiIdStr = this.configService.get<string>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiIdStr || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
      }

      const apiId = parseInt(apiIdStr, 10);
      if (isNaN(apiId)) {
        throw new Error('TELEGRAM_API_ID must be a valid number');
      }

      // КРИТИЧЕСКИ ВАЖНО: Определяем userId для создания сессии
      // Если пользователь авторизован - используем его ID
      // Если нет - создаем временного пользователя в БД
      let userId: string;
      if (authenticatedUserId) {
        // Проверяем, что пользователь существует
        const user = await this.userRepository.findOne({ where: { id: authenticatedUserId } });
        if (!user) {
          const errorResponse = buildErrorResponse(
            HttpStatus.UNAUTHORIZED,
            ErrorCode.NOT_FOUND,
            'Authenticated user not found',
          );
          throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
        }
        userId = authenticatedUserId;
        this.logger.debug(`Using authenticated user ID: ${userId}`);
      } else {
        // Создаем временного пользователя в БД для сессии
        // Этот пользователь будет обновлен после успешной авторизации
        const normalizedPhone = this.usersService.normalizePhone(phoneNumber);
        const tempUser = this.userRepository.create({
          phone: normalizedPhone,
          role: UserRole.CLIENT,
          isActive: true,
        });
        const savedTempUser = await this.userRepository.save(tempUser);
        userId = savedTempUser.id;
        this.logger.debug(`Created temporary user for session: ${userId}, phone: ${normalizedPhone}`);
      }

      // КРИТИЧЕСКИ ВАЖНО: Создаем клиент с DatabaseStorage сразу
      // НЕ используем StorageMemory - это нарушает lifecycle MTKruto
      const { client, sessionId } = await this.telegramUserClientService.createClientForAuth(userId, apiId, apiHash);
      
      // КРИТИЧНО: Проверяем, что клиент подключен перед вызовом auth.sendCode
      if (!client.connected) {
        this.logger.warn(`[requestPhoneCode] Клиент не подключен, пытаемся подключиться...`);
        try {
          await client.connect();
          this.logger.log(`[requestPhoneCode] Клиент успешно подключен`);
        } catch (connectError: unknown) {
          this.logger.error(`[requestPhoneCode] Ошибка подключения клиента: ${getErrorMessage(connectError)}`, getErrorStack(connectError));
          const errorResponse = mapTelegramErrorToResponse(connectError);
          throw new HttpException(errorResponse, errorResponse.statusCode);
        }
      } else {
        this.logger.log(`[requestPhoneCode] Клиент уже подключен`);
      }

      // Вызываем auth.sendCode
      this.logger.log(`[requestPhoneCode] Вызываем auth.sendCode для телефона: ${phoneNumber}, apiId: ${apiId}, sessionId: ${sessionId}`);
      let result: any;
      try {
        result = await client.invoke({
          _: 'auth.sendCode',
          api_id: apiId,
          api_hash: apiHash,
          phone_number: phoneNumber,
          settings: {
            _: 'codeSettings',
            allow_appless: true, // Принудительно запрашиваем SMS, а не код в приложении
            // allow_flashcall не указываем - Telegram API не принимает false
          },
        } as any);
        this.logger.log(`[requestPhoneCode] auth.sendCode успешно выполнен, результат: ${result._}, phoneCodeHash: ${result.phone_code_hash ? result.phone_code_hash.substring(0, 20) + '...' : 'N/A'}`);
      } catch (invokeError: unknown) {
        this.logger.error(`[requestPhoneCode] Ошибка при вызове auth.sendCode: ${getErrorMessage(invokeError)}`, getErrorStack(invokeError));
        // КРИТИЧНО: Используем mapTelegramErrorToResponse для правильной обработки Telegram ошибок
        const errorResponse = mapTelegramErrorToResponse(invokeError);
        this.logger.error(`[requestPhoneCode] Mapped error: ${JSON.stringify(errorResponse)}`);
        throw new HttpException(errorResponse, errorResponse.statusCode);
      }

      if (result._ !== 'auth.sentCode') {
        this.logger.error(`[requestPhoneCode] Неожиданный результат от auth.sendCode: ${result._}, полный результат: ${JSON.stringify(result)}`);
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.INTERNAL_SERVER_ERROR,
          `Failed to send code: unexpected result type ${result._}`,
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }

      const phoneCodeHash = result.phone_code_hash;
      const timeout = result.timeout || 60;
      const expiresAt = new Date(Date.now() + timeout * 1000);
      
      // Логируем тип отправки кода для диагностики
      const codeType = result.type?._ || 'unknown';
      const codeTypeDetails = result.type ? JSON.stringify(result.type) : 'N/A';
      this.logger.log(`[requestPhoneCode] Код отправлен успешно, phoneCodeHash: ${phoneCodeHash.substring(0, 20)}..., timeout: ${timeout} секунд, type: ${codeType}`);
      this.logger.debug(`[requestPhoneCode] Детали типа отправки кода: ${codeTypeDetails}`);

      // КРИТИЧНО: Нормализуем номер телефона для единообразного хранения
      const normalizedPhone = this.usersService.normalizePhone(phoneNumber);

      // Сохраняем phone code hash, клиент и sessionId (временное решение, лучше использовать Redis)
      // Используем normalizedPhone как ключ для единообразия с twoFactorStore
      this.phoneCodeHashStore.set(normalizedPhone, {
        hash: phoneCodeHash,
        client,
        sessionId,
        expiresAt,
      });

      // Очищаем истекшие записи
      this.cleanExpiredPhoneCodeHashes();

      this.logger.log(`Code sent to phone: ${phoneNumber}`);

      return { phoneCodeHash };
    } catch (error: unknown) {
      this.logger.error(`Error requesting phone code: ${getErrorMessage(error)}`, getErrorStack(error));
      const errorResponse = mapTelegramErrorToResponse(error);
      throw new HttpException(errorResponse, errorResponse.statusCode);
    }
  }

  /**
   * Проверяет код подтверждения и выполняет авторизацию
   */
  async verifyPhoneCode(
    phoneNumber: string,
    code: string,
    phoneCodeHash: string,
    ipAddress?: string,
    userAgent?: string,
    expressRequest?: Request, // Express request для сохранения сессии в request.session
  ): Promise<{ user: User | null; tokens: { accessToken: string; refreshToken: string } | null; requires2FA: boolean; passwordHint?: string }> {
    try {
      // КРИТИЧНО: Нормализуем номер телефона для поиска в хранилище
      const normalizedPhone = this.usersService.normalizePhone(phoneNumber);
      
      this.logger.debug(`Проверка кода для телефона: ${phoneNumber} (normalized: ${normalizedPhone}), phoneCodeHash: ${phoneCodeHash}`);
      this.logger.debug(`Current phoneCodeHashStore size: ${this.phoneCodeHashStore.size}`);
      this.logger.debug(`Stored phones in phoneCodeHashStore: ${Array.from(this.phoneCodeHashStore.keys()).join(', ')}`);

      // Получаем сохраненный клиент и hash по нормализованному номеру
      let stored = this.phoneCodeHashStore.get(normalizedPhone);
      if (!stored || stored.hash !== phoneCodeHash) {
        // Пробуем найти по оригинальному номеру (для обратной совместимости)
        const altStored = this.phoneCodeHashStore.get(phoneNumber);
        if (altStored && altStored.hash === phoneCodeHash) {
          // Мигрируем на нормализованный ключ
          this.phoneCodeHashStore.delete(phoneNumber);
          this.phoneCodeHashStore.set(normalizedPhone, altStored);
          stored = this.phoneCodeHashStore.get(normalizedPhone);
        }
        if (!stored || stored.hash !== phoneCodeHash) {
          const err = buildErrorResponse(
            HttpStatus.UNAUTHORIZED,
            ErrorCode.SESSION_INVALID,
            'Неверный phone code hash. Начните авторизацию заново.',
          );
          throw new HttpException(err, HttpStatus.UNAUTHORIZED);
        }
      }

      if (stored.expiresAt < new Date()) {
        this.phoneCodeHashStore.delete(normalizedPhone);
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.PHONE_CODE_EXPIRED,
          'Срок действия кода истёк. Запросите новый код.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }

      const client = stored.client;

      // Вызываем auth.signIn
      let signInResult;
      try {
        signInResult = await client.invoke({
          _: 'auth.signIn',
          phone_number: phoneNumber,
          phone_code_hash: phoneCodeHash,
          phone_code: code,
        });
      } catch (error: unknown) {
        const errorResponse = mapTelegramErrorToResponse(error);
        if (errorResponse.errorCode === ErrorCode.PHONE_CODE_EXPIRED) {
          this.phoneCodeHashStore.delete(normalizedPhone);
        }
        if (errorResponse.errorCode === ErrorCode.INVALID_2FA_PASSWORD) {
          // Требуется 2FA - получаем подсказку пароля и сохраняем клиент
          this.logger.debug(`2FA required for phone: ${phoneNumber}, saving phoneCodeHash: ${phoneCodeHash}`);
          
          // Получаем подсказку пароля через account.getPassword
          let passwordHint: string | undefined;
          try {
            const passwordResult = await client.invoke({
              _: 'account.getPassword',
            });
            if (passwordResult._ === 'account.password' && (passwordResult as { hint?: string }).hint) {
              passwordHint = (passwordResult as { hint?: string }).hint;
              this.logger.debug(`Password hint retrieved: ${passwordHint}`);
            }
          } catch (hintError: unknown) {
            this.logger.warn(`Failed to get password hint: ${getErrorMessage(hintError)}`);
          }
          
          // КРИТИЧЕСКИ ВАЖНО: Получаем sessionId из phoneCodeHashStore по нормализованному номеру
          const phoneCodeStored = this.phoneCodeHashStore.get(normalizedPhone);
          if (!phoneCodeStored || !phoneCodeStored.sessionId) {
            // КРИТИЧНО: Используем HttpException с ErrorResponse вместо throw new Error
            const sessionErrorResponse = buildErrorResponse(
              HttpStatus.BAD_REQUEST,
              ErrorCode.SESSION_NOT_FOUND,
              'Session ID not found in phoneCodeHashStore for 2FA',
            );
            throw new HttpException(sessionErrorResponse, HttpStatus.BAD_REQUEST);
          }
          
          this.twoFactorStore.set(normalizedPhone, {
            client,
            sessionId: phoneCodeStored.sessionId,
            phoneCodeHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 минут
            passwordHint,
          });
          this.logger.debug(`2FA session saved for normalized phone: ${normalizedPhone}. Store size: ${this.twoFactorStore.size}, expiresAt: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()}, hint: ${passwordHint || 'none'}`);
          return {
            user: null,
            tokens: null,
            requires2FA: true,
            passwordHint,
          };
        }
        
        throw new HttpException(errorResponse, errorResponse.statusCode);
      }

      // Проверяем результат
      if (signInResult._ !== 'auth.authorization') {
        throw new UnauthorizedException('Authorization failed');
      }

      const authUser = signInResult.user;
      if (authUser._ !== 'user') {
        throw new UnauthorizedException('Invalid user data');
      }

      // normalizedPhone уже определен выше в начале метода

      // Ищем или создаем пользователя по телефону
      let user: User | null = await this.userRepository.findOne({
        where: { phone: normalizedPhone },
      });

      if (!user) {
        // Создаем нового пользователя
        user = this.userRepository.create({
          phone: normalizedPhone ?? undefined,
          firstName: authUser.first_name || null,
          lastName: authUser.last_name || null,
          username: authUser.username || null,
          telegramId: authUser.id.toString(),
          role: UserRole.CLIENT,
          isActive: true,
        } as DeepPartial<User>);
        await this.userRepository.save(user);
        this.logger.log(`Created new user for Telegram auth: ${user.id}, phone: ${normalizedPhone}`);
      } else {
        // Обновляем данные существующего пользователя
        user.firstName = authUser.first_name || user.firstName;
        user.lastName = authUser.last_name || user.lastName;
        user.username = authUser.username || user.username;
        if (!user.telegramId) {
          user.telegramId = authUser.id.toString();
        }
        await this.userRepository.save(user);
        this.logger.log(`Updated existing user for Telegram auth: ${user.id}, phone: ${normalizedPhone}`);
      }

      // КРИТИЧЕСКИ ВАЖНО: Получаем sessionId из phoneCodeHashStore по нормализованному номеру
      const phoneCodeStored = this.phoneCodeHashStore.get(normalizedPhone);
      if (!phoneCodeStored || !phoneCodeStored.sessionId) {
          // КРИТИЧНО: Используем HttpException с ErrorResponse вместо throw new Error
          const errorResponse = buildErrorResponse(
            HttpStatus.BAD_REQUEST,
            ErrorCode.SESSION_NOT_FOUND,
            'Session ID not found in phoneCodeHashStore',
          );
          throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
      }
      const sessionId = phoneCodeStored.sessionId;

      // Обновляем сессию в БД - меняем userId с временного на реальный
      // Находим сессию по sessionId и обновляем userId
      const session = await this.telegramUserClientService.getSessionById(sessionId);
      if (session) {
        session.userId = user.id;
        await this.telegramUserClientService.updateSession(session);
      }

      // Сохраняем сессию MTProto для пользователя, найденного/созданного по телефону
      this.logger.log(`Saving Telegram session for user ${user.id} (role: ${user.role}, phone: ${normalizedPhone}, telegramId: ${user.telegramId}), sessionId: ${sessionId}`);
      // КРИТИЧНО: saveSession() теперь сам сохраняет сессию в request.session если expressRequest передан
      await this.telegramUserClientService.saveSession(
        user.id,
        client,
        sessionId,
        normalizedPhone,
        ipAddress,
        userAgent,
        expressRequest, // КРИТИЧНО: Передаем expressRequest для сохранения в request.session
      );

      // Удаляем временные данные по нормализованному номеру
      this.phoneCodeHashStore.delete(normalizedPhone);

      // НЕ генерируем JWT токены - авторизация Telegram не должна авторизовывать в дашборде
      // Только сохраняем Telegram сессию для работы с Telegram API

      this.logger.log(`Telegram session created via phone: ${phoneNumber}`);

      return {
        user,
        tokens: null, // Не возвращаем токены для дашборда
        requires2FA: false,
      };
    } catch (error: unknown) {
      this.logger.error(`Error verifying phone code: ${getErrorMessage(error)}`, getErrorStack(error));
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'errorCode' in response) {
          throw error;
        }
      }
      const errorResponse = mapTelegramErrorToResponse(error);
      throw new HttpException(errorResponse, errorResponse.statusCode);
    }
  }

  /**
   * Генерирует QR-код для авторизации
   */
  async generateQrCode(): Promise<{ tokenId: string; qrUrl: string; expiresAt: number }> {
    try {
      this.logger.debug('Генерация QR-кода для авторизации');

      // Получаем API credentials
      const apiIdStr = this.configService.get<string>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiIdStr || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
      }

      const apiId = parseInt(apiIdStr, 10);
      if (isNaN(apiId)) {
        throw new Error('TELEGRAM_API_ID must be a valid number');
      }

      // КРИТИЧЕСКИ ВАЖНО: Создаем клиент с DatabaseStorage сразу
      // Для QR-кода используем временный UUID (будет обновлен после авторизации)
      const tempUserId = uuidv4();
      const { client, sessionId } = await this.telegramUserClientService.createClientForAuth(tempUserId, apiId, apiHash);
      
      // Клиент уже подключен в createClientForAuth

      // Вызываем auth.exportLoginToken
      const result = await client.invoke({
        _: 'auth.exportLoginToken',
        api_id: apiId,
        api_hash: apiHash,
        except_ids: [],
      });

      if (result._ !== 'auth.loginToken') {
        throw new UnauthorizedException('Failed to generate login token');
      }

      const token = result.token;
      const expiresAt = new Date(Date.now() + result.expires * 1000);

      // Генерируем уникальный ID для токена
      const tokenId = Buffer.from(token).toString('base64url');

      // Создаем URL для QR-кода
      const qrUrl = `tg://login?token=${Buffer.from(token).toString('base64url')}`;

      // Сохраняем токен, клиент и sessionId
      this.qrTokenStore.set(tokenId, {
        token,
        client,
        sessionId,
        expiresAt,
        status: 'pending',
      });

      // Очищаем истекшие токены
      this.cleanExpiredQrTokens();

      this.logger.log(`QR code generated with tokenId: ${tokenId}`);

      return {
        tokenId,
        qrUrl,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
      };
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      this.logger.error(`Error generating QR code: ${msg}`, getErrorStack(error));
      if (error instanceof HttpException) {
        throw error;
      }
      if (msg.includes('TELEGRAM_API_ID') || msg.includes('TELEGRAM_API_HASH')) {
        const errorResponse = buildErrorResponse(
          HttpStatus.BAD_REQUEST,
          ErrorCode.INTERNAL_SERVER_ERROR,
          msg || 'Telegram API credentials not configured',
        );
        throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
      }
      const errorResponse = buildErrorResponse(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_SERVER_ERROR,
        `Failed to generate QR code: ${msg || 'Unknown error'}`,
      );
      throw new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Проверяет статус QR токена
   */
  async checkQrTokenStatus(tokenId: string, userId?: string, expressRequest?: Request): Promise<{
    status: 'pending' | 'accepted' | 'expired';
    user?: User;
    tokens?: { accessToken: string; refreshToken: string } | null;
    expiresAt?: number;
    timeRemaining?: number;
    sessionId?: string; // КРИТИЧНО: Возвращаем sessionId для сохранения в request.session
  }> {
    try {
      const stored = this.qrTokenStore.get(tokenId);
      if (!stored) {
        return { 
          status: 'expired',
          expiresAt: 0,
          timeRemaining: 0,
        };
      }

      // Проверяем истечение
      const now = new Date();
      const timeRemaining = Math.max(0, Math.floor((stored.expiresAt.getTime() - now.getTime()) / 1000));
      
      if (stored.expiresAt < now) {
        stored.status = 'expired';
        this.qrTokenStore.delete(tokenId);
        stored.client.disconnect().catch((err: unknown) => {
          this.logger.error(`Error disconnecting client: ${getErrorMessage(err)}`);
        });
        return { 
          status: 'expired',
          expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
          timeRemaining: 0,
        };
      }

      // Если уже принят, возвращаем данные
      if (stored.status === 'accepted') {
        return {
          status: 'accepted',
          user: stored.user,
          tokens: stored.tokens,
          expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
          timeRemaining: 0,
        };
      }

      // Проверяем, принят ли токен (polling)
      try {
          const acceptResult = await stored.client.invoke({
            _: 'auth.acceptLoginToken',
            token: stored.token as any,
          }) as any;

        if ((acceptResult as any)._ === 'auth.loginTokenSuccess') {
          const authorization = (acceptResult as any).authorization;
          if (authorization._ === 'auth.authorization' && authorization.user._ === 'user') {
            const authUser = authorization.user;

            // Нормализуем номер телефона
            const normalizedPhone = authUser.phone
              ? this.usersService.normalizePhone(authUser.phone)
              : null;

            // Если передан userId (админ создает сессию), используем его
            // Иначе ищем или создаем пользователя по телефону
            let user: User | null;
            if (userId) {
              // Используем переданный userId (для админа)
              user = await this.userRepository.findOne({
                where: { id: userId },
              });
              if (!user) {
                const errorResponse = buildErrorResponse(
                  HttpStatus.UNAUTHORIZED,
                  ErrorCode.NOT_FOUND,
                  'User not found',
                );
                throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
              }
              // Обновляем данные пользователя из Telegram
              user.firstName = authUser.first_name || user.firstName;
              user.lastName = authUser.last_name || user.lastName;
              user.username = authUser.username || user.username;
              if (!user.telegramId) {
                user.telegramId = authUser.id.toString();
              }
              if (normalizedPhone && !user.phone) {
                user.phone = normalizedPhone;
              }
              await this.userRepository.save(user);
            } else {
              // Ищем или создаем пользователя по телефону
              if (normalizedPhone) {
                user = await this.userRepository.findOne({
                  where: { phone: normalizedPhone },
                });
              } else {
                user = await this.userRepository.findOne({
                  where: { telegramId: authUser.id.toString() },
                });
              }

              const isNewUser = !user;

              if (!user) {
                // Создаем нового пользователя
                user = this.userRepository.create({
                  phone: normalizedPhone ?? undefined,
                  firstName: authUser.first_name || null,
                  lastName: authUser.last_name || null,
                  username: authUser.username || null,
                  telegramId: authUser.id.toString(),
                  role: UserRole.CLIENT,
                  isActive: true,
                });
                await this.userRepository.save(user);

                // Обрабатываем реферальную регистрацию для нового пользователя
                if (isNewUser) {
                  try {
                    await this.referralService.processReferralRegistration(user.id);
                    this.logger.log(`Обработана регистрация через QR-код для пользователя ${user.id}`);
                  } catch (error: unknown) {
                    this.logger.error(`Ошибка обработки реферальной регистрации через QR-код: ${getErrorMessage(error)}`);
                  }
                }
              } else {
                // Обновляем данные существующего пользователя
                user.firstName = authUser.first_name || user.firstName;
                user.lastName = authUser.last_name || user.lastName;
                user.username = authUser.username || user.username;
                if (!user.telegramId) {
                  user.telegramId = authUser.id.toString();
                }
                if (normalizedPhone && !user.phone) {
                  user.phone = normalizedPhone;
                }
                await this.userRepository.save(user);
              }
            }

            // Сохраняем сессию MTProto
            // Используем userId из параметра (если передан админом) или создаем нового пользователя
            const sessionUserId = userId || user.id;
            this.logger.log(`Saving Telegram session for user ${sessionUserId} (role: ${user.role}, phone: ${normalizedPhone}), sessionId: ${stored.sessionId}`);
            // КРИТИЧНО: Передаем sessionId и expressRequest в saveSession
            // saveSession() теперь сам сохраняет сессию в request.session если expressRequest передан
            await this.telegramUserClientService.saveSession(
              sessionUserId,
              stored.client,
              stored.sessionId, // КРИТИЧНО: передаем sessionId из qrTokenStore
              normalizedPhone || '',
              undefined, // ipAddress не доступен в этом контексте
              undefined, // userAgent не доступен в этом контексте
              expressRequest, // КРИТИЧНО: Передаем expressRequest для сохранения в request.session
            );

            // НЕ генерируем JWT токены - авторизация Telegram не должна авторизовывать в дашборде
            // Только сохраняем Telegram сессию для работы с Telegram API

            // Обновляем статус токена
            stored.status = 'accepted';
            stored.user = user;
            stored.tokens = undefined; // Не возвращаем токены для дашборда

            this.logger.log(`QR code accepted for user: ${user.id}, sessionId: ${stored.sessionId}`);

            return {
              status: 'accepted',
              user,
              tokens: stored.tokens,
              sessionId: stored.sessionId, // КРИТИЧНО: Возвращаем sessionId для сохранения в request.session
              expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
              timeRemaining: 0,
            };
          }
        }
      } catch (acceptError: unknown) {
        const telegramErrorResponse = mapTelegramErrorToResponse(acceptError);
        
        // Если это ошибка истечения токена, помечаем как expired
        if (
          telegramErrorResponse.errorCode === ErrorCode.SESSION_INVALID ||
          telegramErrorResponse.errorCode === ErrorCode.SESSION_NOT_FOUND
        ) {
          stored.status = 'expired';
          this.qrTokenStore.delete(tokenId);
          stored.client.disconnect().catch((err: unknown) => {
            this.logger.error(`Error disconnecting client: ${getErrorMessage(err)}`);
          });
          const expiresAt = Math.floor(stored.expiresAt.getTime() / 1000);
          return { 
            status: 'expired',
            expiresAt,
            timeRemaining: 0,
          };
        }
        // Токен еще не принят - используем уже объявленные переменные now и timeRemaining
        return { 
          status: 'pending',
          expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
          timeRemaining,
        };
      }

      // Возвращаем статус pending с информацией о времени до истечения - используем уже объявленные переменные
      return { 
        status: 'pending',
        expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
        timeRemaining,
      };
    } catch (error: unknown) {
      this.logger.error(`Error checking QR token status: ${getErrorMessage(error)}`, getErrorStack(error));
      return { status: 'expired' };
    }
  }

  /**
   * Очищает истекшие phone code hash
   */
  private cleanExpiredPhoneCodeHashes(): void {
    const now = new Date();
    for (const [phone, data] of this.phoneCodeHashStore.entries()) {
      if (data.expiresAt < now) {
        this.phoneCodeHashStore.delete(phone);
        // Отключаем клиент
        data.client.disconnect().catch((err: unknown) => {
          this.logger.error(`Error disconnecting client: ${getErrorMessage(err)}`);
        });
      }
    }
  }

  /**
   * Проверяет 2FA пароль и завершает авторизацию
   */
  async verify2FAPassword(
    phoneNumber: string,
    password: string,
    phoneCodeHash: string,
    ipAddress?: string,
    userAgent?: string,
    expressRequest?: Request, // Express request для сохранения сессии в request.session
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } | null }> {
    try {
      // Нормализуем номер телефона для поиска в хранилище
      const normalizedPhone = this.usersService.normalizePhone(phoneNumber);
      
      this.logger.log(`[2FA] Проверка 2FA пароля для телефона: ${phoneNumber} (normalized: ${normalizedPhone}), phoneCodeHash: ${phoneCodeHash}`);
      this.logger.log(`[2FA] Current twoFactorStore size: ${this.twoFactorStore.size}`);
      this.logger.log(`[2FA] Stored phones: ${Array.from(this.twoFactorStore.keys()).join(', ')}`);
      this.logger.log(`[2FA] Password received: length=${password?.length || 0}, type=${typeof password}, isEmpty=${!password || password.length === 0}`);
      if (password && password.length > 0) {
        this.logger.debug(`Password first char: code=${password.charCodeAt(0)}, char="${password[0]}"`);
      }

      // Получаем сохраненные данные по нормализованному номеру
      const stored = this.twoFactorStore.get(normalizedPhone);
      if (!stored) {
        this.logger.error(`[2FA] ❌ twoFactorStore entry not found for normalized phone: ${normalizedPhone}`);
        this.logger.error(`[2FA] Available keys in twoFactorStore: ${Array.from(this.twoFactorStore.keys()).join(', ')}`);
        this.logger.error(`[2FA] Original phoneNumber: ${phoneNumber}, normalized: ${normalizedPhone}`);
        // Пробуем найти по исходному номеру (для обратной совместимости)
        const altStored = this.twoFactorStore.get(phoneNumber);
        if (altStored) {
          this.logger.warn(`[2FA] Found 2FA session by original phone number, migrating to normalized`);
          this.twoFactorStore.delete(phoneNumber);
          this.twoFactorStore.set(normalizedPhone, altStored);
          // Используем найденную сессию
          const migrated = this.twoFactorStore.get(normalizedPhone);
          if (migrated) {
            return this.verify2FAPasswordWithStored(normalizedPhone, password, phoneCodeHash, migrated, ipAddress, userAgent, expressRequest);
          }
        }
        // КРИТИЧНО: Используем buildErrorResponse вместо прямого BadRequestException
        const errorResponse = buildErrorResponse(
          HttpStatus.BAD_REQUEST,
          ErrorCode.SESSION_NOT_FOUND,
          'Сессия 2FA не найдена. Начните авторизацию заново (Отправить код → Ввести код → 2FA).',
        );
        throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
      }
      
      this.logger.log(`[2FA] ✅ twoFactorStore entry found for normalized phone: ${normalizedPhone}`);
      
      if (stored.phoneCodeHash !== phoneCodeHash) {
        this.logger.error(`Phone code hash mismatch for phone: ${normalizedPhone}. Expected: ${stored.phoneCodeHash}, Received: ${phoneCodeHash}`);
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.SESSION_INVALID,
          'Неверный phone code hash. Начните авторизацию заново.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }
      
      return this.verify2FAPasswordWithStored(normalizedPhone, password, phoneCodeHash, stored, ipAddress, userAgent, expressRequest);
    } catch (error: unknown) {
      this.logger.error(`Error verifying 2FA password: ${getErrorMessage(error)}`, getErrorStack(error));
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null && 'errorCode' in response) {
          throw error;
        }
      }
      const errorResponse = mapTelegramErrorToResponse(error);
      throw new HttpException(errorResponse, errorResponse.statusCode);
    }
  }

  private async verify2FAPasswordWithStored(
    normalizedPhone: string,
    password: string,
    phoneCodeHash: string,
    stored: { client: Client; sessionId: string; phoneCodeHash: string; expiresAt: Date; passwordHint?: string },
    ipAddress?: string,
    userAgent?: string,
    expressRequest?: Request, // Express request для сохранения сессии в request.session
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } | null }> {
    try {

      if (stored.expiresAt < new Date()) {
        this.twoFactorStore.delete(normalizedPhone);
        stored.client.disconnect().catch((err: unknown) => {
          this.logger.error(`Error disconnecting client: ${getErrorMessage(err)}`);
        });
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.SESSION_INVALID,
          'Сессия 2FA истекла. Начните авторизацию заново.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }

      const client = stored.client;

      const ap = await client.invoke({ _: 'account.getPassword' });
      if (ap._ !== 'account.password') {
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.INTERNAL_SERVER_ERROR,
          'Не удалось получить параметры пароля.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }
      const input = await checkPassword(password, ap);
      const checkPasswordResult = await client.invoke({ _: 'auth.checkPassword', password: input });
      if (checkPasswordResult._ !== 'auth.authorization') {
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.INVALID_2FA_PASSWORD,
          'Неверный пароль 2FA.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }

      const authUser = checkPasswordResult.user;
      if (authUser._ !== 'user') {
        throw new UnauthorizedException('Invalid user data');
      }

      // Ищем или создаем пользователя по телефону
      this.logger.log(`[2FA] Starting user lookup for phone: ${normalizedPhone}`);
      let user: User | null = await this.userRepository.findOne({
        where: { phone: normalizedPhone },
      });

      if (!user) {
        // Создаем нового пользователя
        user = this.userRepository.create({
          phone: normalizedPhone ?? undefined,
          firstName: authUser.first_name || null,
          lastName: authUser.last_name || null,
          username: authUser.username || null,
          telegramId: authUser.id.toString(),
          role: UserRole.CLIENT,
          isActive: true,
        } as DeepPartial<User>);
        await this.userRepository.save(user);
        this.logger.log(`[2FA] Created new user: ${user.id}, phone: ${normalizedPhone}, telegramId: ${user.telegramId}`);
      } else {
        // Обновляем данные существующего пользователя
        user.firstName = authUser.first_name || user.firstName;
        user.lastName = authUser.last_name || user.lastName;
        user.username = authUser.username || user.username;
        if (!user.telegramId) {
          user.telegramId = authUser.id.toString();
        }
        await this.userRepository.save(user);
        this.logger.log(`[2FA] Updated existing user: ${user.id}, phone: ${normalizedPhone}, telegramId: ${user.telegramId}`);
      }

      // КРИТИЧЕСКИ ВАЖНО: Получаем sessionId из stored
      if (!stored.sessionId) {
        // КРИТИЧНО: Используем HttpException с ErrorResponse вместо throw new Error
        const errorResponse = buildErrorResponse(
          HttpStatus.BAD_REQUEST,
          ErrorCode.SESSION_NOT_FOUND,
          'Session ID not found in twoFactorStore',
        );
        throw new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
      }

      // Обновляем сессию в БД - меняем userId с временного на реальный
      const session = await this.telegramUserClientService.getSessionById(stored.sessionId);
      if (session) {
        session.userId = user.id;
        await this.telegramUserClientService.updateSession(session);
      }

      // Сохраняем сессию MTProto в БД
      this.logger.warn(`[2FA] 🔥 TG LOGIN SUCCESS: appUserId=${user.id}, phone=${normalizedPhone}, telegramId=${user.telegramId}, sessionId=${stored.sessionId}`);
      this.logger.log(`Saving Telegram session for user ${user.id} (role: ${user.role}, phone: ${normalizedPhone}, telegramId: ${user.telegramId}), sessionId: ${stored.sessionId}`);
      
      // КРИТИЧНО: saveSession() теперь сам сохраняет сессию в request.session если expressRequest передан
      await this.telegramUserClientService.saveSession(
        user.id,
        client,
        stored.sessionId,
        normalizedPhone,
        ipAddress,
        userAgent,
        expressRequest, // КРИТИЧНО: Передаем expressRequest для сохранения в request.session
      );
      
      this.logger.warn(`[2FA] ✅ Session saved to DB and request.session: userId=${user.id}, sessionId=${stored.sessionId}, isActive=true, status=active`);

      // Удаляем временные данные
      this.twoFactorStore.delete(normalizedPhone);

      // НЕ генерируем JWT токены - авторизация Telegram не должна авторизовывать в дашборде
      // Только сохраняем Telegram сессию для работы с Telegram API

      this.logger.log(`Telegram session created via 2FA: ${normalizedPhone}`);

      return {
        user,
        tokens: null, // Не возвращаем токены для дашборда
      };
    } catch (error: unknown) {
      this.logger.error(`Error verifying 2FA password: ${getErrorMessage(error)}`, getErrorStack(error));
      const telegramErrorResponse = mapTelegramErrorToResponse(error);
      if (telegramErrorResponse.errorCode !== ErrorCode.INTERNAL_SERVER_ERROR) {
        throw new HttpException(telegramErrorResponse, telegramErrorResponse.statusCode);
      }
      const errorResponse = buildErrorResponse(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_2FA_PASSWORD,
        'Ошибка проверки пароля 2FA.',
      );
      throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
    }
  }

}

