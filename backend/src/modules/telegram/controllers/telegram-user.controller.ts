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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UserSendMessageDto, UserSendMediaDto } from '../dto/user-send-message.dto';
import { DeactivateSessionDto, SessionInfoDto } from '../dto/session-management.dto';

@ApiTags('telegram')
@Controller('telegram/user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TelegramUserController {
  private readonly logger = new Logger(TelegramUserController.name);

  constructor(private readonly telegramUserClientService: TelegramUserClientService) {}

  @Post('send-message')
  @ApiOperation({ summary: 'Отправка текстового сообщения от лица авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async sendMessage(@Body() dto: UserSendMessageDto, @Request() req) {
    try {
      const userId = req.user.sub;
      this.logger.debug(`Отправка сообщения от пользователя ${userId} в чат ${dto.chatId}`);

      // Получаем клиент пользователя
      const client = await this.telegramUserClientService.getClient(userId);
      if (!client) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
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
  @ApiOperation({ summary: 'Отправка медиа от лица авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Медиа отправлено' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async sendMedia(@Body() dto: UserSendMediaDto, @Request() req) {
    try {
      const userId = req.user.sub;
      this.logger.debug(`Отправка медиа от пользователя ${userId} в чат ${dto.chatId}`);

      // Получаем клиент пользователя
      const client = await this.telegramUserClientService.getClient(userId);
      if (!client) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
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
  @ApiOperation({ summary: 'Получение списка чатов авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Список чатов получен' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async getChats(@Request() req, @Query('type') type?: 'private' | 'group' | 'all') {
    try {
      const userId = req.user.sub;
      this.logger.debug(`Получение списка чатов для пользователя ${userId}`);

      // Получаем клиент пользователя
      const client = await this.telegramUserClientService.getClient(userId);
      if (!client) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Вызываем messages.getDialogs для получения списка диалогов
      const result = await client.invoke({
        _: 'messages.getDialogs',
        limit: 100,
        offset_date: 0,
        offset_id: 0,
        offset_peer: {
          _: 'inputPeerEmpty',
        },
        hash: BigInt(0),
      }) as any;

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
  @ApiOperation({ summary: 'Получение списка контактов авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Список контактов получен' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async getContacts(@Request() req) {
    try {
      const userId = req.user.sub;
      this.logger.debug(`Получение списка контактов для пользователя ${userId}`);

      // Получаем клиент пользователя
      const client = await this.telegramUserClientService.getClient(userId);
      if (!client) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
      }

      // Вызываем contacts.getContacts для получения списка контактов
      const result = await client.invoke({
        _: 'contacts.getContacts',
        hash: BigInt(0),
      }) as any;

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
      const userId = req.user.sub;
      this.logger.debug(`Получение истории сообщений для пользователя ${userId} из чата ${chatId}`);

      // Получаем клиент пользователя
      const client = await this.telegramUserClientService.getClient(userId);
      if (!client) {
        throw new UnauthorizedException('No active Telegram session found. Please authorize via phone or QR code.');
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

  @Get('sessions')
  @ApiOperation({
    summary: 'Получение списка активных сессий пользователя',
    description: 'Возвращает список всех активных Telegram сессий текущего авторизованного пользователя с информацией о IP адресе, устройстве и датах использования',
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
  async getSessions(@Request() req): Promise<{ success: boolean; sessions: SessionInfoDto[] }> {
    try {
      const userId = req.user.sub;
      this.logger.debug(`Получение сессий для пользователя ${userId}`);

      const sessions = await this.telegramUserClientService.getUserSessions(userId);

      const sessionsInfo: SessionInfoDto[] = sessions.map((session) => ({
        id: session.id,
        phoneNumber: session.phoneNumber,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isActive: session.isActive,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt,
        // Для админа добавляем информацию о владельце сессии
        userId: (session as any).user?.id || session.userId,
        userEmail: (session as any).user?.email || null,
      }));

      return {
        success: true,
        sessions: sessionsInfo,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения сессий: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get sessions: ${error.message}`);
    }
  }

  @Delete('sessions/:sessionId')
  @ApiOperation({
    summary: 'Деактивация конкретной сессии',
    description: 'Деактивирует указанную Telegram сессию пользователя. После деактивации сессия не может быть использована для отправки сообщений.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'UUID сессии для деактивации',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Сессия успешно деактивирована',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован' })
  @ApiResponse({ status: 404, description: 'Сессия не найдена или не принадлежит пользователю' })
  async deactivateSession(@Param('sessionId') sessionId: string, @Request() req): Promise<{ success: boolean }> {
    try {
      const userId = req.user.sub;
      this.logger.debug(`Деактивация сессии ${sessionId} для пользователя ${userId}`);

      await this.telegramUserClientService.deactivateSession(userId, sessionId);

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Ошибка деактивации сессии: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to deactivate session: ${error.message}`);
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

