import { Controller, Post, Body, Get, Param, UseGuards, Query, Delete, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/utils/error-message';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramChatsService } from './telegram-chats.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ChatType } from '../../entities/telegram-chat.entity';
import {
  SendMessageDto,
  SendPhotoDto,
  SendMediaDto,
  SendLocationDto,
  SendVenueDto,
  SendContactDto,
  SendPollDto,
  DeleteMessageDto,
  PinMessageDto,
  SetChatTitleDto,
  SetChatDescriptionDto,
  ForwardMessageDto,
} from './dto/send-message.dto';

/** Минимальные поля объекта чата из Telegram API (getChat) */
interface TelegramChatFromApi {
  type?: string;
  title?: string;
  username?: string;
  description?: string;
  members_count?: number;
}

@ApiTags('telegram')
@Controller('telegram')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramChatsService: TelegramChatsService,
    private readonly telegramBotService: TelegramBotService,
    private readonly settingsService: SettingsService,
  ) {}

  // ========== Отправка сообщений ==========

  @Post('send-message')
  @ApiOperation({ summary: 'Отправка текстового сообщения' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  async sendMessage(@Body() dto: SendMessageDto) {
    // Заменяем переменные в сообщении, если они есть
    let message = dto.message;
    try {
      // Получаем информацию о чате
      const chatInfo = await this.telegramService.getChat(dto.chatId);
      
      // Получаем информацию о пользователе, если это личный чат
      let userInfo: unknown = null;
      if (chatInfo.type === 'private') {
        try {
          // Для личного чата chatId равен userId, преобразуем в число
          const userId = typeof dto.chatId === 'string' ? parseInt(dto.chatId, 10) : dto.chatId;
          if (!isNaN(userId)) {
            const chatMember = await this.telegramService.getChatMember(dto.chatId, userId);
            userInfo = chatMember.user;
          }
        } catch (error: unknown) {
          // Игнорируем ошибку, если не удалось получить информацию о пользователе
        }
      }
      
      // Заменяем переменные
      message = this.telegramBotService.replaceMessageVariables(message, userInfo as Parameters<TelegramBotService['replaceMessageVariables']>[1], chatInfo);
    } catch (error: unknown) {
      this.logger.warn(`Не удалось получить информацию о чате для замены переменных: ${getErrorMessage(error)}`);
    }
    
    // Определяем parse_mode автоматически, если не указан явно
    const parseMode = dto.parse_mode || this.detectParseMode(message);
    
    const result = await this.telegramService.sendMessage(dto.chatId, message, {
      parse_mode: parseMode,
      reply_to_message_id: dto.reply_to_message_id,
      disable_notification: dto.disable_notification,
      disable_web_page_preview: dto.disable_web_page_preview,
    });
    return { success: true, result };
  }
  
  /**
   * Определяет parse_mode на основе содержимого сообщения
   */
  private detectParseMode(text: string): 'HTML' | 'Markdown' | 'MarkdownV2' {
    if (!text) return 'HTML';

    // Проверяем наличие HTML тегов
    const htmlTags = /<[a-zA-Z][^>]*>/g;
    const hasHtmlTags = htmlTags.test(text);

    // Проверяем наличие старого Markdown синтаксиса (имеет приоритет)
    // Старый Markdown: **bold**, ~~strike~~, `code`, [link](url)
    const hasDoubleStar = /\*\*[^*]+\*\*/.test(text);  // **bold**
    const hasDoubleTilde = /~~[^~]+~~/.test(text);    // ~~strike~~
    const hasCode = /`[^`]+`/.test(text);              // `code`
    const hasLink = /\[[^\]]+\]\([^)]+\)/.test(text);  // [link](url)
    const hasOldMarkdown = hasDoubleStar || hasDoubleTilde || hasCode || hasLink;
    
    // Проверяем наличие MarkdownV2 специфичных синтаксисов
    // MarkdownV2: *bold*, _italic_, __underline__, ~strike~, ||spoiler||
    const hasUnderline = /__[^_]+__/.test(text);        // __underline__ - только MarkdownV2
    const hasSpoiler = /\|\|[^|]+\|\|/.test(text);      // ||spoiler|| - только MarkdownV2
    const hasSingleTilde = /~[^~\s\n]+~/.test(text);   // ~strike~ - только MarkdownV2
    
    // Проверяем одиночные звездочки и подчеркивания
    // В MarkdownV2: *bold*, _italic_
    // В старом Markdown: *italic*, _italic_ (но приоритет у **bold**)
    const hasSingleStar = /\*[^*\s\n]+\*/.test(text);
    const hasSingleUnderscore = /_[^_\s\n]+_/.test(text);
    
    // MarkdownV2 если есть специфичные синтаксисы (__underline__, ||spoiler||, ~strike~)
    // или одиночные символы без двойных (если нет старого Markdown)
    const hasMarkdownV2 = hasUnderline || hasSpoiler || hasSingleTilde || 
                          (hasSingleStar && !hasDoubleStar) || 
                          (hasSingleUnderscore && !hasUnderline && !hasOldMarkdown);

    // Если есть HTML теги, используем HTML
    if (hasHtmlTags) {
      return 'HTML';
    }

    // Если есть старый Markdown синтаксис (двойные символы), используем старый Markdown
    // Это имеет приоритет над MarkdownV2
    if (hasOldMarkdown) {
      return 'Markdown';
    }

    // Если есть MarkdownV2 специфичные синтаксисы, используем MarkdownV2
    if (hasMarkdownV2) {
      return 'MarkdownV2';
    }

    // По умолчанию HTML
    return 'HTML';
  }

  @Post('send-photo')
  @ApiOperation({ summary: 'Отправка фото' })
  @ApiBody({ type: SendPhotoDto })
  async sendPhoto(@Body() dto: SendPhotoDto) {
    // Заменяем переменные в caption, если они есть
    let caption = dto.caption;
    if (caption) {
      try {
        const chatInfo = await this.telegramService.getChat(dto.chatId);
        let userInfo: unknown = null;
        if (chatInfo.type === 'private') {
          try {
            // Для личного чата chatId равен userId, преобразуем в число
            const userId = typeof dto.chatId === 'string' ? parseInt(dto.chatId, 10) : dto.chatId;
            if (!isNaN(userId)) {
              const chatMember = await this.telegramService.getChatMember(dto.chatId, userId);
              userInfo = chatMember.user;
            }
          } catch (error: unknown) {
            // Игнорируем ошибку
          }
        }
        caption = this.telegramBotService.replaceMessageVariables(caption, userInfo as Parameters<TelegramBotService['replaceMessageVariables']>[1], chatInfo);
      } catch (error: unknown) {
        this.logger.warn(`Не удалось получить информацию о чате для замены переменных в caption: ${getErrorMessage(error)}`);
      }
    }
    
    const parseMode = dto.parse_mode || (caption ? this.detectParseMode(caption) : 'HTML');
    
    const result = await this.telegramService.sendPhoto(dto.chatId, dto.photo, {
      caption,
      parse_mode: parseMode,
      reply_to_message_id: dto.reply_to_message_id,
    });
    return { success: true, result };
  }

  @Post('send-video')
  @ApiOperation({ summary: 'Отправка видео' })
  @ApiBody({ type: SendMediaDto })
  async sendVideo(@Body() dto: SendMediaDto) {
    const result = await this.telegramService.sendVideo(dto.chatId, dto.media, {
      caption: dto.caption,
      parse_mode: dto.parse_mode || 'HTML', // По умолчанию HTML для поддержки всех тегов
    });
    return { success: true, result };
  }

  @Post('send-audio')
  @ApiOperation({ summary: 'Отправка аудио' })
  async sendAudio(@Body() dto: SendMediaDto) {
    const result = await this.telegramService.sendAudio(dto.chatId, dto.media, {
      caption: dto.caption,
      parse_mode: dto.parse_mode || 'HTML', // По умолчанию HTML для поддержки всех тегов
    });
    return { success: true, result };
  }

  @Post('send-voice')
  @ApiOperation({ summary: 'Отправка голосового сообщения' })
  @ApiBody({ type: SendMediaDto })
  async sendVoice(@Body() dto: SendMediaDto) {
    const result = await this.telegramService.sendVoice(dto.chatId, dto.media, {
      caption: dto.caption,
      parse_mode: dto.parse_mode || 'HTML', // По умолчанию HTML для поддержки всех тегов
    });
    return { success: true, result };
  }

  @Post('send-document')
  @ApiOperation({ summary: 'Отправка документа' })
  async sendDocument(@Body() dto: SendMediaDto) {
    const result = await this.telegramService.sendDocument(dto.chatId, dto.media, {
      caption: dto.caption,
      parse_mode: dto.parse_mode || 'HTML', // По умолчанию HTML для поддержки всех тегов
    });
    return { success: true, result };
  }

  @Post('send-sticker')
  @ApiOperation({ summary: 'Отправка стикера' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, sticker: { type: 'string' } },
      required: ['chatId', 'sticker'],
    },
  })
  async sendSticker(@Body() dto: { chatId: string | number; sticker: string }) {
    const result = await this.telegramService.sendSticker(dto.chatId, dto.sticker);
    return { success: true, result };
  }

  @Post('send-animation')
  @ApiOperation({ summary: 'Отправка анимации (GIF)' })
  @ApiBody({ type: SendMediaDto })
  async sendAnimation(@Body() dto: SendMediaDto) {
    const result = await this.telegramService.sendAnimation(dto.chatId, dto.media, {
      caption: dto.caption,
      parse_mode: dto.parse_mode || 'HTML', // По умолчанию HTML для поддержки всех тегов
    });
    return { success: true, result };
  }

  @Post('send-location')
  @ApiOperation({ summary: 'Отправка локации' })
  @ApiBody({ type: SendLocationDto })
  async sendLocation(@Body() dto: SendLocationDto) {
    const result = await this.telegramService.sendLocation(dto.chatId, dto.latitude, dto.longitude);
    return { success: true, result };
  }

  @Post('send-venue')
  @ApiOperation({ summary: 'Отправка места (venue)' })
  @ApiBody({ type: SendVenueDto })
  async sendVenue(@Body() dto: SendVenueDto) {
    const result = await this.telegramService.sendVenue(
      dto.chatId,
      dto.latitude,
      dto.longitude,
      dto.title,
      dto.address,
    );
    return { success: true, result };
  }

  @Post('send-contact')
  @ApiOperation({ summary: 'Отправка контакта' })
  @ApiBody({ type: SendContactDto })
  async sendContact(@Body() dto: SendContactDto) {
    const result = await this.telegramService.sendContact(dto.chatId, dto.phoneNumber, dto.firstName);
    return { success: true, result };
  }

  @Post('send-poll')
  @ApiOperation({ summary: 'Отправка опроса' })
  @ApiBody({ type: SendPollDto })
  async sendPoll(@Body() dto: SendPollDto) {
    const result = await this.telegramService.sendPoll(dto.chatId, dto.question, dto.options, {
      is_anonymous: dto.is_anonymous,
      type: dto.type,
      allows_multiple_answers: dto.allows_multiple_answers,
    });
    return { success: true, result };
  }

  @Post('send-dice')
  @ApiOperation({ summary: 'Отправка кубика/дайса' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, emoji: { type: 'string' } },
      required: ['chatId'],
    },
  })
  async sendDice(@Body() dto: { chatId: string | number; emoji?: string }) {
    const result = await this.telegramService.sendDice(dto.chatId, { emoji: dto.emoji });
    return { success: true, result };
  }

  // ========== Управление чатом ==========


  @Post('pin-message')
  @ApiOperation({ summary: 'Закрепить сообщение' })
  @ApiBody({ type: PinMessageDto })
  async pinMessage(@Body() dto: PinMessageDto) {
    const result = await this.telegramService.pinChatMessage(dto.chatId, dto.messageId, {
      disable_notification: dto.disable_notification,
    });
    return { success: true, result };
  }

  @Post('unpin-message')
  @ApiOperation({ summary: 'Открепить сообщение' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, messageId: { type: 'number' } },
      required: ['chatId'],
    },
  })
  async unpinMessage(@Body() dto: { chatId: string | number; messageId?: number }) {
    const result = await this.telegramService.unpinChatMessage(dto.chatId, dto.messageId);
    return { success: true, result };
  }

  @Post('unpin-all-messages')
  @ApiOperation({ summary: 'Открепить все сообщения' })
  @ApiBody({
    schema: { type: 'object', properties: { chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['chatId'] },
  })
  async unpinAllMessages(@Body() dto: { chatId: string | number }) {
    const result = await this.telegramService.unpinAllChatMessages(dto.chatId);
    return { success: true, result };
  }

  // ========== Удаление ==========

  @Post('delete-message')
  @ApiOperation({ summary: 'Удалить сообщение' })
  @ApiBody({ type: DeleteMessageDto })
  async deleteMessage(@Body() dto: DeleteMessageDto) {
    const result = await this.telegramService.deleteMessage(dto.chatId, dto.messageId);
    return { success: true, result };
  }

  // ========== Работа с медиа ==========

  @Post('forward-message')
  @ApiOperation({ summary: 'Переслать сообщение' })
  @ApiBody({ type: ForwardMessageDto })
  async forwardMessage(@Body() dto: ForwardMessageDto) {
    const result = await this.telegramService.forwardMessage(dto.chatId, dto.fromChatId, dto.messageId);
    return { success: true, result };
  }

  @Get('get-file/:fileId')
  @ApiOperation({ summary: 'Получить информацию о файле' })
  @ApiOkResponse({ description: 'Информация о файле' })
  @ApiParam({ name: 'fileId', description: 'File ID из Telegram' })
  async getFile(@Param('fileId') fileId: string) {
    const result = await this.telegramService.getFile(fileId);
    return { success: true, result };
  }

  // ========== Получение информации ==========

  @Get('get-chat/:chatId')
  @ApiOperation({ summary: 'Получить информацию о чате' })
  @ApiOkResponse({ description: 'Информация о чате' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  async getChat(@Param('chatId') chatId: string) {
    const result = await this.telegramService.getChat(chatId);
    return { success: true, result };
  }

  @Get('get-chat-member')
  @ApiOperation({ summary: 'Получить информацию об участнике чата' })
  @ApiOkResponse({ description: 'Информация об участнике чата' })
  @ApiQuery({ name: 'chatId', required: true, description: 'ID чата' })
  @ApiQuery({ name: 'userId', required: true, description: 'ID пользователя' })
  async getChatMember(@Query('chatId') chatId: string, @Query('userId') userId: string) {
    const result = await this.telegramService.getChatMember(chatId, parseInt(userId, 10));
    return { success: true, result };
  }

  // ========== Управление участниками ==========

  @Post('ban-chat-member')
  @ApiOperation({ summary: 'Забанить участника чата' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        userId: { type: 'number' },
        untilDate: { type: 'number' },
        revokeMessages: { type: 'boolean' },
      },
      required: ['chatId', 'userId'],
    },
  })
  async banChatMember(
    @Body() dto: { chatId: string | number; userId: number; untilDate?: number; revokeMessages?: boolean },
  ) {
    const result = await this.telegramService.banChatMember(dto.chatId, dto.userId, {
      until_date: dto.untilDate,
      revoke_messages: dto.revokeMessages,
    });
    return { success: true, result };
  }

  @Post('unban-chat-member')
  @ApiOperation({ summary: 'Разбанить участника чата' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        userId: { type: 'number' },
        onlyIfBanned: { type: 'boolean' },
      },
      required: ['chatId', 'userId'],
    },
  })
  async unbanChatMember(
    @Body() dto: { chatId: string | number; userId: number; onlyIfBanned?: boolean },
  ) {
    const result = await this.telegramService.unbanChatMember(dto.chatId, dto.userId, {
      only_if_banned: dto.onlyIfBanned,
    });
    return { success: true, result };
  }

  @Post('restrict-chat-member')
  @ApiOperation({ summary: 'Ограничить права участника чата' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        userId: { type: 'number' },
        permissions: {
          type: 'object',
          properties: {
            can_send_messages: { type: 'boolean' },
            can_send_media_messages: { type: 'boolean' },
            can_send_polls: { type: 'boolean' },
            can_send_other_messages: { type: 'boolean' },
            can_add_web_page_previews: { type: 'boolean' },
            can_change_info: { type: 'boolean' },
            can_invite_users: { type: 'boolean' },
            can_pin_messages: { type: 'boolean' },
          },
        },
        untilDate: { type: 'number' },
      },
      required: ['chatId', 'userId', 'permissions'],
    },
  })
  async restrictChatMember(
    @Body()
    dto: {
      chatId: string | number;
      userId: number;
      permissions: {
        can_send_messages?: boolean;
        can_send_media_messages?: boolean;
        can_send_polls?: boolean;
        can_send_other_messages?: boolean;
        can_add_web_page_previews?: boolean;
        can_change_info?: boolean;
        can_invite_users?: boolean;
        can_pin_messages?: boolean;
      };
      untilDate?: number;
    },
  ) {
    const result = await this.telegramService.restrictChatMember(dto.chatId, dto.userId, dto.permissions, {
      until_date: dto.untilDate,
    });
    return { success: true, result };
  }

  @Post('promote-chat-member')
  @ApiOperation({ summary: 'Повысить участника до администратора' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        userId: { type: 'number' },
        permissions: {
          type: 'object',
          properties: {
            is_anonymous: { type: 'boolean' },
            can_manage_chat: { type: 'boolean' },
            can_post_messages: { type: 'boolean' },
            can_edit_messages: { type: 'boolean' },
            can_delete_messages: { type: 'boolean' },
            can_manage_video_chats: { type: 'boolean' },
            can_restrict_members: { type: 'boolean' },
            can_promote_members: { type: 'boolean' },
            can_change_info: { type: 'boolean' },
            can_invite_users: { type: 'boolean' },
            can_pin_messages: { type: 'boolean' },
            can_manage_topics: { type: 'boolean' },
          },
        },
      },
      required: ['chatId', 'userId'],
    },
  })
  async promoteChatMember(
    @Body()
    dto: {
      chatId: string | number;
      userId: number;
      permissions?: {
        is_anonymous?: boolean;
        can_manage_chat?: boolean;
        can_post_messages?: boolean;
        can_edit_messages?: boolean;
        can_delete_messages?: boolean;
        can_manage_video_chats?: boolean;
        can_restrict_members?: boolean;
        can_promote_members?: boolean;
        can_change_info?: boolean;
        can_invite_users?: boolean;
        can_pin_messages?: boolean;
        can_manage_topics?: boolean;
      };
    },
  ) {
    const result = await this.telegramService.promoteChatMember(dto.chatId, dto.userId, dto.permissions);
    return { success: true, result };
  }

  @Post('set-chat-administrator-custom-title')
  @ApiOperation({ summary: 'Установить кастомный заголовок для администратора' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chatId: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        userId: { type: 'number' },
        customTitle: { type: 'string' },
      },
      required: ['chatId', 'userId', 'customTitle'],
    },
  })
  async setChatAdministratorCustomTitle(
    @Body() dto: { chatId: string | number; userId: number; customTitle: string },
  ) {
    const result = await this.telegramService.setChatAdministratorCustomTitle(
      dto.chatId,
      dto.userId,
      dto.customTitle,
    );
    return { success: true, result };
  }

  @Get('get-user-photos/:userId')
  @ApiOperation({ summary: 'Получить фото профиля пользователя' })
  @ApiOkResponse({ description: 'Фото профиля пользователя' })
  @ApiParam({ name: 'userId', description: 'ID пользователя' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Лимит фотографий' })
  async getUserPhotos(@Param('userId') userId: string, @Query('limit') limit?: string) {
    const result = await this.telegramService.getUserProfilePhotos(parseInt(userId, 10), {
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { success: true, result };
  }

  // ========== Управление чатами ==========

  @Get('chats')
  @ApiOperation({ summary: 'Получить список всех чатов, в которых состоит бот' })
  @ApiOkResponse({ description: 'Список чатов' })
  @ApiQuery({ name: 'active', required: false, description: 'Фильтр: true — только активные' })
  async getChats(@Query('active') active?: string) {
    const chats = active === 'true' 
      ? await this.telegramChatsService.findActive()
      : await this.telegramChatsService.findAll();
    return { success: true, data: chats };
  }

  @Get('chats/stats')
  @ApiOperation({ summary: 'Получить статистику по чатам' })
  @ApiOkResponse({ description: 'Статистика по чатам' })
  async getChatStats() {
    const stats = await this.telegramChatsService.getStats();
    return { success: true, data: stats };
  }

  @Delete('chats/:chatId')
  @ApiOperation({ summary: 'Удалить чат из базы данных' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  async deleteChat(@Param('chatId') chatId: string) {
    await this.telegramChatsService.delete(chatId);
    return { success: true, message: 'Чат удален из базы данных' };
  }

  @Get('chats/:chatId')
  @ApiOperation({ summary: 'Получить информацию о конкретном чате' })
  @ApiOkResponse({ description: 'Информация о чате' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  async getChatInfo(@Param('chatId') chatId: string) {
    const chat = await this.telegramChatsService.findOne(chatId);
    if (!chat) {
      return { success: false, message: 'Чат не найден' };
    }
    
    // Получаем актуальную информацию о чате из Telegram API
    let chatInfo: TelegramChatFromApi | null = null;
    let membersCount = chat.membersCount || 0;
    
    try {
      chatInfo = (await this.telegramService.getChat(chatId)) as TelegramChatFromApi | null;
      if (chatInfo) {
        const totalMembers = chatInfo.members_count ?? membersCount;
        // Вычитаем бота из общего количества участников
        // Для групп и супергрупп бот считается участником
        if (chat.type === 'group' || chat.type === 'supergroup') {
          membersCount = Math.max(0, totalMembers - 1);
        } else {
          membersCount = totalMembers;
        }
      }
      
      // Получаем актуальное количество участников через getChatMembersCount
      // и вычитаем бота
      if (chat.type === 'group' || chat.type === 'supergroup') {
        try {
          const totalCount = await this.telegramService.getChatMemberCount(chatId);
          membersCount = Math.max(0, totalCount - 1); // Вычитаем бота
        } catch (error: unknown) {
          // Если не удалось получить, используем значение из chatInfo
        }
      }
    } catch (_error: unknown) {
      // Если не удалось получить информацию из API, используем данные из БД
      // И вычитаем бота, если это группа
      if ((chat.type === 'group' || chat.type === 'supergroup') && membersCount > 0) {
        membersCount = Math.max(0, membersCount - 1);
      }
    }
    
    return {
      success: true,
      data: {
        ...chat,
        chatInfo,
        membersCount,
      },
    };
  }

  @Get('welcome-message')
  @ApiOperation({ summary: 'Получить приветственное сообщение для групп' })
  @ApiOkResponse({ description: 'Приветственное сообщение' })
  async getWelcomeMessage() {
    const message = await this.settingsService.get('telegramGroupWelcomeMessage', '');
    return { success: true, message };
  }

  @Post('welcome-message')
  @ApiOperation({ summary: 'Установить приветственное сообщение для групп' })
  @ApiBody({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Приветственное сообщение обновлено' })
  async setWelcomeMessage(@Body() body: { message: string }) {
    await this.settingsService.set('telegramGroupWelcomeMessage', body.message || '');
    return { success: true, message: 'Приветственное сообщение обновлено' };
  }

  @Get('start-message')
  @ApiOperation({ summary: 'Получить сообщение для команды /start' })
  @ApiOkResponse({ description: 'Сообщение для /start' })
  async getStartMessage() {
    const message = await this.settingsService.get('telegramStartMessage', '');
    return { success: true, message };
  }

  @Post('start-message')
  @ApiOperation({ summary: 'Установить сообщение для команды /start' })
  @ApiBody({ schema: { type: 'object', properties: { message: { type: 'string' } } } })
  @ApiResponse({ status: 200, description: 'Сообщение для /start обновлено' })
  async setStartMessage(@Body() body: { message: string }) {
    await this.settingsService.set('telegramStartMessage', body.message || '');
    return { success: true, message: 'Сообщение для /start обновлено' };
  }

  // ========== Управление чатом ==========

  @Post('chats/:chatId/title')
  @ApiOperation({ summary: 'Установить название чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiBody({
    schema: { type: 'object', properties: { title: { type: 'string', maxLength: 255 } }, required: ['title'] },
  })
  async setChatTitle(@Param('chatId') chatId: string, @Body() body: SetChatTitleDto) {
    const result = await this.telegramService.setChatTitle(chatId, body.title);
    return { success: true, result };
  }

  @Post('chats/:chatId/description')
  @ApiOperation({ summary: 'Установить описание чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiBody({
    schema: { type: 'object', properties: { description: { type: 'string', maxLength: 500 } }, required: ['description'] },
  })
  async setChatDescription(@Param('chatId') chatId: string, @Body() body: SetChatDescriptionDto) {
    const result = await this.telegramService.setChatDescription(chatId, body.description);
    return { success: true, result };
  }

  @Post('chats/:chatId/photo')
  @ApiOperation({ summary: 'Установить фото чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiBody({
    schema: { type: 'object', properties: { photo: { type: 'string' } }, required: ['photo'] },
  })
  async setChatPhoto(@Param('chatId') chatId: string, @Body() body: { photo: string }) {
    const result = await this.telegramService.setChatPhoto(chatId, body.photo);
    return { success: true, result };
  }

  @Delete('chats/:chatId/photo')
  @ApiOperation({ summary: 'Удалить фото чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  async deleteChatPhoto(@Param('chatId') chatId: string) {
    const result = await this.telegramService.deleteChatPhoto(chatId);
    return { success: true, result };
  }

  @Post('chats/:chatId/pin')
  @ApiOperation({ summary: 'Закрепить сообщение в чате' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { messageId: { type: 'number' }, disable_notification: { type: 'boolean' } },
      required: ['messageId'],
    },
  })
  async pinChatMessage(@Param('chatId') chatId: string, @Body() body: PinMessageDto) {
    const result = await this.telegramService.pinChatMessage(chatId, body.messageId, {
      disable_notification: body.disable_notification,
    });
    return { success: true, result };
  }

  @Delete('chats/:chatId/pin')
  @ApiOperation({ summary: 'Открепить сообщение в чате' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiQuery({ name: 'messageId', required: false, description: 'ID сообщения; если не указан — открепить последнее' })
  async unpinChatMessage(@Param('chatId') chatId: string, @Query('messageId') messageId?: number) {
    const result = await this.telegramService.unpinChatMessage(chatId, messageId);
    return { success: true, result };
  }

  @Delete('chats/:chatId/pin/all')
  @ApiOperation({ summary: 'Открепить все сообщения в чате' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  async unpinAllChatMessages(@Param('chatId') chatId: string) {
    const result = await this.telegramService.unpinAllChatMessages(chatId);
    return { success: true, result };
  }

  @Post('chats/:chatId/permissions')
  @ApiOperation({ summary: 'Установить разрешения чата' })
  @ApiParam({ name: 'chatId', description: 'ID чата' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        can_send_messages: { type: 'boolean' },
        can_send_media_messages: { type: 'boolean' },
        can_send_polls: { type: 'boolean' },
        can_send_other_messages: { type: 'boolean' },
        can_add_web_page_previews: { type: 'boolean' },
        can_change_info: { type: 'boolean' },
        can_invite_users: { type: 'boolean' },
        can_pin_messages: { type: 'boolean' },
      },
    },
  })
  async setChatPermissions(
    @Param('chatId') chatId: string,
    @Body() body: Parameters<TelegramService['setChatPermissions']>[1],
  ) {
    const result = await this.telegramService.setChatPermissions(chatId, body);
    return { success: true, result };
  }

  @Post('chats/refresh')
  @ApiOperation({ summary: 'Обновить список чатов (проверить актуальность)' })
  async refreshChats() {
    // Получаем все чаты из БД (и активные, и неактивные)
    const allChats = await this.telegramChatsService.findAll();
    const bot = this.telegramBotService.getBot();
    
    if (!bot) {
      return { success: false, message: 'Бот не инициализирован' };
    }

    const results = {
      checked: 0,
      removed: 0,
      updated: 0,
      added: 0,
      errors: [] as string[],
    };

    // Создаем Set для быстрого поиска чатов по chatId
    // const existingChatIds = new Set(allChats.map(chat => chat.chatId)); // Не используется
    const processedChatIds = new Set<string>();

    // Проверяем существующие чаты
    for (const chat of allChats) {
      try {
        results.checked++;
        processedChatIds.add(chat.chatId);
        
        // Пытаемся получить информацию о чате из Telegram API
        const chatInfo = await this.telegramService.getChat(chat.chatId);
        
        if (chatInfo) {
          const ci = chatInfo as TelegramChatFromApi;
          // Чат существует, обновляем информацию
          const totalMembers = ci.members_count ?? chat.membersCount ?? 0;
          let membersCount = totalMembers;
          
          if (chat.type === 'group' || chat.type === 'supergroup') {
            membersCount = Math.max(0, totalMembers - 1);
          }
          
          chat.membersCount = membersCount;
          chat.title = ci.title ?? chat.title;
          chat.username = ci.username ?? chat.username;
          chat.description = ci.description ?? chat.description;
          chat.isActive = true;
          await this.telegramChatsService.save(chat);
          results.updated++;
        }
      } catch (error: unknown) {
        const e = error as { code?: number; description?: string };
        if (e.code === 400 || e.description?.includes('chat not found') || e.description?.includes('bot is not a member')) {
          chat.isActive = false;
          await this.telegramChatsService.save(chat);
          results.removed++;
        } else {
          results.errors.push(`Ошибка при проверке чата ${chat.chatId}: ${getErrorMessage(error)}`);
        }
      }
    }

    // Пытаемся найти новые чаты через getUpdates (последние обновления)
    try {
      const updates = await bot.telegram.getUpdates(0, 100, 0, ['message', 'channel_post']);
      
      for (const update of updates) {
        let chatId: string | undefined;
        
        // Проверяем тип обновления и извлекаем chatId
        if ('message' in update && update.message?.chat) {
          chatId = update.message.chat.id.toString();
        } else if ('channel_post' in update && update.channel_post?.chat) {
          chatId = update.channel_post.chat.id.toString();
        }
        
        if (chatId && !processedChatIds.has(chatId)) {
          try {
            // Проверяем, является ли это группой/супергруппой/каналом
            const chatInfo = (await this.telegramService.getChat(chatId)) as TelegramChatFromApi | null;
            const chatType = chatInfo?.type;
            
            if (chatType === 'group' || chatType === 'supergroup' || chatType === 'channel') {
              // Проверяем, является ли бот участником
              try {
                const botInfo = await bot.telegram.getMe();
                const member = await this.telegramService.getChatMember(chatId, botInfo.id);
                
                if (member && member.status !== 'left' && member.status !== 'kicked') {
                  const existingChat = await this.telegramChatsService.findOne(chatId);
                  if (!existingChat) {
                    let chatTypeEnum: ChatType;
                    if (chatType === 'group') {
                      chatTypeEnum = ChatType.GROUP;
                    } else if (chatType === 'supergroup') {
                      chatTypeEnum = ChatType.SUPERGROUP;
                    } else if (chatType === 'channel') {
                      chatTypeEnum = ChatType.CHANNEL;
                    } else {
                      chatTypeEnum = ChatType.PRIVATE;
                    }
                    const totalMembers = chatInfo?.members_count ?? null;
                    let membersCount: number | null = totalMembers;
                    if (chatType === 'group' || chatType === 'supergroup') {
                      membersCount = totalMembers != null ? Math.max(0, totalMembers - 1) : null;
                    }
                    const newChat = this.telegramChatsService.create({
                      chatId,
                      type: chatTypeEnum,
                      title: chatInfo?.title,
                      username: chatInfo?.username,
                      description: chatInfo?.description,
                      membersCount: membersCount ?? 0,
                      isActive: true,
                    });
                    await this.telegramChatsService.save(newChat);
                    results.added++;
                  }
                  processedChatIds.add(chatId);
                }
              } catch (_memberError: unknown) {
                // Бот не является участником, пропускаем
              }
            }
          } catch (_err: unknown) {
            // Ошибка при получении информации о чате, пропускаем
          }
        }
      }
    } catch (error: unknown) {
      this.logger.warn(`Не удалось получить обновления для поиска новых чатов: ${getErrorMessage(error)}`);
    }

    return {
      success: true,
      data: results,
    };
  }
}

