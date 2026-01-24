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
  BadRequestException,
  Delete,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { AuthRequest } from '../../../common/types/request.types';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TelegramUserClientService } from '../services/telegram-user-client.service';
import { TelegramConnectionMonitorService } from '../services/telegram-connection-monitor.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { TelegramSessionGuard } from '../guards/telegram-session.guard';
import { UserSendMessageDto, UserSendMediaDto } from '../dto/user-send-message.dto';
import { SessionInfoDto } from '../dto/session-management.dto';
import { TelegramSessionStatusDto } from '../dto/telegram-session-status.dto';

@ApiTags('telegram')
@Controller('telegram/user')
@UseGuards(JwtAuthGuard) // КРИТИЧНО: Используем JwtAuthGuard на уровне класса (требует JWT)
@ApiBearerAuth()
export class TelegramUserController {
  private readonly logger = new Logger(TelegramUserController.name);

  constructor(
    private readonly telegramUserClientService: TelegramUserClientService,
    @Optional() private readonly connectionMonitorService?: TelegramConnectionMonitorService,
  ) {}

  @Post('send-message')
  @UseGuards(TelegramSessionGuard) // КРИТИЧНО: Требует активной Telegram сессии
  @ApiOperation({ summary: 'Отправка текстового сообщения от лица авторизованного пользователя' })
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  @ApiResponse({ status: 403, description: 'Telegram сессия не готова (initializing)' })
  async sendMessage(@Body() dto: UserSendMessageDto, @Request() req: AuthRequest) {
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

      // Вызываем messages.sendMessage через MTProto (peer: типы @mtkruto InputPeer не совпадают с декларациями)
      const result = await client.invoke({
        _: 'messages.sendMessage',
        peer: peer as never,
        message: dto.message,
        random_id: BigInt(Date.now()),
        ...(dto.parseMode && { parse_mode: dto.parseMode }),
        ...(dto.replyToMessageId && { reply_to_msg_id: dto.replyToMessageId }),
        ...(dto.disableNotification === true && { silent: true as const }),
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
  async sendMedia(@Body() dto: UserSendMediaDto, @Request() req: AuthRequest) {
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
  async getChats(@Request() req: AuthRequest, @Query('type') type?: 'private' | 'group' | 'all') {
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

      // Преобразуем результат в удобный формат с информацией о последнем сообщении
      type ChatItem = {
        id: string;
        type: string;
        title?: string;
        username?: unknown;
        firstName?: unknown;
        lastName?: unknown;
        phone?: unknown;
        lastMessage?: { id: unknown; text: unknown; date: unknown; out: unknown; status: 'sent' | 'delivered' | 'read' | null } | null;
        unreadCount: unknown;
        pinned: boolean;
      };
      const chats: ChatItem[] = [];
      for (const dialog of result.dialogs) {
        // Находим последнее сообщение для этого диалога
        const lastMessage = result.messages?.find((msg: any) => {
          if (dialog.peer._ === 'peerUser') {
            return msg.peer_id?._ === 'peerUser' && msg.peer_id?.user_id === dialog.peer.user_id;
          } else if (dialog.peer._ === 'peerChat') {
            return msg.peer_id?._ === 'peerChat' && msg.peer_id?.chat_id === dialog.peer.chat_id;
          } else if (dialog.peer._ === 'peerChannel') {
            return msg.peer_id?._ === 'peerChannel' && msg.peer_id?.channel_id === dialog.peer.channel_id;
          }
          return false;
        });

        // Определяем статус последнего отправленного сообщения
        let lastMessageStatus: 'sent' | 'delivered' | 'read' | null = null;
        if (lastMessage && lastMessage.out) {
          // Исходящее сообщение
          if (lastMessage.outbox_read) {
            lastMessageStatus = 'read';
          } else if (lastMessage.out) {
            lastMessageStatus = 'delivered';
          } else {
            lastMessageStatus = 'sent';
          }
        }

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
              // Информация о последнем сообщении
              lastMessage: lastMessage ? {
                id: lastMessage.id,
                text: lastMessage.message || '',
                date: lastMessage.date,
                out: lastMessage.out || false,
                status: lastMessageStatus,
              } : null,
              // Дополнительная информация из dialog
              unreadCount: dialog.unread_count || 0,
              pinned: dialog.pinned || false,
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
              // Информация о последнем сообщении
              lastMessage: lastMessage ? {
                id: lastMessage.id,
                text: lastMessage.message || '',
                date: lastMessage.date,
                out: lastMessage.out || false,
                status: lastMessageStatus,
              } : null,
              // Дополнительная информация из dialog
              unreadCount: dialog.unread_count || 0,
              pinned: dialog.pinned || false,
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
  async getContacts(@Request() req: AuthRequest) {
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
    @Request() req: AuthRequest,
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

      // Вспомогательная функция для обработки медиа
      const processMedia = (media: any) => {
        if (!media) return null;

        const mediaType = media._;
        
        switch (mediaType) {
          case 'messageMediaPhoto': {
            // Фото
            const photo = media.photo;
            if (!photo || photo._ !== 'photo') return null;
            
            // Получаем размеры фото
            const sizes = photo.sizes || [];
            const largestSize = sizes.reduce((prev: any, curr: any) => {
              if (!prev) return curr;
              const prevSize = (prev.w || 0) * (prev.h || 0);
              const currSize = (curr.w || 0) * (curr.h || 0);
              return currSize > prevSize ? curr : prev;
            }, null);
            
            return {
              type: 'photo',
              photoId: photo.id?.toString(),
              accessHash: photo.access_hash?.toString(),
              dcId: photo.dc_id,
              fileReference: photo.file_reference ? Buffer.from(photo.file_reference).toString('base64') : undefined,
              sizes: sizes.map((size: any) => ({
                type: size._,
                width: size.w,
                height: size.h,
                size: size.size,
                location: size.location ? {
                  dcId: size.location.dc_id,
                  volumeId: size.location.volume_id?.toString(),
                  localId: size.location.local_id,
                  secret: size.location.secret?.toString(),
                } : null,
              })),
              largestSize: largestSize ? {
                width: largestSize.w,
                height: largestSize.h,
                size: largestSize.size,
              } : null,
            };
          }
          
          case 'messageMediaDocument': {
            // Документ (видео, файл, и т.д.)
            const document = media.document;
            if (!document || document._ !== 'document') return null;
            
            // Определяем тип документа по mime_type
            let docType = 'document';
            const mimeType = document.mime_type || '';
            if (mimeType.startsWith('video/')) {
              docType = 'video';
            } else if (mimeType.startsWith('audio/')) {
              docType = 'audio';
            } else if (mimeType.startsWith('image/')) {
              docType = 'image';
            }
            
            // Получаем атрибуты документа
            const attributes = document.attributes || [];
            const videoAttr = attributes.find((attr: any) => attr._ === 'documentAttributeVideo');
            const audioAttr = attributes.find((attr: any) => attr._ === 'documentAttributeAudio');
            const filenameAttr = attributes.find((attr: any) => attr._ === 'documentAttributeFilename');
            
            return {
              type: docType,
              documentId: document.id?.toString(),
              accessHash: document.access_hash?.toString(),
              dcId: document.dc_id,
              mimeType: document.mime_type,
              size: document.size?.toString(),
              date: document.date,
              ...(videoAttr && {
                video: {
                  duration: videoAttr.duration,
                  width: videoAttr.w,
                  height: videoAttr.h,
                  supportsStreaming: videoAttr.supports_streaming || false,
                },
              }),
              ...(audioAttr && {
                audio: {
                  duration: audioAttr.duration,
                  performer: audioAttr.performer,
                  title: audioAttr.title,
                },
              }),
              ...(filenameAttr && {
                fileName: filenameAttr.file_name,
              }),
            };
          }
          
          case 'messageMediaWebPage': {
            // Веб-страница (ссылка)
            const webpage = media.webpage;
            if (!webpage) return null;
            
            return {
              type: 'webpage',
              url: webpage.url,
              displayUrl: webpage.display_url,
              siteName: webpage.site_name,
              title: webpage.title,
              description: webpage.description,
              photo: webpage.photo ? {
                photoId: webpage.photo.id?.toString(),
                accessHash: webpage.photo.access_hash?.toString(),
                dcId: webpage.photo.dc_id,
              } : null,
            };
          }
          
          case 'messageMediaGeo': {
            // Геолокация
            return {
              type: 'geo',
              lat: media.geo?.lat,
              long: media.geo?.long,
            };
          }
          
          case 'messageMediaContact': {
            // Контакт
            return {
              type: 'contact',
              phoneNumber: media.phone_number,
              firstName: media.first_name,
              lastName: media.last_name,
              userId: media.user_id?.toString(),
            };
          }
          
          default:
            // Неизвестный тип медиа
            return {
              type: 'unknown',
              raw: media,
            };
        }
      };

      // Преобразуем результат в удобный формат с расширенной информацией
      const messages = result.messages.map((msg: any) => ({
        id: msg.id,
        fromId: msg.from_id?.user_id?.toString() || null,
        message: msg.message || '',
        date: msg.date,
        out: msg.out || false,
        // Статусы доставки и прочтения
        readOutbox: msg.out ? (msg.outbox_read || false) : null, // Прочитано получателем (для исходящих)
        readInbox: !msg.out ? (msg.inbox_read || false) : null, // Прочитано отправителем (для входящих)
        // Реакции
        reactions: msg.reactions ? {
          results: (msg.reactions.results || []).map((reaction: any) => ({
            reaction: reaction.reaction,
            count: reaction.count,
          })),
          recentReactions: (msg.reactions.recent_reactions || []).map((reaction: any) => ({
            reaction: reaction.reaction,
            peerId: reaction.peer_id?.user_id?.toString() || reaction.peer_id?.channel_id?.toString() || null,
          })),
        } : null,
        // Обработанное медиа
        media: processMedia(msg.media),
        // Дополнительные поля
        editDate: msg.edit_date || null,
        replyTo: msg.reply_to ? {
          replyToMsgId: msg.reply_to.reply_to_msg_id,
          replyToPeerId: msg.reply_to.reply_to_peer_id?.user_id?.toString() || 
                        msg.reply_to.reply_to_peer_id?.channel_id?.toString() || null,
        } : null,
        forwards: msg.forwards || null,
        views: msg.views || null,
        pinned: msg.pinned || false,
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

  @Get('file')
  @UseGuards(TelegramSessionGuard)
  @ApiOperation({ summary: 'Получение файла (фото) по MTProto inputFileLocation для превью в MediaPreview' })
  @ApiQuery({ name: 'volumeId', required: true, description: 'volume_id из size.location' })
  @ApiQuery({ name: 'localId', required: true, description: 'local_id из size.location' })
  @ApiQuery({ name: 'secret', required: true, description: 'secret из size.location' })
  @ApiQuery({ name: 'fileReference', required: false, description: 'file_reference из photo (base64)' })
  @ApiResponse({ status: 200, description: 'Бинарное содержимое файла (image/jpeg)' })
  @ApiResponse({ status: 400, description: 'Не указаны volumeId, localId или secret' })
  @ApiResponse({ status: 401, description: 'Нет активной Telegram сессии' })
  async getFile(
    @Query('volumeId') volumeId: string,
    @Query('localId') localId: string,
    @Query('secret') secret: string,
    @Query('fileReference') fileReference: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<StreamableFile> {
    if (!req.user?.sub || !req.telegramSessionId) {
      throw new UnauthorizedException('No active Telegram session found.');
    }
    if (!volumeId?.trim() || !localId?.trim() || !secret?.trim()) {
      throw new BadRequestException('Query volumeId, localId, secret are required.');
    }
    const localIdNum = parseInt(localId, 10);
    if (isNaN(localIdNum)) {
      throw new BadRequestException('Invalid localId.');
    }
    const client = await this.telegramUserClientService.getClient(req.telegramSessionId);
    if (!client) {
      throw new UnauthorizedException('Failed to get Telegram client.');
    }
    const fileRef = fileReference?.trim()
      ? new Uint8Array(Buffer.from(fileReference, 'base64'))
      : new Uint8Array(0);
    let result: { bytes?: Uint8Array; _?: string };
    try {
      result = (await client.invoke({
        _: 'upload.getFile',
        location: {
          _: 'inputFileLocation',
          volume_id: BigInt(volumeId),
          local_id: localIdNum,
          secret: BigInt(secret),
          file_reference: fileRef,
        },
        offset: BigInt(0),
        limit: 512 * 1024,
      })) as { bytes?: Uint8Array; _?: string };
    } catch (e) {
      this.logger.warn(`upload.getFile failed: ${e instanceof Error ? e.message : String(e)}`);
      throw new UnauthorizedException('Failed to download file from Telegram.');
    }
    if (!result?.bytes || !(result.bytes instanceof Uint8Array)) {
      throw new UnauthorizedException('Empty or invalid file response from Telegram.');
    }
    return new StreamableFile(Buffer.from(result.bytes), { type: 'image/jpeg' });
  }

  @Get('session-status')
  @ApiOperation({
    summary: 'Получение статуса Telegram сессии',
    description: 'Возвращает информацию о наличии и статусе Telegram сессии. Всегда возвращает 200 если JWT валиден. Не требует активной Telegram сессии - используется для проверки готовности сессии перед запросами к Telegram API.',
  })
  @ApiResponse({
    status: 200,
    description: 'Статус сессии успешно получен',
    type: TelegramSessionStatusDto,
  })
  @ApiResponse({ status: 401, description: 'JWT токен невалиден или отсутствует' })
  async getSessionStatus(@Request() req: AuthRequest): Promise<TelegramSessionStatusDto> {
    try {
      // КРИТИЧНО: Проверяем только JWT, НЕ Telegram сессию
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }

      const userId = req.user.sub;
      this.logger.debug(`Проверка статуса Telegram сессии для пользователя ${userId}`);

      // Получаем все сессии пользователя
      const sessions = await this.telegramUserClientService.getUserSessions(userId);
      
      // Фильтруем только сессии текущего пользователя (на случай, если это админ)
      const userSessions = sessions.filter(s => s.userId === userId);
      
      // Ищем активную сессию со статусом 'active'
      const activeSession = userSessions.find(s => s.status === 'active' && s.isActive);

      if (activeSession) {
        // Есть активная сессия
        return {
          hasSession: true,
          status: 'active',
          sessionId: activeSession.id,
          phoneNumber: activeSession.phoneNumber,
          createdAt: Math.floor(activeSession.createdAt.getTime() / 1000),
          lastUsedAt: activeSession.lastUsedAt ? Math.floor(activeSession.lastUsedAt.getTime() / 1000) : null,
        };
      }

      // Проверяем, есть ли сессия в статусе 'initializing'
      const initializingSession = userSessions.find(s => s.status === 'initializing');
      
      if (initializingSession) {
        return {
          hasSession: true,
          status: 'initializing',
          sessionId: initializingSession.id,
          phoneNumber: initializingSession.phoneNumber,
          createdAt: Math.floor(initializingSession.createdAt.getTime() / 1000),
          lastUsedAt: initializingSession.lastUsedAt ? Math.floor(initializingSession.lastUsedAt.getTime() / 1000) : null,
        };
      }

      // Проверяем, есть ли невалидная сессия
      const invalidSession = userSessions.find(s => s.status === 'invalid' || s.status === 'revoked');
      
      if (invalidSession) {
        // Маппим 'invalid' и 'revoked' в 'expired' для frontend (более понятно для пользователя)
        return {
          hasSession: true,
          status: 'expired',
          sessionId: invalidSession.id,
          phoneNumber: invalidSession.phoneNumber,
          invalidReason: invalidSession.invalidReason,
          createdAt: Math.floor(invalidSession.createdAt.getTime() / 1000),
          lastUsedAt: invalidSession.lastUsedAt ? Math.floor(invalidSession.lastUsedAt.getTime() / 1000) : null,
        };
      }

      // Нет сессий вообще
      return {
        hasSession: false,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения статуса сессии: ${error.message}`, error.stack);
      
      // КРИТИЧНО: Если это UnauthorizedException (нет JWT) - пробрасываем
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Для всех остальных ошибок возвращаем hasSession: false
      return {
        hasSession: false,
      };
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
  async getSessions(@Request() req: AuthRequest): Promise<{ success: boolean; currentSessionId: string | null; sessions: SessionInfoDto[] }> {
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
    @Request() req: AuthRequest,
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
  async deactivateOtherSessions(@Request() req: AuthRequest, @Query('keepSessionId') keepSessionId?: string): Promise<{ success: boolean }> {
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

  @Get('connection-status')
  @UseGuards(TelegramSessionGuard)
  @ApiOperation({
    summary: 'Получение статуса соединения Telegram сессии',
    description: 'Возвращает детальную информацию о статусе соединения активной Telegram сессии, включая последнюю активность и статус heartbeat.',
  })
  @ApiResponse({
    status: 200,
    description: 'Статус соединения успешно получен',
  })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async getConnectionStatus(@Request() req: AuthRequest) {
    try {
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }

      const sessionId = req.telegramSessionId;
      
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found.');
      }

      // Получаем статус соединения из TelegramConnectionMonitorService
      if (!this.connectionMonitorService) {
        // Если сервис недоступен, возвращаем базовую информацию
        return {
          success: true,
          sessionId,
          isConnected: true,
          connectionState: 'connected',
          lastActivity: null,
        };
      }

      const status = this.connectionMonitorService.getConnectionStatus(sessionId);
      
      if (!status) {
        return {
          success: true,
          sessionId,
          isConnected: false,
          connectionState: 'unknown',
          lastActivity: null,
        };
      }

      return {
        success: true,
        sessionId: status.sessionId,
        userId: status.userId,
        phoneNumber: status.phoneNumber,
        isConnected: status.isConnected,
        connectionState: status.connectionState,
        lastActivity: status.lastActivity ? status.lastActivity.toISOString() : null,
        lastHeartbeatCheck: status.lastHeartbeatCheck ? status.lastHeartbeatCheck.toISOString() : null,
        lastHeartbeatStatus: status.lastHeartbeatStatus,
        consecutiveHeartbeatFailures: status.consecutiveHeartbeatFailures,
        lastError: status.lastError,
        lastInvokeMethod: status.lastInvokeMethod,
        lastInvokeDuration: status.lastInvokeDuration,
        createdAt: status.createdAt.toISOString(),
        lastUsedAt: status.lastUsedAt ? status.lastUsedAt.toISOString() : null,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка получения статуса соединения: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to get connection status: ${error.message}`);
    }
  }

  @Post('messages/:chatId/:messageId/forward')
  @UseGuards(TelegramSessionGuard)
  @ApiOperation({ summary: 'Переслать сообщение в другой чат' })
  @ApiParam({ name: 'chatId', description: 'ID чата-источника' })
  @ApiParam({ name: 'messageId', description: 'ID сообщения для пересылки' })
  @ApiResponse({ status: 200, description: 'Сообщение успешно переслано' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async forwardMessage(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body('toChatId') toChatId: string,
    @Request() req: AuthRequest,
  ) {
    try {
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }

      const userId = req.user.sub;
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found.');
      }

      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      const chatIdNum = parseInt(chatId, 10);
      const toChatIdNum = parseInt(toChatId, 10);
      const messageIdNum = parseInt(messageId, 10);

      if (isNaN(chatIdNum) || isNaN(toChatIdNum) || isNaN(messageIdNum)) {
        throw new UnauthorizedException('Invalid chat ID or message ID');
      }

      // Пересылаем сообщение через messages.forwardMessages
      const result = await client.invoke({
        _: 'messages.forwardMessages',
        from_peer: {
          _: 'inputPeerUser',
          user_id: BigInt(chatIdNum),
          access_hash: BigInt(0),
        },
        to_peer: {
          _: 'inputPeerUser',
          user_id: BigInt(toChatIdNum),
          access_hash: BigInt(0),
        },
        id: [messageIdNum] as any,
        random_id: [BigInt(Date.now())] as any,
        silent: false as any,
      }) as any;

      this.logger.log(`Сообщение ${messageId} переслано от пользователя ${userId} из чата ${chatId} в чат ${toChatId}`);

      return {
        success: true,
        messageId: result.updates?.[0]?.message?.id || null,
        result,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка пересылки сообщения: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to forward message: ${error.message}`);
    }
  }

  @Delete('messages/:chatId/:messageId')
  @UseGuards(TelegramSessionGuard)
  @ApiOperation({ summary: 'Удалить сообщение' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiParam({ name: 'messageId', description: 'ID сообщения для удаления' })
  @ApiResponse({ status: 200, description: 'Сообщение успешно удалено' })
  @ApiResponse({ status: 401, description: 'Пользователь не авторизован или нет активной сессии' })
  async deleteMessage(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Request() req: AuthRequest,
  ) {
    try {
      if (!req.user?.sub) {
        throw new UnauthorizedException('Authentication required');
      }

      const userId = req.user.sub;
      const sessionId = req.telegramSessionId;
      if (!sessionId) {
        throw new UnauthorizedException('No active Telegram session found.');
      }

      const client = await this.telegramUserClientService.getClient(sessionId);
      if (!client) {
        throw new UnauthorizedException('Failed to get Telegram client for active session.');
      }

      const chatIdNum = parseInt(chatId, 10);
      const messageIdNum = parseInt(messageId, 10);

      if (isNaN(chatIdNum) || isNaN(messageIdNum)) {
        throw new UnauthorizedException('Invalid chat ID or message ID');
      }

      // Удаляем сообщение через messages.deleteMessages
      const result = await client.invoke({
        _: 'messages.deleteMessages',
        id: [messageIdNum] as any,
        revoke: true, // Удалить для всех (если это наше сообщение)
      }) as any;

      this.logger.log(`Сообщение ${messageId} удалено пользователем ${userId} из чата ${chatId}`);

      return {
        success: true,
        result,
      };
    } catch (error: any) {
      this.logger.error(`Ошибка удаления сообщения: ${error.message}`, error.stack);
      throw new UnauthorizedException(`Failed to delete message: ${error.message}`);
    }
  }
}

