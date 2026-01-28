import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { TelegramSessionService } from '../services/telegram-session.service';
import { TelegramUserClientService } from '../services/telegram-user-client.service';
import { buildErrorResponse } from '../../../common/utils/error-response.builder';
import { ErrorCode } from '../../../common/interfaces/error-response.interface';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error-message';
import type { InvokeClient } from '../utils/mtproto-retry.utils';

@Injectable()
export class TelegramSessionGuard implements CanActivate {
  private readonly logger = new Logger(TelegramSessionGuard.name);

  constructor(
    private readonly telegramSessionService: TelegramSessionService,
    private readonly telegramUserClientService: TelegramUserClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.user?.sub) {
      this.logger.warn('TelegramSessionGuard: Пользователь не авторизован (нет req.user.sub)');
      throw new UnauthorizedException('Authentication required. Please log in first.');
    }

    const userId = request.user.sub as string;
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('Invalid user ID in JWT token. Please log in again.');
    }

    let session = this.telegramSessionService.load(request);
    let sessionSource: 'request.session' | 'database' | null = null;

    if (session) {
      sessionSource = 'request.session';
    } else {
      try {
        const allSessions = await this.telegramUserClientService.getUserSessions(userId);
        const userSessions = allSessions.filter((s) => s.userId === userId);
        const activeSession = userSessions.find((s) => s.status === 'active' && s.isActive);

        if (activeSession) {
          if (activeSession.userId !== userId) {
            throw new UnauthorizedException(
              'Telegram session userId does not match current user. Please re-authorize.',
            );
          }

          sessionSource = 'database';
          try {
            const client = await this.telegramUserClientService.getClient(activeSession.id);
            if (!client) {
              throw new UnauthorizedException(
                'Telegram session found but client cannot be initialized. Please re-authorize.',
              );
            }
            if (!client.connected) {
              await client.connect();
            }
            const { invokeWithRetry } = await import('../utils/mtproto-retry.utils');
            await invokeWithRetry(client as InvokeClient, {
              _: 'users.getFullUser',
              id: { _: 'inputUserSelf' },
            });
          } catch (err: unknown) {
            if (err instanceof UnauthorizedException) throw err;
            this.logger.error(`TelegramSessionGuard: validate failed: ${getErrorMessage(err)}`, getErrorStack(err));
            throw new UnauthorizedException(
              'Telegram session found but cannot be validated. Please re-authorize.',
            );
          }

          session = {
            userId,
            sessionId: activeSession.id,
            phoneNumber: activeSession.phoneNumber || undefined,
            sessionData: null,
            createdAt: activeSession.createdAt.getTime(),
          };

          try {
            this.telegramSessionService.save(request, session);
          } catch (e: unknown) {
            this.logger.error(`TelegramSessionGuard: save to request.session failed: ${getErrorMessage(e)}`);
          }
        } else {
          const initializingSession = userSessions.find((s) => s.status === 'initializing');
          const invalidSession = userSessions.find((s) => s.status === 'invalid');

          if (initializingSession) {
            throw new ForbiddenException(
              buildErrorResponse(
                HttpStatus.FORBIDDEN,
                ErrorCode.TELEGRAM_SESSION_NOT_READY,
                'Telegram session is initializing. Please wait for authorization to complete.',
              ),
            );
          }
          if (invalidSession) {
            throw new ForbiddenException(
              buildErrorResponse(
                HttpStatus.FORBIDDEN,
                ErrorCode.SESSION_INVALID,
                `Telegram session is invalid: ${invalidSession.invalidReason || 'Unknown'}. Please re-authorize.`,
              ),
            );
          }
        }
      } catch (e: unknown) {
        if (e instanceof ForbiddenException || e instanceof UnauthorizedException) throw e;
        this.logger.error(`TelegramSessionGuard: load from DB failed: ${getErrorMessage(e)}`);
      }
    }

    if (!session) {
      try {
        const allSessions = await this.telegramUserClientService.getUserSessions(userId);
        const userSessions = allSessions.filter((s) => s.userId === userId);
        const initializingSession = userSessions.find((s) => s.status === 'initializing');
        const invalidSession = userSessions.find((s) => s.status === 'invalid');

        if (initializingSession) {
          throw new ForbiddenException(
            buildErrorResponse(
              HttpStatus.FORBIDDEN,
              ErrorCode.TELEGRAM_SESSION_NOT_READY,
              'Telegram session is initializing. Please wait for authorization to complete.',
            ),
          );
        }
        if (invalidSession) {
          throw new ForbiddenException(
            buildErrorResponse(
              HttpStatus.FORBIDDEN,
              ErrorCode.SESSION_INVALID,
              `Telegram session is invalid: ${invalidSession.invalidReason || 'Unknown'}. Please re-authorize.`,
            ),
          );
        }
      } catch (e: unknown) {
        if (e instanceof ForbiddenException) throw e;
      }

      throw new UnauthorizedException(
        buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.SESSION_NOT_FOUND,
          'No Telegram session found. Please authorize via phone or QR code.',
        ),
      );
    }

    request.telegramSession = session;
    request.telegramSessionId = session.sessionId;
    this.logger.debug(`TelegramSessionGuard: validated userId=${session.userId}, sessionId=${session.sessionId}, source=${sessionSource}`);
    return true;
  }
}
