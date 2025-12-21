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

      // Ищем или создаем пользователя
      let user = await this.userRepository.findOne({
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

      // Сохраняем сессию MTProto
      await this.telegramUserClientService.saveSession(
        user.id,
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
  async checkQrTokenStatus(tokenId: string): Promise<{
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

            // Ищем или создаем пользователя
            let user: User;
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

            // Сохраняем сессию MTProto
            await this.telegramUserClientService.saveSession(
              user.id,
              stored.client,
              normalizedPhone || '',
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
            return this.verify2FAPasswordWithStored(normalizedPhone, password, phoneCodeHash, migrated, ipAddress, userAgent);
          }
        }
        throw new UnauthorizedException('2FA session not found. Please restart the authorization process.');
      }
      
      if (stored.phoneCodeHash !== phoneCodeHash) {
        this.logger.error(`Phone code hash mismatch for phone: ${normalizedPhone}. Expected: ${stored.phoneCodeHash}, Received: ${phoneCodeHash}`);
        throw new UnauthorizedException('Invalid phone code hash. Please restart the authorization process.');
      }
      
      return this.verify2FAPasswordWithStored(normalizedPhone, password, phoneCodeHash, stored, ipAddress, userAgent);
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

      // Используем библиотеку tssrp6a для вычисления SRP параметров
      // MTProto использует модифицированный SRP протокол
      const { SRPRoutines } = require('tssrp6a');
      const crypto = require('crypto');
      
      // Преобразуем параметры для SRP
      // MTProto использует специфичный формат для SRP
      const passwordBytes = Buffer.from(password, 'utf8');
      
      // Вычисляем x = PBKDF2(salt1 + password + salt2, salt1, 100000, 256, 'sha256')
      // Это специфичный для MTProto способ вычисления x
      const xBytes = crypto.pbkdf2Sync(
        Buffer.concat([salt1, passwordBytes, salt2]),
        salt1,
        100000,
        256,
        'sha256',
      );
      
      // Преобразуем параметры в нужный формат
      const gBigInt = BigInt(g);
      const pBuffer = Buffer.from(p);
      const pBigInt = BigInt('0x' + pBuffer.toString('hex'));
      const BBytes = Buffer.from(srpB_bytes);
      
      // Преобразуем x из Buffer в BigInt
      const xBigInt = BigInt('0x' + xBytes.toString('hex'));
      
      // Преобразуем B из Buffer в BigInt
      const BBigInt = BigInt('0x' + BBytes.toString('hex'));
      
      // Генерируем приватное значение a вручную (случайное число меньше p)
      // Используем crypto для генерации случайного числа
      const aBytes = crypto.randomBytes(256);
      let aBigInt = BigInt('0x' + aBytes.toString('hex')) % pBigInt;
      if (aBigInt === BigInt(0)) {
        aBigInt = BigInt(1); // Убеждаемся, что a не равно 0
      }
      
      // Создаем SRP routines для вычисления параметров
      // Для MTProto используем кастомные параметры через SRPParameters
      // Нужно передать функцию хеширования, а не строку
      const { SRPParameters } = require('tssrp6a');
      const hashFunction = (data: Buffer | string) => {
        const hash = crypto.createHash('sha256');
        if (Buffer.isBuffer(data)) {
          hash.update(data);
        } else {
          hash.update(Buffer.from(data, 'utf8'));
        }
        return hash.digest();
      };
      const customParams = new SRPParameters({ N: pBigInt, g: gBigInt }, hashFunction);
      const routines = new SRPRoutines(customParams);
      
      // Вычисляем A = g^a mod p (публичный ключ клиента)
      const ABigInt = routines.computeClientPublicValue(gBigInt, pBigInt, aBigInt);
      
      // Преобразуем A в Buffer (256 байт, дополняем нулями слева)
      const AHex = ABigInt.toString(16).padStart(512, '0');
      const ABuffer = Buffer.from(AHex, 'hex');
      
      // Вычисляем u = H(A || B) - computeU принимает только 2 параметра (BigInt) и асинхронный
      const uBigInt = await routines.computeU(ABigInt, BBigInt);
      
      // Вычисляем k = H(p || g) - computeK не принимает параметры, использует внутренние параметры
      const kBigInt = await routines.computeK();
      
      // Вычисляем S используя computeClientSessionKey(k, x, u, a, B)
      // Формула: S = (B - k * g^x)^(a + u * x) mod p
      const SBigInt = routines.computeClientSessionKey(kBigInt, xBigInt, uBigInt, aBigInt, BBigInt);
      
      // Преобразуем A, B, S в BigInt для computeClientEvidence
      const ABigIntForM1 = BigInt('0x' + ABuffer.toString('hex'));
      const BBigIntForM1 = BigInt('0x' + BBytes.toString('hex'));
      
      // Для MTProto M1 вычисляется по специальной формуле:
      // M1 = SHA256(SHA256(p) || SHA256(g) || SHA256(A) || SHA256(B) || SHA256(S))
      // Это отличается от стандартного SRP, где M1 = H(A || B || S)
      // g - это число (обычно 3), нужно преобразовать в Buffer (1 байт)
      const gBuffer = Buffer.allocUnsafe(1);
      gBuffer.writeUInt8(g, 0);
      const pHash = crypto.createHash('sha256').update(pBuffer).digest();
      const gHash = crypto.createHash('sha256').update(gBuffer).digest();
      
      // Преобразуем A, B, S в Buffer для хеширования
      // A уже в ABuffer (256 байт)
      // B уже в BBytes (256 байт)
      // S нужно преобразовать из BigInt в Buffer (256 байт)
      const SHex = SBigInt.toString(16).padStart(512, '0');
      const SBuffer = Buffer.from(SHex, 'hex');
      
      // Вычисляем SHA256 для A, B, S
      const AHash = crypto.createHash('sha256').update(ABuffer).digest();
      const BHash = crypto.createHash('sha256').update(BBytes).digest();
      const SHash = crypto.createHash('sha256').update(SBuffer).digest();
      
      // Вычисляем M1 по формуле MTProto SRP:
      // M1 = SHA256((SHA256(p) XOR SHA256(g)) || SHA256(A) || SHA256(B) || SHA256(S))
      // XOR применяется к pHash и gHash, затем все конкатенируется и хешируется
      const pXorG = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        pXorG[i] = pHash[i] ^ gHash[i];
      }
      
      const M1Buffer = crypto.createHash('sha256')
        .update(Buffer.concat([pXorG, AHash, BHash, SHash]))
        .digest();
      
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

      // Ищем или создаем пользователя
      let user = await this.userRepository.findOne({
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

      // Сохраняем сессию MTProto
      await this.telegramUserClientService.saveSession(
        user.id,
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

