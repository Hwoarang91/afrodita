import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';
import { AuthLog, AuthAction } from '../../entities/auth-log.entity';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

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

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(AuthLog)
    private authLogRepository: Repository<AuthLog>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
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

  async login(user: User, ipAddress?: string, userAgent?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId || undefined,
      role: user.role,
      email: user.email || undefined,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Сохранение сессии
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = this.sessionRepository.create({
      userId: user.id,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    });
    await this.sessionRepository.save(session);

    // Логирование
    await this.logAuthAction(user.id, AuthAction.LOGIN, ipAddress, userAgent);

    return {
      accessToken,
      token: accessToken, // Для совместимости с админкой
      refreshToken,
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

  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, isActive: true },
      relations: ['user'],
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = session.user;
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId || undefined,
      role: user.role,
      email: user.email || undefined,
    };

    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // Обновление сессии
    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date();
    session.expiresAt.setDate(session.expiresAt.getDate() + 7);
    await this.sessionRepository.save(session);

    await this.logAuthAction(user.id, AuthAction.TOKEN_REFRESH, ipAddress, userAgent);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken },
      relations: ['user'],
    });

    if (session) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      await this.logAuthAction(session.userId, AuthAction.LOGOUT, ipAddress, userAgent);
    }
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

    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
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

    // Выполняем вход для нового администратора
    return await this.login(savedAdmin, ipAddress, userAgent);
  }

  private async logAuthAction(
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
}

