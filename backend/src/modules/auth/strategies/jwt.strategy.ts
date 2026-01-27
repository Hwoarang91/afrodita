import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../auth.service';
import { User } from '../../../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    // Кастомный экстрактор для cookies
    const cookieExtractor = (request: { cookies?: Record<string, string> }) => {
      let token = null;
      if (request?.cookies) {
        token = request.cookies['access_token'] ?? null;
      }
      return token;
    };

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Сначала пытаемся извлечь из заголовка Authorization
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Затем из cookies
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your-secret-key'),
    });
  }

  async validate(payload: JwtPayload) {
    // Проверяем, существует ли пользователь в базе данных и активен ли он
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Возвращаем payload с актуальной ролью из базы данных
    // Это гарантирует, что если роль изменилась, она будет обновлена в токене
    return {
      ...payload,
      role: user.role, // Используем актуальную роль из БД
    };
  }
}

