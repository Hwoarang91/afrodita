import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error-message';

/**
 * Очистка Telegram User API сессий.
 * initializing > 24h → invalid; invalid/revoked > 30 days → DELETE.
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    @InjectRepository(TelegramUserSession)
    private readonly sessionRepository: Repository<TelegramUserSession>,
  ) {}

  @Cron('0 3 * * *', { name: 'telegramUserApiSessionCleanup', timeZone: 'UTC' })
  async cleanup() {
    const now = new Date();
    this.logger.log(`[CRON] Telegram User API session cleanup at ${now.toISOString()}`);

    try {
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const initializing = await this.sessionRepository.find({
        where: { status: 'initializing', createdAt: LessThan(twentyFourHoursAgo) },
      });

      if (initializing.length > 0) {
        const r = await this.sessionRepository.update(
          { id: In(initializing.map((s) => s.id)) },
          { status: 'invalid', updatedAt: now },
        );
        this.logger.log(`[CRON] Marked ${r.affected ?? 0} initializing sessions as invalid`);
      }

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const old = await this.sessionRepository.find({
        where: [
          { status: 'invalid', updatedAt: LessThan(thirtyDaysAgo) },
          { status: 'revoked', updatedAt: LessThan(thirtyDaysAgo) },
        ],
      });

      if (old.length > 0) {
        const r = await this.sessionRepository.delete({ id: In(old.map((s) => s.id)) });
        this.logger.log(`[CRON] Deleted ${r.affected ?? 0} old invalid/revoked sessions`);
      }

      this.logger.log('[CRON] Telegram User API session cleanup done');
    } catch (e: unknown) {
      this.logger.error(
        `[CRON] Telegram User API session cleanup failed: ${getErrorMessage(e)}`,
        getErrorStack(e),
      );
    }
  }
}
