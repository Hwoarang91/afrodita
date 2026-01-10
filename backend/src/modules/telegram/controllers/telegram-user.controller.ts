import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
  Logger,
  UnauthorizedException,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TelegramUserClientService } from '../services/telegram-user-client.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { TelegramSessionGuard } from '../guards/telegram-session.guard';
import { UserSendMessageDto, UserSendMediaDto } from '../dto/user-send-message.dto';
import { DeactivateSessionDto, SessionInfoDto } from '../dto/session-management.dto';

@ApiTags('telegram')
@Controller('telegram/user')
@UseGuards(JwtAuthGuard) // КРИТИЧНО: Используем JwtAuthGuard на уровне класса (требует JWT)
@ApiBearerAuth()
export class TelegramUserController {
  private readonly logger = new Logger(TelegramUserController.name);

  constructor(private readonly telegramUserClientService: TelegramUserClientService) {}

  /**
   * Вспомогательный метод для получения активной сессии пользователя
   */
  private async getActiveSessionId(userId: string): Promise<string | null> {
    const sessions = await this.telegramUserClientService.getUserSessions(userId);
    const activeSession = sessions.find(s => s.status === 'active' && s.isActive);
    return activeSession?.id || null;
  }

  @Post('send-message')
  @UseGuards(TelegramSessionGuard) // КРИТИЧНО: Требует активной Telegram сессии
  @ApiOperation({ summary: 'Отправка текстового сообщения от лица авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  @ApiResponse({ status: 403, description: 'Telegram сессия не готова (initializing)' })
  async sendMessage(@Body() dto: UserSendMessageDto, @Request() req) {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      this.logger.debug(`Отправка сообщения от пользователя ${userId} в чат ${dto.chatId}`);

      // КРИТИЧНО: TelegramSessionGuard уже проверил наличие активной сессии
      // Сессия доступна через req.telegramSessionId (установлен guard)
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        // Это не должно произойти, если guard работает правильно, но на всякий случай
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Получаем клиент для конкретной сессии
      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      // Преобразуем chatId в число (Telegram использует числа для ID)
      const chatId = typeof dto.chatId === 'string' ? parseInt(dto.chatId, 10) : dto.chatId;
      if (isNaN(chatId)) {
        throw new UnauthorizedException('Invalid chat ID');
      }

      // Получаем информацию о пользователе для получения access_hash
      let peer;
      try {
        const usersResult = await client.invoke({
          _: 'users.getUsers',
          id: [
            {
              _: 'inputUser',
              user_id: BigInt(chatId),
              access_hash: BigInt(0),
            },
          ],
        });

        if (usersResult && usersResult.length > 0 && usersResult[0]._ === 'user') {
          const user = usersResult[0];
          peer = {
            _: 'inputPeerUser',
            user_id: user.id,
            access_hash: user.access_hash || BigInt(0),
          };
        } else {
          // Если не удалось получить пользователя, используем базовый peer
          peer = {
            _: 'inputPeerUser',
            user_id: BigInt(chatId),
            access_hash: BigInt(0),
          };
        }
      } catch (error: any) {
        // Если не удалось получить пользователя, используем базовый peer
        peer = {
          _: 'inputPeerUser',
          user_id: BigInt(chatId),
          access_hash: BigInt(0),
        };
      }

      // Вызываем messages.sendMessage через MTProto
      // @ts-ignore - временно игнорируем ошибку типов MTProto
      const result = await client.invoke({
        _: 'messages.sendMessage',
        peer,
        message: dto.message,
        random_id: BigInt(Date.now()),
        ...(dto.parseMode && { parse_mode: dto.parseMode }),
        ...(dto.replyToMessageId && { reply_to_msg_id: dto.replyToMessageId }),
        ...(dto.disableNotification !== undefined && { silent: dto.disableNotification }),
      }) as any;

      this.logger.log(`Сообщение отправлено от пользователя ${userId} в чат ${dto.chatId}`);

      return {
        success: true,
        messageId: result.updates?.[0]?.message?.id || null,
        result,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка отправки сообщения: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to send message: ${error.message}`);
    }
  }

  @Post('send-media')
  @UseGuards(TelegramSessionGuard) // КРИТИЧНО: Требует активной Telegram сессии
  @ApiOperation({ summary: 'Отправка медиа от лица авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Медиа отправлено' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  @ApiResponse({ status: 403, description: 'Telegram сессия не готова (initializing)' })
  async sendMedia(@Body() dto: UserSendMediaDto, @Request() req) {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      this.logger.debug(`Отправка медиа от пользователя ${userId} в чат ${dto.chatId}`);

      // КРИТИЧНО: TelegramSessionGuard уже проверил наличие активной сессии
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Получаем клиент для конкретной сессии
      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      // Преобразуем chatId в число
      const chatId = typeof dto.chatId === 'string' ? parseInt(dto.chatId, 10) : dto.chatId;
      if (isNaN(chatId)) {
        throw new UnauthorizedException('Invalid chat ID');
      }

      // Определяем метод отправки в зависимости от типа медиа
      let result;
      const peer: any = {
        _: 'inputPeerUser' as const,
        user_id: BigInt(chatId),
        access_hash: BigInt(0),
      };

      switch (dto.mediaType) {
        case 'photo':
          result = await client.invoke({
            _: 'messages.sendMedia',
            peer,
            media: {
              _: 'inputMediaPhoto',
              id: {
                _: 'inputPhoto',
                id: BigInt(0), // Нужно получить из uploadFile или использовать file_id
                access_hash: BigInt(0),
                file_reference: new Uint8Array(0),
              } as any,
            } as any,
            message: dto.caption || '',
            random_id: BigInt(Date.now()),
            ...(dto.parseMode && { parse_mode: dto.parseMode }),
            ...(dto.replyToMessageId && { reply_to_msg_id: dto.replyToMessageId }),
            ...(dto.disableNotification === true && { silent: true as const }),
          } as any);
          break;
        case 'document':
          result = await client.invoke({
            _: 'messages.sendMedia',
            peer: peer as any,
            media: {
              _: 'inputMediaDocument',
              id: {
                _: 'inputDocument',
                id: BigInt(0),
                access_hash: BigInt(0),
                file_reference: new Uint8Array(0),
              } as any,
            } as any,
            message: dto.caption || '',
            random_id: BigInt(Date.now()),
            ...(dto.parseMode && { parse_mode: dto.parseMode }),
            ...(dto.replyToMessageId && { reply_to_msg_id: dto.replyToMessageId }),
            ...(dto.disableNotification === true && { silent: true as const }),
          } as any);
          break;
        default:
          throw new UnauthorizedException(`Unsupported media type: ${dto.mediaType}`);
      }

      this.logger.log(`Медиа отправлено от пользователя ${userId} в чат ${dto.chatId}`);

      return {
        success: true,
        messageId: result.updates?.[0]?.message?.id || null,
        result,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка отправки медиа: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to send media: ${error.message}`);
    }
  }

  @Get('chats')
  @UseGuards(TelegramSessionGuard) // КРИТИЧНО: Требует активной Telegram сессии
  @ApiOperation({ summary: 'Получение списка чатов авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Список чатов получен' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async getChats(@Request() req, @Query('type') type?: 'private' | 'group' | 'all') {
    try {
      // Проверяем, что пользователь авторизован
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }

      const userId = req.user.sub;
      this.logger.debug(`Получение списка чатов для пользователя ${userId}`);

      // КРИТИЧНО: TelegramSessionGuard уже проверил наличие активной сессии
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Получаем клиент для конкретной сессии
      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      // Вызываем messages.getDialogs для получения списка диалогов
      let result;
      try {
        result = await client.invoke({
          _: 'messages.getDialogs',
          limit: 100,
          offset_date: 0,
          offset_id: 0,
          offset_peer: {
            _: 'inputPeerEmpty',
          },
          hash: BigInt(0),
        }) as any;
      } catch (error: any) {
        // Используем централизованный обработчик MTProto ошибок
        const { handleMtprotoError, MtprotoErrorAction } = await import('../utils/mtproto-error.handler');
        const errorResult = handleMtprotoError(error);
        
        if (errorResult.action === MtprotoErrorAction.INVALIDATE_SESSION) {
          this.logger.error(`MTProto fatal error detected: ${errorResult.reason} - invalidating sessions`);
          await this.telegramUserClientService.invalidateAllSessions(errorResult.reason);
          throw new UnauthorizedException('Telegram session is invalid. Please re-authorize via phone or QR code.');
        }
        
        // Для других ошибок пробрасываем как есть
        throw error;
      }

      if (result._ !== 'messages.dialogs') {
        throw new UnauthorizedException('Failed to get dialogs');
      }

      // Преобразуем результат в удобный формат
      const chats = [];
      for (const dialog of result.dialogs) {
        if (dialog.peer._ === 'peerUser') {
          const user = result.users.find((u: any) => u.id === dialog.peer.user_id);
          if (user && (!type || type === 'private' || type === 'all')) {
            chats.push({
              id: user.id.toString(),
              type: 'private',
              title: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `User ${user.id}`,
              username: user.username,
              firstName: user.first_name,
              lastName: user.last_name,
              phone: user.phone,
            });
          }
        } else if (dialog.peer._ === 'peerChat' || dialog.peer._ === 'peerChannel') {
          const chat = result.chats.find((c: any) => c.id === dialog.peer.chat_id || c.id === dialog.peer.channel_id);
          if (chat && (!type || type === 'group' || type === 'all')) {
            chats.push({
              id: chat.id.toString(),
              type: dialog.peer._ === 'peerChannel' ? 'channel' : 'group',
              title: chat.title,
              username: chat.username,
            });
          }
        }
      }

      this.logger.log(`Получено ${chats.length} чатов для пользователя ${userId}`);

      return {
        success: true,
        chats,
        total: chats.length,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения списка чатов: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get chats: ${error.message}`);
    }
  }

  @Get('contacts')
  @UseGuards(TelegramSessionGuard) // КРИТИЧНО: Требует активной Telegram сессии
  @ApiOperation({ summary: 'Получение списка контактов авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Список контактов получен' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async getContacts(@Request() req) {
    try {
      // Проверяем, что пользователь авторизован
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }

      const userId = req.user.sub;
      this.logger.debug(`Получение списка контактов для пользователя ${userId}`);

      // КРИТИЧНО: TelegramSessionGuard уже проверил наличие активной сессии
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Получаем клиент для конкретной сессии
      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      // Вызываем contacts.getContacts для получения списка контактов
      let result;
      try {
        result = await client.invoke({
          _: 'contacts.getContacts',
          hash: BigInt(0),
        }) as any;
      } catch (error: any) {
        // Используем централизованный обработчик MTProto ошибок
        const { handleMtprotoError, MtprotoErrorAction } = await import('../utils/mtproto-error.handler');
        const errorResult = handleMtprotoError(error);
        
        if (errorResult.action === MtprotoErrorAction.INVALIDATE_SESSION) {
          this.logger.error(`MTProto fatal error detected: ${errorResult.reason} - invalidating sessions`);
          await this.telegramUserClientService.invalidateAllSessions(errorResult.reason);
          throw new UnauthorizedException('Telegram session is invalid. Please re-authorize via phone or QR code.');
        }
        
        // Для других ошибок пробрасываем как есть
        throw error;
      }

      if (result._ !== 'contacts.contacts') {
        throw new UnauthorizedException('Failed to get contacts');
      }

      // Преобразуем результат в удобный формат
      const contacts = result.users
        .filter((user: any) => user._ === 'user' && !user.deleted && !user.bot)
        .map((user: any) => ({
          id: user.id.toString(),
          type: 'private',
          title: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `User ${user.id}`,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          accessHash: user.access_hash?.toString() || null,
        }));

      this.logger.log(`Получено ${contacts.length} контактов для пользователя ${userId}`);

      return {
        success: true,
        contacts,
        total: contacts.length,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения списка контактов: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get contacts: ${error.message}`);
    }
  }

  @Get('messages/:chatId')
  @UseGuards(TelegramSessionGuard) // КРИТИЧНО: Требует активной Telegram сессии
  @ApiOperation({ summary: 'Получение истории сообщений из чата' })
  @ApiResponse({ status: 200, description: 'История сообщений получена' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async getMessages(
    @Param('chatId') chatId: string,
    @Request() req,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      this.logger.debug(`Получение истории сообщений для пользователя ${userId} из чата ${chatId}`);

      // КРИТИЧНО: TelegramSessionGuard уже проверил наличие активной сессии
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Получаем клиент для конкретной сессии
      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      // Преобразуем chatId в число
      const chatIdNum = parseInt(chatId, 10);
      if (isNaN(chatIdNum)) {
        throw new UnauthorizedException('Invalid chat ID');
      }

      // Вызываем messages.getHistory для получения истории сообщений
      const result = await client.invoke({
        _: 'messages.getHistory',
        peer: {
          _: 'inputPeerUser',
          user_id: BigInt(chatIdNum),
          access_hash: BigInt(0),
        },
        limit: limit || 50,
        offset_id: offset || 0,
        offset_date: 0,
        add_offset: 0,
        max_id: 0,
        min_id: 0,
        hash: BigInt(0),
      }) as any;

      if (result._ !== 'messages.messages') {
        throw new UnauthorizedException('Failed to get messages');
      }

      // Преобразуем результат в удобный формат
      const messages = result.messages.map((msg: any) => ({
        id: msg.id,
        fromId: msg.from_id?.user_id?.toString() || null,
        message: msg.message,
        date: msg.date,
        out: msg.out,
        media: msg.media,
      }));

      this.logger.log(`Получено ${messages.length} сообщений для пользователя ${userId} из чата ${chatId}`);

      return {
        success: true,
        messages,
        total: messages.length,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения истории сообщений: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get messages: ${error.message}`);
    }
  }

  @Get('status')
  @ApiOperation({
    summary: 'Получение статуса Telegram сессии пользователя',
    description: 'Возвращает текущий статус Telegram сессии (active, initializing, expired, error, not_found). Не требует активной сессии - используется для проверки готовности сессии перед запросами к Telegram API. ВСЕГДА возвращает 200, если JWT валиден. 401 только если нет JWT.',
  })
  @ApiResponse({
    status: 200,
    description: 'Статус сессии успешно получен (всегда 200, если JWT валиден)',
    schema: {
      example: {
        hasSession: true,
        status: 'active',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: 1700000000,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован (нет JWT)' })
  async getStatus(@Request() req): Promise<{
    hasSession: boolean;
    status: 'active' | 'initializing' | 'expired' | 'error' | 'not_found';
    sessionId: string | null;
    createdAt: number | null;
  }> {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      this.logger.debug(`Получение статуса Telegram сессии для пользователя ${userId}`);

      const sessions = await this.telegramUserClientService.getUserSessions(userId);
      
      // Фильтруем только сессии текущего пользователя (на случай, если это админ)
      const userSessions = sessions.filter(s => s.userId === userId);
      
      // Ищем активную сессию
      const activeSession = userSessions.find(s => s.status === 'active' && s.isActive);
      
      if (activeSession) {
        return {
          hasSession: true,
          status: 'active',
          sessionId: activeSession.id,
          createdAt: Math.floor(activeSession.createdAt.getTime() / 1000),
        };
      }
      
      // Ищем сессии в других статусах
      const initializingSession = userSessions.find(s => s.status === 'initializing');
      // КРИТИЧНО: В entity нет статуса 'expired', есть только 'invalid' и 'revoked'
      // Маппим их в 'expired' для frontend (более понятно для пользователя)
      const invalidOrRevokedSession = userSessions.find(s => s.status === 'invalid' || s.status === 'revoked');
      
      if (initializingSession) {
        return {
          hasSession: true,
          status: 'initializing',
          sessionId: initializingSession.id,
          createdAt: Math.floor(initializingSession.createdAt.getTime() / 1000),
        };
      }
      
      if (invalidOrRevokedSession) {
        // Маппим 'invalid' и 'revoked' в 'expired' для frontend
        return {
          hasSession: true,
          status: 'expired',
          sessionId: invalidOrRevokedSession.id,
          createdAt: Math.floor(invalidOrRevokedSession.createdAt.getTime() / 1000),
        };
      }
      
      // Нет сессий - это НЕ ошибка, просто нет сессии
      return {
        hasSession: false,
        status: 'not_found',
        sessionId: null,
        createdAt: null,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения статуса сессии: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get session status: ${error.message}`);
    }
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Получение списка сессий пользователя',
    description: 'Возвращает список всех Telegram сессий текущего авторизованного пользователя (включая initializing, active, invalid) с информацией о IP адресе, устройстве и датах использования. НЕ требует активной сессии - используется для проверки статуса.',
  })
  @ApiResponse({
    status: 200,
    description: 'Список сессий успешно получен',
    type: [SessionInfoDto],
    schema: {
      example: {
        success: true,
        sessions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            phoneNumber: '+79001234567',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            isActive: true,
            lastUsedAt: '2025-12-15T22:00:00.000Z',
            createdAt: '2025-12-15T20:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован' })
  async getSessions(@Request() req): Promise<{ success: boolean; currentSessionId: string | null; sessions: SessionInfoDto[] }> {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      this.logger.debug(`Получение сессий для пользователя ${userId}`);

      const allSessions = await this.telegramUserClientService.getUserSessions(userId);
      
      // КРИТИЧНО: Фильтруем только сессии ТЕКУЩЕГО пользователя
      // (для админа getUserSessions возвращает ВСЕ сессии в системе)
      const sessions = allSessions.filter(s => s.userId === userId);

      // Определяем текущую активную сессию (используется для API)
      // Для простоты берем первую активную сессию со статусом 'active'
      const currentSession = sessions.find(s => s.status === 'active' && s.isActive);

      const sessionsInfo: SessionInfoDto[] = sessions.map((session) => ({
        id: session.id,
        phoneNumber: session.phoneNumber,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isActive: session.isActive,
        status: session.status || (session.isActive ? 'active' : 'invalid'),
        invalidReason: session.invalidReason || null,
        dcId: session.dcId || null,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt,
        // Для админа добавляем информацию о владельце сессии
        userId: (session as any).user?.id || session.userId,
        userEmail: (session as any).user?.email || null,
        // Помечаем текущую сессию
        isCurrent: currentSession ? session.id === currentSession.id : false,
      }));

      return {
        success: true,
        currentSessionId: currentSession?.id || null,
        sessions: sessionsInfo,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения сессий: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get sessions: ${error.message}`);
    }
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Деактивация или удаление конкретной сессии',
    description: 'Деактивирует указанную Telegram сессию пользователя. После деактивации сессия не может быть использована для отправки сообщений.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUID сессии для деактивации',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'permanent',
    required: false,
    description: 'Если true, сессия будет полностью удалена из БД, иначе только деактивирована',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Сессия успешно деактивирована или удалена',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован' })
  @ApiResponse({ status: 404, description: 'Сессия не найдена или не принадлежит пользователю' })
  async deactivateSession(
    @Param('sessionId') sessionId: string,
    @Request() req,
    @Query('permanent') permanent?: string,
  ): Promise<{ success: boolean }> {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      const isPermanent = permanent === 'true' || permanent === '1';
      this.logger.debug(`${isPermanent ? 'Удаление' : 'Деактивация'} сессии ${sessionId} для пользователя ${userId}`);

      if (isPermanent) {
        await this.telegramUserClientService.removeSession(userId, sessionId);
      } else {
        await this.telegramUserClientService.deactivateSession(userId, sessionId);
      }

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Ошибка ${permanent === 'true' ? 'удаления' : 'деактивации'} сессии: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to ${permanent === 'true' ? 'remove' : 'deactivate'} session: ${error.message}`);
    }
  }

  @Delete('sessions')
  @ApiOperation({
    summary: 'Деактивация всех других сессий (кроме текущей)',
    description: 'Деактивирует все активные Telegram сессии пользователя, кроме указанной (или первой в списке, если не указана). Полезно для безопасности при подозрении на компрометацию.',
  })
  @ApiQuery({
    name: 'keepSessionId',
    required: false,
    description: 'UUID сессии, которую нужно сохранить активной. Если не указан, сохраняется первая сессия в списке.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Все другие сессии успешно деактивированы',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован' })
  async deactivateOtherSessions(@Request() req, @Query('keepSessionId') keepSessionId?: string): Promise<{ success: boolean }> {
    try {
      // КРИТИЧНО: Проверка на null перед доступом к req.user.sub
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }
      
      const userId = req.user.sub;
      this.logger.debug(`Деактивация всех других сессий для пользователя ${userId}`);

      await this.telegramUserClientService.deactivateOtherSessions(userId, keepSessionId);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Ошибка деактивации других сессий: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to deactivate other sessions: ${error.message}`);
    }
  }
}

