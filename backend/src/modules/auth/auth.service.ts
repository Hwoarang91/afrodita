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

export interface TelegramAuthData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  phone?: string;
  auth_date: number;
  hash: string;
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
    // Валидация Telegram auth data
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!this.verifyTelegramAuth(data, botToken)) {
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
    const crypto = require('crypto');
    const { hash, ...userData } = data;
    const dataCheckString = Object.keys(userData)
      .sort()
      .map((key) => `${key}=${userData[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
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
      const apiId = this.configService.get<number>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
      }

      // Создаем клиент для авторизации
      const client = await this.telegramUserClientService.createClientForAuth(apiId, apiHash);

      // Вызываем auth.sendCode
      const result: any = await client.invoke({
        _: 'auth.sendCode',
        phone_number: phoneNumber,
        settings: {
          _: 'codeSettings',
          allow_flashcall: false,
          current_number: false,
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
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string }; requires2FA: boolean }> {
    try {
      this.logger.debug(`Проверка кода для телефона: ${phoneNumber}`);

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
          // Требуется 2FA - сохраняем клиент и phoneCodeHash для последующей проверки пароля
          this.twoFactorStore.set(phoneNumber, {
            client,
            phoneCodeHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 минут
          });
          return {
            user: null as any,
            tokens: null as any,
            requires2FA: true,
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

      // Генерируем JWT токены
      const tokenPair = await this.jwtAuthService.generateTokenPair(
        user,
        ipAddress,
        userAgent,
        false,
      );

      // Логируем авторизацию
      await this.logAuthAction(user.id, AuthAction.LOGIN, ipAddress, userAgent);

      this.logger.log(`User authenticated via phone: ${phoneNumber}`);

      return {
        user,
        tokens: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
        },
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
      const apiId = this.configService.get<number>('TELEGRAM_API_ID');
      const apiHash = this.configService.get<string>('TELEGRAM_API_HASH');

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment variables');
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
    tokens?: { accessToken: string; refreshToken: string };
  }> {
    try {
      const stored = this.qrTokenStore.get(tokenId);
      if (!stored) {
        return { status: 'expired' };
      }

      // Проверяем истечение
      if (stored.expiresAt < new Date()) {
        stored.status = 'expired';
        this.qrTokenStore.delete(tokenId);
        stored.client.disconnect().catch((err) => {
          this.logger.error(`Error disconnecting client: ${err.message}`);
        });
        return { status: 'expired' };
      }

      // Если уже принят, возвращаем данные
      if (stored.status === 'accepted') {
        return {
          status: 'accepted',
          user: stored.user,
          tokens: stored.tokens,
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

            // Генерируем JWT токены
            const tokenPair = await this.jwtAuthService.generateTokenPair(
              user,
              undefined,
              undefined,
              false,
            );

            // Обновляем статус токена
            stored.status = 'accepted';
            stored.user = user;
            stored.tokens = {
              accessToken: tokenPair.accessToken,
              refreshToken: tokenPair.refreshToken,
            };

            // Логируем авторизацию
            await this.logAuthAction(user.id, AuthAction.LOGIN);

            this.logger.log(`QR code accepted for user: ${user.id}`);

            return {
              status: 'accepted',
              user,
              tokens: stored.tokens,
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
          return { status: 'expired' };
        }
        // Токен еще не принят
        return { status: 'pending' };
      }

      return { status: 'pending' };
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
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    try {
      this.logger.debug(`Проверка 2FA пароля для телефона: ${phoneNumber}`);

      // Получаем сохраненные данные
      const stored = this.twoFactorStore.get(phoneNumber);
      if (!stored || stored.phoneCodeHash !== phoneCodeHash) {
        throw new UnauthorizedException('Invalid phone code hash or expired');
      }

      if (stored.expiresAt < new Date()) {
        this.twoFactorStore.delete(phoneNumber);
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

      // MTKruto имеет встроенную поддержку SRP через client.computeCheck
      // Используем встроенную функцию для вычисления SRP проверки

      // Вычисляем SRP проверку
      const srpB = passwordResult.current_algo;
      if (srpB._ !== 'passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow') {
        throw new UnauthorizedException('Unsupported password algorithm');
      }

      const srpId = passwordResult.srp_id;
      const srpB_bytes = (srpB as any).B;
      const g = (srpB as any).g;
      const p = (srpB as any).p;
      const salt1 = (srpB as any).salt1;
      const salt2 = (srpB as any).salt2;

      // Используем библиотеку tssrp6a для вычисления SRP параметров
      // MTProto использует модифицированный SRP протокол
      const SRPClient = require('tssrp6a').Client;
      const crypto = require('crypto');
      
      // Преобразуем параметры для SRP
      // MTProto использует специфичный формат для SRP
      const passwordBytes = Buffer.from(password, 'utf8');
      
      // Вычисляем x = PBKDF2(salt1 + password + salt2, salt1, 100000, 256, 'sha256')
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
      
      // Создаем SRP клиент с параметрами MTProto
      const srpClient = new SRPClient(
        Buffer.from(salt1),
        Buffer.from(salt2),
        gBigInt,
        pBigInt,
        'sha256',
      );
      
      // Генерируем A (публичный ключ клиента)
      const a = srpClient.generateA();
      const A = srpClient.computeA();
      
      // Вычисляем M1 (доказательство знания пароля)
      const M1 = srpClient.computeM1(BBytes);
      
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
      this.twoFactorStore.delete(phoneNumber);

      // Генерируем JWT токены
      const tokenPair = await this.jwtAuthService.generateTokenPair(
        user,
        ipAddress,
        userAgent,
        false,
      );

      // Логируем авторизацию
      await this.logAuthAction(user.id, AuthAction.LOGIN, ipAddress, userAgent);

      this.logger.log(`User authenticated via 2FA: ${phoneNumber}`);

      return {
        user,
        tokens: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
        },
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

