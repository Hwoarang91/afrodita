import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../../entities/user.entity';
import { AuthLog, AuthAction } from '../../entities/auth-log.entity';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtAuthService } from './services/jwt.service';
import { TelegramUserClientService } from '../telegram/services/telegram-user-client.service';
import { Client } from '@mtkruto/node';
import { validate, parse } from '@tma.js/init-data-node';

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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Временное хранилище для phone code hash (в production лучше использовать Redis)
  private phoneCodeHashStore: Map<string, { hash: string; client: Client; expiresAt: Date }> = new Map();

  // Временное хранилище для QR токенов (в production лучше использовать Redis)
  private qrTokenStore: Map<
    string,
    {
      token: Uint8Array;
      client: Client;
      expiresAt: Date;
      status: 'pending' | 'accepted' | 'expired';
      user?: User;
      tokens?: { accessToken: string; refreshToken: string };
    }
  > = new Map();

  // Временное хранилище для 2FA данных (в production лучше использовать Redis)
  private twoFactorStore: Map<
    string,
    {
      client: Client;
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
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
    private jwtAuthService: JwtAuthService,
    private telegramUserClientService: TelegramUserClientService,
  ) {}

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
    console.log(`[TELEGRAM AUTH] validateTelegramAuth called with data:`, JSON.stringify(data, null, 2));
    this.logger.log(`[TELEGRAM AUTH] validateTelegramAuth called with data: ${JSON.stringify(data)}`);
    // Валидация Telegram auth data
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    console.log(`[TELEGRAM AUTH] Bot token exists: ${!!botToken}, length: ${botToken?.length || 0}`);
    this.logger.log(`[TELEGRAM AUTH] Bot token exists: ${!!botToken}, length: ${botToken?.length || 0}`);
    const isValid = this.verifyTelegramAuth(data, botToken);
    console.log(`[TELEGRAM AUTH] verifyTelegramAuth result: ${isValid}`);
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
    } else {
      // Обновление данных существующего пользователя
      // Роль сохраняется (если пользователь был назначен админом/мастером через админ-панель)
      user.firstName = data.first_name;
      user.lastName = data.last_name;
      user.username = data.username;
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
        console.log(`[TELEGRAM AUTH] Using @tma.js/init-data-node for validation`);
        this.logger.log(`[TELEGRAM AUTH] Using @tma.js/init-data-node for validation`);

        try {
          // Валидируем initData с помощью официальной библиотеки
          validate(data.initData, botToken);
          console.log(`[TELEGRAM AUTH] Validation successful`);
          this.logger.log(`[TELEGRAM AUTH] Validation successful`);
          return true;
        } catch (error) {
          console.log(`[TELEGRAM AUTH] Validation failed: ${error.message}`);
          this.logger.log(`[TELEGRAM AUTH] Validation failed: ${error.message}`);
          return false;
        }
      }

      // Fallback: если нет initData, используем старую логику (для обратной совместимости)
      console.log(`[TELEGRAM AUTH] No initData provided, using fallback validation`);
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
        .filter(key => {
          const value = userData[key];
          return value !== undefined && value !== null && value !== '';
        })
        .map((key) => {
          const value = userData[key];
          // Для числовых значений преобразуем в строку
          if (typeof value === 'number') {
            return `${key}=${value}`;
          }
          // Для строк используем как есть
          return `${key}=${value}`;
        })
        .join('\n');

      console.log(`[TELEGRAM AUTH] Fallback dataCheckString:`, dataCheckString);
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

      console.log(`[TELEGRAM AUTH] Fallback calculated hash:`, calculatedHash);
      this.logger.log(`[TELEGRAM AUTH] Fallback calculated hash: ${calculatedHash}`);

      // Проверяем hash
      const isValid = calculatedHash === data.hash;

      if (!isValid) {
        this.logger.warn(`Telegram auth hash mismatch. Received: ${data.hash}, Calculated: ${calculatedHash}`);
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(`Ошибка при проверке Telegram auth: ${error.message}`, error.stack);
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
  ): Promise<{ accessToken: string; token: string; refreshToken: string; user: any }> {
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
  async requestPhoneCode(phoneNumber: string): Promise<{ phoneCodeHash: string }> {
    try {
      this.logger.debug(`Запрос кода для телефона: ${phoneNumber}`);

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

      // Создаем клиент для авторизации
      const client = await this.telegramUserClientService.createClientForAuth(apiId, apiHash);

      // Ждем подключения клиента
      await client.connect();

      // Вызываем auth.sendCode
      const result: any = await client.invoke({
        _: 'auth.sendCode',
        api_id: apiId,
        api_hash: apiHash,
        phone_number: phoneNumber,
        settings: {
          _: 'codeSettings',
        },
      } as any);

      if (result._ !== 'auth.sentCode') {
        throw new UnauthorizedException('Failed to send code');
      }

      const phoneCodeHash = result.phone_code_hash;
      const expiresAt = new Date(Date.now() + (result.timeout || 60) * 1000);

      // Сохраняем phone code hash и клиент (временное решение, лучше использовать Redis)
      this.phoneCodeHashStore.set(phoneNumber, {
        hash: phoneCodeHash,
        client,
        expiresAt,
      });

      // Очищаем истекшие записи
      this.cleanExpiredPhoneCodeHashes();

      this.logger.log(`Code sent to phone: ${phoneNumber}`);

      return { phoneCodeHash };
    } catch (error: any) {
      this.logger.error(`Error requesting phone code: ${error.message}`, error.stack);

      // Обработка специфичных ошибок Telegram
      if (error.message?.includes('FLOOD')) {
        throw new UnauthorizedException('Too many requests. Please try again later.');
      }
      if (error.message?.includes('PHONE_NUMBER_INVALID')) {
        throw new UnauthorizedException('Invalid phone number');
      }
      if (error.message?.includes('PHONE_NUMBER_BANNED')) {
        throw new UnauthorizedException('Phone number is banned');
      }

      throw new UnauthorizedException('Failed to send verification code');
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
    userId?: string, // Опциональный userId для админа
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } | null; requires2FA: boolean; passwordHint?: string }> {
    try {
      this.logger.debug(`Проверка кода для телефона: ${phoneNumber}, phoneCodeHash: ${phoneCodeHash}`);
      this.logger.debug(`Current phoneCodeHashStore size: ${this.phoneCodeHashStore.size}`);
      this.logger.debug(`Stored phones in phoneCodeHashStore: ${Array.from(this.phoneCodeHashStore.keys()).join(', ')}`);

      // Получаем сохраненный клиент и hash
      const stored = this.phoneCodeHashStore.get(phoneNumber);
      if (!stored || stored.hash !== phoneCodeHash) {
        throw new UnauthorizedException('Invalid phone code hash');
      }

      if (stored.expiresAt < new Date()) {
        this.phoneCodeHashStore.delete(phoneNumber);
        throw new UnauthorizedException('Phone code hash expired');
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
      } catch (error: any) {
        // Обработка ошибок
        if (error.message?.includes('PHONE_CODE_INVALID')) {
          throw new UnauthorizedException('Invalid verification code');
        }
        if (error.message?.includes('PHONE_CODE_EXPIRED')) {
          this.phoneCodeHashStore.delete(phoneNumber);
          throw new UnauthorizedException('Verification code expired');
        }
        if (error.message?.includes('SESSION_PASSWORD_NEEDED')) {
          // Требуется 2FA - получаем подсказку пароля и сохраняем клиент
          this.logger.debug(`2FA required for phone: ${phoneNumber}, saving phoneCodeHash: ${phoneCodeHash}`);
          
          // Получаем подсказку пароля через account.getPassword
          let passwordHint: string | undefined;
          try {
            const passwordResult = await client.invoke({
              _: 'account.getPassword',
            });
            if (passwordResult._ === 'account.password' && (passwordResult as any).hint) {
              passwordHint = (passwordResult as any).hint;
              this.logger.debug(`Password hint retrieved: ${passwordHint}`);
            }
          } catch (hintError: any) {
            this.logger.warn(`Failed to get password hint: ${hintError.message}`);
          }
          
          // Нормализуем номер телефона для хранения
          const normalizedPhone = this.usersService.normalizePhone(phoneNumber);
          
          this.twoFactorStore.set(normalizedPhone, {
            client,
            phoneCodeHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 минут
            passwordHint,
          });
          this.logger.debug(`2FA session saved for normalized phone: ${normalizedPhone}. Store size: ${this.twoFactorStore.size}, expiresAt: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()}, hint: ${passwordHint || 'none'}`);
          return {
            user: null as any,
            tokens: null as any,
            requires2FA: true,
            passwordHint,
          };
        }
        throw error;
      }

      // Проверяем результат
      if (signInResult._ !== 'auth.authorization') {
        throw new UnauthorizedException('Authorization failed');
      }

      const authUser = signInResult.user;
      if (authUser._ !== 'user') {
        throw new UnauthorizedException('Invalid user data');
      }

      // Нормализуем номер телефона
      const normalizedPhone = this.usersService.normalizePhone(phoneNumber);

      // Если передан userId (админ создает сессию), используем его
      // Иначе ищем или создаем пользователя по телефону
      let user: User;
      if (userId) {
        // Используем переданный userId (для админа)
        user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (!user) {
          throw new UnauthorizedException('User not found');
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
        user = await this.userRepository.findOne({
          where: { phone: normalizedPhone },
        });

        if (!user) {
          // Создаем нового пользователя
          user = this.userRepository.create({
            phone: normalizedPhone,
            firstName: authUser.first_name || null,
            lastName: authUser.last_name || null,
            username: authUser.username || null,
            telegramId: authUser.id.toString(),
            role: UserRole.CLIENT,
            isActive: true,
          });
          await this.userRepository.save(user);
        } else {
          // Обновляем данные существующего пользователя
          user.firstName = authUser.first_name || user.firstName;
          user.lastName = authUser.last_name || user.lastName;
          user.username = authUser.username || user.username;
          if (!user.telegramId) {
            user.telegramId = authUser.id.toString();
          }
          await this.userRepository.save(user);
        }
      }

      // Сохраняем сессию MTProto
      // ВАЖНО: Если передан userId (админ создает сессию), сохраняем для него, а не для найденного пользователя
      const sessionUserId = userId || user.id;
      this.logger.log(`Saving Telegram session for user ${sessionUserId} (role: ${user.role}, phone: ${normalizedPhone}, userId provided: ${userId ? 'yes' : 'no'})`);
      await this.telegramUserClientService.saveSession(
        sessionUserId,
        client,
        normalizedPhone,
        ipAddress,
        userAgent,
      );

      // Удаляем временные данные
      this.phoneCodeHashStore.delete(phoneNumber);

      // НЕ генерируем JWT токены - авторизация Telegram не должна авторизовывать в дашборде
      // Только сохраняем Telegram сессию для работы с Telegram API

      this.logger.log(`Telegram session created via phone: ${phoneNumber}`);

      return {
        user,
        tokens: null as any, // Не возвращаем токены для дашборда
        requires2FA: false,
      };
    } catch (error: any) {
      this.logger.error(`Error verifying phone code: ${error.message}`, error.stack);
      throw error;
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

      // Создаем клиент для авторизации
      const client = await this.telegramUserClientService.createClientForAuth(apiId, apiHash);

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

      // Сохраняем токен
      this.qrTokenStore.set(tokenId, {
        token,
        client,
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
    } catch (error: any) {
      this.logger.error(`Error generating QR code: ${error.message}`, error.stack);
      throw new UnauthorizedException('Failed to generate QR code');
    }
  }

  /**
   * Проверяет статус QR токена
   */
  async checkQrTokenStatus(tokenId: string, userId?: string): Promise<{
    status: 'pending' | 'accepted' | 'expired';
    user?: User;
    tokens?: { accessToken: string; refreshToken: string } | null;
    expiresAt?: number;
    timeRemaining?: number;
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
        stored.client.disconnect().catch((err) => {
          this.logger.error(`Error disconnecting client: ${err.message}`);
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
          // @ts-ignore - временно игнорируем ошибку типов MTProto
          const acceptResult = await stored.client.invoke({
            _: 'auth.acceptLoginToken',
            // @ts-ignore - временно игнорируем ошибку типов MTProto
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
            let user: User;
            if (userId) {
              // Используем переданный userId (для админа)
              user = await this.userRepository.findOne({
                where: { id: userId },
              });
              if (!user) {
                throw new UnauthorizedException('User not found');
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

              if (!user) {
                // Создаем нового пользователя
                user = this.userRepository.create({
                  phone: normalizedPhone,
                  firstName: authUser.first_name || null,
                  lastName: authUser.last_name || null,
                  username: authUser.username || null,
                  telegramId: authUser.id.toString(),
                  role: UserRole.CLIENT,
                  isActive: true,
                });
                await this.userRepository.save(user);
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
            this.logger.log(`Saving Telegram session for user ${sessionUserId} (role: ${user.role}, phone: ${normalizedPhone})`);
            await this.telegramUserClientService.saveSession(
              sessionUserId,
              stored.client,
              normalizedPhone || '',
              undefined, // ipAddress не доступен в этом контексте
              undefined, // userAgent не доступен в этом контексте
            );

            // НЕ генерируем JWT токены - авторизация Telegram не должна авторизовывать в дашборде
            // Только сохраняем Telegram сессию для работы с Telegram API

            // Обновляем статус токена
            stored.status = 'accepted';
            stored.user = user;
            stored.tokens = null; // Не возвращаем токены для дашборда

            this.logger.log(`QR code accepted for user: ${user.id}`);

            return {
              status: 'accepted',
              user,
              tokens: stored.tokens,
              expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
              timeRemaining: 0,
            };
          }
        }
      } catch (acceptError: any) {
        // Токен еще не принят или ошибка
        // Если ошибка "AUTH_TOKEN_INVALID" или "AUTH_TOKEN_EXPIRED", токен истек
        if (
          acceptError.message?.includes('AUTH_TOKEN_INVALID') ||
          acceptError.message?.includes('AUTH_TOKEN_EXPIRED')
        ) {
          stored.status = 'expired';
          this.qrTokenStore.delete(tokenId);
          stored.client.disconnect().catch((err) => {
            this.logger.error(`Error disconnecting client: ${err.message}`);
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
    } catch (error: any) {
      this.logger.error(`Error checking QR token status: ${error.message}`, error.stack);
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
        data.client.disconnect().catch((err) => {
          this.logger.error(`Error disconnecting client: ${err.message}`);
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
    userId?: string, // Опциональный userId для админа
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
        this.logger.error(`2FA session not found for phone: ${normalizedPhone}`);
        // Пробуем найти по исходному номеру (для обратной совместимости)
        const altStored = this.twoFactorStore.get(phoneNumber);
        if (altStored) {
          this.logger.warn(`Found 2FA session by original phone number, migrating to normalized`);
          this.twoFactorStore.delete(phoneNumber);
          this.twoFactorStore.set(normalizedPhone, altStored);
          // Используем найденную сессию
          const migrated = this.twoFactorStore.get(normalizedPhone);
          if (migrated) {
            return this.verify2FAPasswordWithStored(normalizedPhone, password, phoneCodeHash, migrated, ipAddress, userAgent, userId);
          }
        }
        throw new UnauthorizedException('2FA session not found. Please restart the authorization process.');
      }
      
      if (stored.phoneCodeHash !== phoneCodeHash) {
        this.logger.error(`Phone code hash mismatch for phone: ${normalizedPhone}. Expected: ${stored.phoneCodeHash}, Received: ${phoneCodeHash}`);
        throw new UnauthorizedException('Invalid phone code hash. Please restart the authorization process.');
      }
      
      return this.verify2FAPasswordWithStored(normalizedPhone, password, phoneCodeHash, stored, ipAddress, userAgent, userId);
    } catch (error: any) {
      this.logger.error(`Error verifying 2FA password: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async verify2FAPasswordWithStored(
    normalizedPhone: string,
    password: string,
    phoneCodeHash: string,
    stored: { client: Client; phoneCodeHash: string; expiresAt: Date; passwordHint?: string },
    ipAddress?: string,
    userAgent?: string,
    userId?: string, // Опциональный userId для админа
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } | null }> {
    try {

      if (stored.expiresAt < new Date()) {
        this.twoFactorStore.delete(normalizedPhone);
        stored.client.disconnect().catch((err) => {
          this.logger.error(`Error disconnecting client: ${err.message}`);
        });
        throw new UnauthorizedException('2FA session expired');
      }

      const client = stored.client;

      // Получаем параметры SRP через account.getPassword
      const passwordResult = await client.invoke({
        _: 'account.getPassword',
      });

      if (passwordResult._ !== 'account.password') {
        throw new UnauthorizedException('Failed to get password parameters');
      }

      // Логируем полную структуру passwordResult для отладки
      const passwordResultKeys = Object.keys(passwordResult);
      const passwordResultValues: any = {};
      passwordResultKeys.forEach(key => {
        const value = (passwordResult as any)[key];
        if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
          passwordResultValues[key] = `[Buffer: ${value.length} bytes]`;
        } else if (typeof value === 'object' && value !== null) {
          passwordResultValues[key] = `[Object: ${Object.keys(value).length} keys]`;
        } else {
          passwordResultValues[key] = value;
        }
      });
      
      this.logger.error('Full passwordResult structure', {
        keys: passwordResultKeys,
        values: passwordResultValues,
        hasCurrentAlgo: !!(passwordResult as any).current_algo,
        hasSrpId: !!(passwordResult as any).srp_id,
        hasSrpB: !!(passwordResult as any).srp_B,
        hasB: !!(passwordResult as any).B,
        passwordResultType: passwordResult._,
        fullPasswordResult: JSON.stringify(passwordResult, (key, value) => {
          if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
            return `[Buffer: ${value.length} bytes]`;
          }
          if (typeof value === 'bigint') {
            return `[BigInt: ${value.toString()}]`;
          }
          return value;
        }, 2),
      });

      // MTKruto имеет встроенную поддержку SRP через client.computeCheck
      // Используем встроенную функцию для вычисления SRP проверки

      // Вычисляем SRP проверку
      const srpB = passwordResult.current_algo;
      if (srpB._ !== 'passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow') {
        throw new UnauthorizedException('Unsupported password algorithm');
      }

      const srpId = passwordResult.srp_id;
      
      // В MTProto структура account.password содержит srp_B (публичный ключ сервера)
      // Согласно документации MTProto, srp_B находится на верхнем уровне passwordResult
      // Но возможно, что в MTKruto это поле называется по-другому или находится в другом месте
      // Проверяем все возможные варианты
      const srpB_bytes = 
        (passwordResult as any).srp_B || 
        (passwordResult as any).B || 
        (passwordResult as any).srpB ||
        (passwordResult as any).b ||
        (passwordResult as any).srp_b ||
        (srpB as any).srp_B || 
        (srpB as any).B ||
        (srpB as any).srpB ||
        (srpB as any).b;
      
      // Если srp_B не найден, возможно, нужно получить его из другого источника
      // В некоторых версиях MTProto srp_B может быть получен через отдельный запрос
      // или вычислен из других параметров
      
      // Параметры алгоритма находятся в current_algo
      const g = (srpB as any).g;
      const p = (srpB as any).p;
      const salt1 = (srpB as any).salt1;
      const salt2 = (srpB as any).salt2;
      
      // Логируем структуру для отладки
      this.logger.debug('SRP parameters extraction', {
        hasSrpB: !!srpB_bytes,
        hasG: !!g,
        hasP: !!p,
        hasSalt1: !!salt1,
        hasSalt2: !!salt2,
        passwordResultKeys: Object.keys(passwordResult),
        srpBKeys: Object.keys(srpB),
        passwordResultType: passwordResult._,
        srpBType: srpB._,
      });
      
      // Проверяем, что все необходимые параметры присутствуют
      if (!srpB_bytes) {
        // Логируем полную структуру для отладки
        const debugInfo = {
          passwordResult: JSON.stringify(passwordResult, (key, value) => {
            // Преобразуем Buffer в строку для логирования
            if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
              return `[Buffer: ${value.length} bytes]`;
            }
            if (typeof value === 'bigint') {
              return `[BigInt: ${value.toString()}]`;
            }
            return value;
          }, 2),
          srpB: JSON.stringify(srpB, (key, value) => {
            if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
              return `[Buffer: ${value.length} bytes]`;
            }
            if (typeof value === 'bigint') {
              return `[BigInt: ${value.toString()}]`;
            }
            return value;
          }, 2),
        };
        this.logger.error('Missing srp_B in password result', debugInfo);
        throw new UnauthorizedException('Failed to get SRP parameters: missing srp_B');
      }
      if (!g || !p || !salt1 || !salt2) {
        this.logger.error('Missing SRP parameters', { g, p, salt1: !!salt1, salt2: !!salt2 });
        throw new UnauthorizedException('Failed to get SRP parameters: missing required fields');
      }

      // Вычисляем SRP параметры по алгоритму MTKruto (не используем tssrp6a)
      const crypto = require('crypto');
      
      // Преобразуем параметры для SRP
      // MTProto использует специфичный формат для SRP
      const passwordBytes = Buffer.from(password, 'utf8');
      
      // Вычисляем x по формуле MTKruto (PH2):
      // PH2(password, salt1, salt2) := SH(pbkdf2(PH1(password, salt1, salt2), salt1, 100000), salt2)
      // PH1(password, salt1, salt2) := SH(SH(password, salt1), salt2)
      // SH(data, salt) := H(salt | data | salt)
      
      // Шаг 1: SH(password, salt1) = H(salt1 | password | salt1)
      const sh1 = crypto.createHash('sha256')
        .update(Buffer.concat([salt1, passwordBytes, salt1]))
        .digest();
      
      // Шаг 2: PH1 = SH(SH(password, salt1), salt2) = H(salt2 | sh1 | salt2)
      const ph1 = crypto.createHash('sha256')
        .update(Buffer.concat([salt2, sh1, salt2]))
        .digest();
      
      // Шаг 3: pbkdf2(PH1, salt1, 100000) с SHA-512, 512 бит (64 байта)
      const pbkdf2Result = crypto.pbkdf2Sync(
        ph1,
        salt1,
        100000,
        64,  // 64 байта (512 бит)
        'sha512'
      );
      
      // Шаг 4: PH2 = SH(pbkdf2(...), salt2) = H(salt2 | pbkdf2Result | salt2)
      const xBytes = crypto.createHash('sha256')
        .update(Buffer.concat([salt2, pbkdf2Result, salt2]))
        .digest();
      
      // Преобразуем параметры в нужный формат
      const gBigInt = BigInt(g);
      const pBuffer = Buffer.from(p);
      const pBigInt = BigInt('0x' + pBuffer.toString('hex'));
      const BBytes = Buffer.from(srpB_bytes);
      
      // Преобразуем x из Buffer в BigInt
      // xBytes теперь 32 байта (SHA256 hash), а не 256 байт
      const xBigInt = BigInt('0x' + xBytes.toString('hex'));
      
      // Логируем промежуточные значения для отладки
      this.logger.debug('[2FA SRP] Computed x', {
        xBytesLength: xBytes.length,
        xHex: xBytes.toString('hex').substring(0, 32) + '...',
      });
      
      // Преобразуем B из Buffer в BigInt
      const BBigInt = BigInt('0x' + BBytes.toString('hex'));
      
      // Вычисляем параметры SRP по алгоритму MTKruto (не используем tssrp6a)
      // Функция pad для дополнения до 256 байт
      const pad = (bigint: bigint | Buffer): Buffer => {
        if (Buffer.isBuffer(bigint)) {
          if (bigint.length >= 256) return bigint;
          return Buffer.concat([Buffer.alloc(256 - bigint.length, 0), bigint]);
        }
        const hex = bigint.toString(16).padStart(512, '0');
        return Buffer.from(hex, 'hex');
      };
      
      // Функция modExp для вычисления g^a mod p
      const modExp = (base: bigint, exp: bigint, mod: bigint): bigint => {
        let result = 1n;
        base = base % mod;
        while (exp > 0n) {
          if (exp % 2n === 1n) {
            result = (result * base) % mod;
          }
          exp = exp >> 1n;
          base = (base * base) % mod;
        }
        return result;
      };
      
      // Функция mod для вычисления a mod p
      const mod = (a: bigint, p: bigint): bigint => {
        const result = a % p;
        return result < 0n ? result + p : result;
      };
      
      // k := H(p | g)
      const kBytes = crypto.createHash('sha256')
        .update(Buffer.concat([pad(pBigInt), pad(BigInt(g))]))
        .digest();
      const kBigInt = BigInt('0x' + kBytes.toString('hex'));
      
      // Генерируем a и вычисляем gA = g^a mod p
      // Повторяем до тех пор, пока u > 0
      let aBigInt = 0n;
      let gA = 0n;
      let uBigInt = 0n;
      
      for (let i = 0; i < 1000; i++) {
        const aBytes = crypto.randomBytes(256);
        aBigInt = BigInt('0x' + aBytes.toString('hex')) % pBigInt;
        if (aBigInt === 0n) continue;
        
        gA = modExp(BigInt(g), aBigInt, pBigInt);
        
        // Проверяем, что gA валиден (isGoodModExpFirst)
        const diff = pBigInt - gA;
        if (diff < 0n) continue;
        const diffBits = diff.toString(2).length;
        const gABits = gA.toString(2).length;
        if (diffBits < 2048 - 64 || gABits < 2048 - 64) continue;
        if (Math.floor((gABits + 7) / 8) > 256) continue;
        
        // u := H(gA | gB)
        const uBytes = crypto.createHash('sha256')
          .update(Buffer.concat([pad(gA), pad(BBigInt)]))
          .digest();
        uBigInt = BigInt('0x' + uBytes.toString('hex'));
        
        if (uBigInt > 0n) {
          break;
        }
      }
      
      if (!aBigInt || !uBigInt || !gA) {
        throw new UnauthorizedException('Failed to generate valid SRP parameters');
      }
      
      // Преобразуем gA в Buffer (256 байт)
      const ABuffer = pad(gA);
      
      // v := pow(g, x) mod p
      const v = modExp(BigInt(g), xBigInt, pBigInt);
      
      // k_v := (k * v) mod p
      const kV = mod(kBigInt * v, pBigInt);
      
      // t := (g_b - k_v) mod p
      const t = mod(BBigInt - kV, pBigInt);
      
      // s_a := pow(t, a + u * x) mod p
      const sA = modExp(t, aBigInt + uBigInt * xBigInt, pBigInt);
      
      // k_a := H(s_a)
      const kA = crypto.createHash('sha256').update(pad(sA)).digest();
      
      // M1 := H(H(p) xor H(g) | H(salt1) | H(salt2) | g_a | g_b | k_a)
      // Согласно MTKruto реализации
      const pHash = crypto.createHash('sha256').update(pad(pBigInt)).digest();
      const gPadded = pad(BigInt(g));
      const gHash = crypto.createHash('sha256').update(gPadded).digest();
      const salt1Hash = crypto.createHash('sha256').update(salt1).digest();
      const salt2Hash = crypto.createHash('sha256').update(salt2).digest();
      
      // H(p) xor H(g)
      const pXorG = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        pXorG[i] = pHash[i] ^ gHash[i];
      }
      
      // M1 = H(H(p) xor H(g) | H(salt1) | H(salt2) | g_a | g_b | k_a)
      const M1Buffer = crypto.createHash('sha256')
        .update(Buffer.concat([
          pXorG,
          salt1Hash,
          salt2Hash,
          pad(gA),      // g_a (256 байт)
          pad(BBigInt), // g_b (256 байт)
          kA,           // k_a (32 байта)
        ]))
        .digest();
      
      // Логируем промежуточные значения для отладки
      this.logger.debug('[2FA SRP] Computed SRP parameters', {
        xLength: xBytes.length,
        ALength: ABuffer.length,
        BLength: BBytes.length,
        sALength: pad(sA).length,
        M1Length: M1Buffer.length,
        pHashLength: pHash.length,
        gHashLength: gHash.length,
        pXorGLength: pXorG.length,
        salt1HashLength: salt1Hash.length,
        salt2HashLength: salt2Hash.length,
        kALength: kA.length,
      });
      
      const A = new Uint8Array(Array.from(ABuffer));
      const M1 = new Uint8Array(Array.from(M1Buffer));
      
      const check = {
        A: new Uint8Array(Array.from(A)),
        M1: new Uint8Array(Array.from(M1)),
      };

      // Вызываем auth.checkPassword
      const checkPasswordResult = await client.invoke({
        _: 'auth.checkPassword',
        password: {
          _: 'inputCheckPasswordSRP',
          srp_id: srpId,
          A: check.A,
          M1: check.M1,
        },
      }) as any;

      if (checkPasswordResult._ !== 'auth.authorization') {
        throw new UnauthorizedException('2FA password verification failed');
      }

      const authUser = checkPasswordResult.user;
      if (authUser._ !== 'user') {
        throw new UnauthorizedException('Invalid user data');
      }

      // normalizedPhone уже получен из параметров метода

      // Если передан userId (админ создает сессию), используем его
      // Иначе ищем или создаем пользователя по телефону
      this.logger.log(`[2FA] Starting user lookup. userId: ${userId || 'not provided'}, normalizedPhone: ${normalizedPhone}`);
      let user: User;
      if (userId) {
        this.logger.log(`[2FA] Using provided userId: ${userId}`);
        // Используем переданный userId (для админа)
        user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (!user) {
          this.logger.error(`[2FA] User not found for userId: ${userId}`);
          throw new UnauthorizedException('User not found');
        }
        this.logger.log(`[2FA] Found user: ${user.id}, role: ${user.role}, phone: ${user.phone}`);
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
        user = await this.userRepository.findOne({
          where: { phone: normalizedPhone },
        });

        if (!user) {
          // Создаем нового пользователя
          user = this.userRepository.create({
            phone: normalizedPhone,
            firstName: authUser.first_name || null,
            lastName: authUser.last_name || null,
            username: authUser.username || null,
            telegramId: authUser.id.toString(),
            role: UserRole.CLIENT,
            isActive: true,
          });
          await this.userRepository.save(user);
        } else {
          // Обновляем данные существующего пользователя
          user.firstName = authUser.first_name || user.firstName;
          user.lastName = authUser.last_name || user.lastName;
          user.username = authUser.username || user.username;
          if (!user.telegramId) {
            user.telegramId = authUser.id.toString();
          }
          await this.userRepository.save(user);
        }
      }

      // Сохраняем сессию MTProto
      // ВАЖНО: Если передан userId (админ создает сессию), сохраняем для него, а не для найденного пользователя
      const sessionUserId = userId || user.id;
      this.logger.log(`Saving Telegram session for user ${sessionUserId} (role: ${user.role}, phone: ${normalizedPhone}, userId provided: ${userId ? 'yes' : 'no'})`);
      await this.telegramUserClientService.saveSession(
        sessionUserId,
        client,
        normalizedPhone,
        ipAddress,
        userAgent,
      );

      // Удаляем временные данные
      this.twoFactorStore.delete(normalizedPhone);

      // НЕ генерируем JWT токены - авторизация Telegram не должна авторизовывать в дашборде
      // Только сохраняем Telegram сессию для работы с Telegram API

      this.logger.log(`Telegram session created via 2FA: ${normalizedPhone}`);

      return {
        user,
        tokens: null as any, // Не возвращаем токены для дашборда
      };
    } catch (error: any) {
      this.logger.error(`Error verifying 2FA password: ${error.message}`, error.stack);

      // Обработка специфичных ошибок
      if (error.message?.includes('PASSWORD_HASH_INVALID')) {
        throw new UnauthorizedException('Invalid 2FA password');
      }
      if (error.message?.includes('PASSWORD_EMPTY')) {
        throw new UnauthorizedException('Password is required');
      }

      throw new UnauthorizedException('2FA verification failed');
    }
  }

  /**
   * Очищает истекшие QR токены
   */
  private cleanExpiredQrTokens(): void {
    const now = new Date();
    for (const [tokenId, data] of this.qrTokenStore.entries()) {
      if (data.expiresAt < now || data.status === 'expired') {
        this.qrTokenStore.delete(tokenId);
        // Отключаем клиент
        data.client.disconnect().catch((err) => {
          this.logger.error(`Error disconnecting client: ${err.message}`);
        });
      }
    }
  }

  /**
   * Очищает истекшие 2FA сессии
   */
  private cleanExpired2FASessions(): void {
    const now = new Date();
    for (const [phone, data] of this.twoFactorStore.entries()) {
      if (data.expiresAt < now) {
        this.twoFactorStore.delete(phone);
        // Отключаем клиент
        data.client.disconnect().catch((err) => {
          this.logger.error(`Error disconnecting client: ${err.message}`);
        });
      }
    }
  }
}

