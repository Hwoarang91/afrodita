import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { TelegramSessionService } from '../services/telegram-session.service';

/**
 * Guard для проверки наличия активной Telegram сессии
 * 
 * Проверяет:
 * 1. Пользователь авторизован (req.user существует)
 * 2. У пользователя есть активная Telegram сессия (status === 'active' && isActive === true)
 * 
 * Если хотя бы одно условие не выполнено - выбрасывает UnauthorizedException
 * 
 * Использует TelegramSessionService как единую точку доступа к сессиям
 */
@Injectable()
export class TelegramSessionGuard implements CanActivate {
  private readonly logger = new Logger(TelegramSessionGuard.name);

  constructor(private readonly telegramSessionService: TelegramSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // КРИТИЧНО: Проверяем что пользователь авторизован (JWT)
    if (!request.user?.sub) {
      this.logger.warn('TelegramSessionGuard: Пользователь не авторизован (нет req.user.sub)');
      throw new UnauthorizedException('Authentication required. Please log in first.');
    }

    const userId = request.user.sub;
    this.logger.debug(`TelegramSessionGuard: Проверка активной Telegram сессии для пользователя ${userId}`);

    try {
      // КРИТИЧНО: Используем TelegramSessionService как единую точку доступа
      const activeSession = await this.telegramSessionService.load(userId);
      
      if (!activeSession) {
        this.logger.warn(`TelegramSessionGuard: У пользователя ${userId} нет активной Telegram сессии`);
        throw new UnauthorizedException(
          'No active Telegram session found. Please authorize via phone or QR code.',
        );
      }

      this.logger.debug(`TelegramSessionGuard: ✅ Активная сессия найдена: ${activeSession.id} для пользователя ${userId}`);
      
      // Сохраняем информацию о сессии в request для использования в контроллере
      request.telegramSession = activeSession;
      request.telegramSessionId = activeSession.id;
      
      return true;
    } catch (error: any) {
      // Если это уже UnauthorizedException - пробрасываем как есть
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Для остальных ошибок логируем и выбрасываем UnauthorizedException
      this.logger.error(`TelegramSessionGuard: Ошибка при проверке сессии для пользователя ${userId}: ${error.message}`, error.stack);
      throw new UnauthorizedException(
        'Failed to verify Telegram session. Please try again or re-authorize.',
      );
    }
  }
}

