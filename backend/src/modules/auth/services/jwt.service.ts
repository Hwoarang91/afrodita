import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { User } from '../../../entities/user.entity';
import { RefreshToken } from '../../../entities/refresh-token.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  role: string;
  type: 'access' | 'refresh';
  tokenFamily?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Генерирует пару access + refresh токенов
   * @param rememberMe - если true, refresh token будет жить 30 дней, иначе 7 дней
   */
  async generateTokenPair(
    user: User,
    ipAddress?: string,
    userAgent?: string,
    rememberMe: boolean = false,
  ): Promise<TokenPair> {
    const tokenFamily = this.generateTokenFamily();
    const now = new Date();

    // Access token (короткоживущий, 15 минут)
    const accessTokenExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 минут
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: '15m',
    });

    // Refresh token (долгоживущий, зависит от rememberMe)
    // Если rememberMe=true → 30 дней, иначе → 7 дней
    const refreshTokenDays = rememberMe ? 30 : 7;
    const refreshTokenExpiresAt = new Date(now.getTime() + refreshTokenDays * 24 * 60 * 60 * 1000);
    const refreshToken = this.generateSecureToken();
    const refreshTokenHash = this.hashToken(refreshToken);

    // Сохраняем refresh token в БД
    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: refreshTokenHash,
      tokenFamily,
      expiresAt: refreshTokenExpiresAt,
      ipAddress,
      userAgent,
      isActive: true,
      isCompromised: false,
      rememberMe,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    this.logger.log(
      `Сгенерирована новая пара токенов для пользователя ${user.email} (rememberMe: ${rememberMe}, срок: ${refreshTokenDays} дней)`,
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Обновляет токены используя refresh token
   */
  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
    const refreshTokenHash = this.hashToken(refreshToken);

    // Ищем refresh token в БД
    const refreshTokenEntity = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash: refreshTokenHash,
        isActive: true,
        isCompromised: false,
      },
      relations: ['user'],
    });

    if (!refreshTokenEntity) {
      this.logger.warn('Refresh token не найден или неактивен');
      throw new Error('Invalid refresh token');
    }

    if (refreshTokenEntity.expiresAt < new Date()) {
      this.logger.warn('Refresh token истек');
      throw new Error('Refresh token expired');
    }

    // Проверяем пользователя
    const user = refreshTokenEntity.user;
    if (!user || !user.isActive) {
      this.logger.warn('Пользователь не найден или неактивен');
      throw new Error('User not found or inactive');
    }

    // Инвалидируем текущий refresh token (rotation)
    refreshTokenEntity.isActive = false;
    await this.refreshTokenRepository.save(refreshTokenEntity);

    // Сохраняем rememberMe из старого токена для нового
    const rememberMe = refreshTokenEntity.rememberMe ?? false;

    // Генерируем новую пару токенов в той же семье
    const tokenFamily = refreshTokenEntity.tokenFamily;
    const now = new Date();

    const accessTokenExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: '15m',
    });

    // Используем тот же срок жизни что и у старого токена (на основе rememberMe)
    const refreshTokenDays = rememberMe ? 30 : 7;
    const refreshTokenExpiresAt = new Date(now.getTime() + refreshTokenDays * 24 * 60 * 60 * 1000);
    const newRefreshToken = this.generateSecureToken();
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    const newRefreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: newRefreshTokenHash,
      tokenFamily,
      expiresAt: refreshTokenExpiresAt,
      ipAddress,
      userAgent,
      isActive: true,
      isCompromised: false,
      rememberMe,
    });

    await this.refreshTokenRepository.save(newRefreshTokenEntity);

    this.logger.log(`Токены обновлены для пользователя ${user.email}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  /**
   * Валидирует access token
   */
  async validateAccessToken(token: string): Promise<User | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      if (payload.type !== 'access') {
        return null;
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, isActive: true },
      });

      return user || null;
    } catch (error) {
      this.logger.debug('Access token validation failed:', error.message);
      return null;
    }
  }

  /**
   * Выходит из системы (инвалидирует все refresh tokens пользователя)
   */
  async logout(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );
    this.logger.log(`Пользователь ${userId} вышел из системы`);
  }

  /**
   * Выходит из системы по refresh token (инвалидирует все refresh tokens пользователя)
   */
  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshTokenEntity = await this.refreshTokenRepository.findOne({
      where: { tokenHash: refreshTokenHash, isActive: true },
      relations: ['user'],
    });

    if (refreshTokenEntity && refreshTokenEntity.user) {
      await this.logout(refreshTokenEntity.user.id);
    } else {
      this.logger.warn('Refresh token не найден для logout');
    }
  }

  /**
   * Выходит из системы на всех устройствах (инвалидирует всю семью токенов)
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId },
      { isCompromised: true },
    );
    this.logger.log(`Пользователь ${userId} вышел из системы на всех устройствах`);
  }

  /**
   * Компрометация токена - инвалидирует всю семью
   */
  async compromiseTokenFamily(tokenFamily: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { tokenFamily },
      { isCompromised: true },
    );
    this.logger.warn(`Семья токенов ${tokenFamily} скомпрометирована`);
  }

  /**
   * Очищает истекшие refresh tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: new Date() as any, // TypeORM bug workaround
    });
    this.logger.log(`Удалено ${result.affected} истекших refresh tokens`);
  }

  /**
   * Генерирует безопасный токен
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Генерирует семейство токенов
   */
  private generateTokenFamily(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Хеширует токен для хранения в БД
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Получает payload из токена без валидации
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
