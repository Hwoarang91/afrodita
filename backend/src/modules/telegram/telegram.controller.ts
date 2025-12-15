import { Controller, Post, Body, Get, Param, UseGuards, Query, Delete, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
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
  @ApiResponse({ status: 200, description: 'Сообщение отправлено' })
  async sendMessage(@Body() dto: SendMessageDto) {
    // Заменяем переменные в сообщении, если они есть
    let message = dto.message;
    try {
      // Получаем информацию о чате
      const chatInfo = await this.telegramService.getChat(dto.chatId);
      
      // Получаем информацию о пользователе, если это личный чат
      let userInfo: any = null;
      if (chatInfo.type === 'private') {
        try {
          // Для личного чата chatId равен userId, преобразуем в число
          const userId = typeof dto.chatId === 'string' ? parseInt(dto.chatId, 10) : dto.chatId;
          if (!isNaN(userId)) {
            const chatMember = await this.telegramService.getChatMember(dto.chatId, userId);
            userInfo = chatMember.user;
          }
        } catch (error) {
          // Игнорируем ошибку, если не удалось получить информацию о пользователе
        }
      }
      
      // Заменяем переменные
      message = this.telegramBotService.replaceMessageVariables(message, userInfo, chatInfo);
    } catch (error: any) {
      // Если не удалось получить информацию о чате, отправляем сообщение без замены переменных
      this.logger.warn(`Не удалось получить информацию о чате для замены переменных: ${error.message}`);
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
  async sendPhoto(@Body() dto: SendPhotoDto) {
    // Заменяем переменные в caption, если они есть
    let caption = dto.caption;
    if (caption) {
      try {
        const chatInfo = await this.telegramService.getChat(dto.chatId);
        let userInfo: any = null;
        if (chatInfo.type === 'private') {
          try {
            // Для личного чата chatId равен userId, преобразуем в число
            const userId = typeof dto.chatId === 'string' ? parseInt(dto.chatId, 10) : dto.chatId;
            if (!isNaN(userId)) {
              const chatMember = await this.telegramService.getChatMember(dto.chatId, userId);
              userInfo = chatMember.user;
            }
          } catch (error) {
            // Игнорируем ошибку
          }
        }
        caption = this.telegramBotService.replaceMessageVariables(caption, userInfo, chatInfo);
      } catch (error: any) {
        this.logger.warn(`Не удалось получить информацию о чате для замены переменных в caption: ${error.message}`);
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
  async sendSticker(@Body() dto: { chatId: string | number; sticker: string }) {
    const result = await this.telegramService.sendSticker(dto.chatId, dto.sticker);
    return { success: true, result };
  }

  @Post('send-animation')
  @ApiOperation({ summary: 'Отправка анимации (GIF)' })
  async sendAnimation(@Body() dto: SendMediaDto) {
    const result = await this.telegramService.sendAnimation(dto.chatId, dto.media, {
      caption: dto.caption,
      parse_mode: dto.parse_mode || 'HTML', // По умолчанию HTML для поддержки всех тегов
    });
    return { success: true, result };
  }

  @Post('send-location')
  @ApiOperation({ summary: 'Отправка локации' })
  async sendLocation(@Body() dto: SendLocationDto) {
    const result = await this.telegramService.sendLocation(dto.chatId, dto.latitude, dto.longitude);
    return { success: true, result };
  }

  @Post('send-venue')
  @ApiOperation({ summary: 'Отправка места (venue)' })
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
  async sendContact(@Body() dto: SendContactDto) {
    const result = await this.telegramService.sendContact(dto.chatId, dto.phoneNumber, dto.firstName);
    return { success: true, result };
  }

  @Post('send-poll')
  @ApiOperation({ summary: 'Отправка опроса' })
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
  async sendDice(@Body() dto: { chatId: string | number; emoji?: string }) {
    const result = await this.telegramService.sendDice(dto.chatId, { emoji: dto.emoji });
    return { success: true, result };
  }

  // ========== Управление чатом ==========


  @Post('pin-message')
  @ApiOperation({ summary: 'Закрепить сообщение' })
  async pinMessage(@Body() dto: PinMessageDto) {
    const result = await this.telegramService.pinChatMessage(dto.chatId, dto.messageId, {
      disable_notification: dto.disable_notification,
    });
    return { success: true, result };
  }

  @Post('unpin-message')
  @ApiOperation({ summary: 'Открепить сообщение' })
  async unpinMessage(@Body() dto: { chatId: string | number; messageId?: number }) {
    const result = await this.telegramService.unpinChatMessage(dto.chatId, dto.messageId);
    return { success: true, result };
  }

  @Post('unpin-all-messages')
  @ApiOperation({ summary: 'Открепить все сообщения' })
  async unpinAllMessages(@Body() dto: { chatId: string | number }) {
    const result = await this.telegramService.unpinAllChatMessages(dto.chatId);
    return { success: true, result };
  }

  // ========== Удаление ==========

  @Post('delete-message')
  @ApiOperation({ summary: 'Удалить сообщение' })
  async deleteMessage(@Body() dto: DeleteMessageDto) {
    const result = await this.telegramService.deleteMessage(dto.chatId, dto.messageId);
    return { success: true, result };
  }

  // ========== Работа с медиа ==========

  @Post('forward-message')
  @ApiOperation({ summary: 'Переслать сообщение' })
  async forwardMessage(@Body() dto: ForwardMessageDto) {
    const result = await this.telegramService.forwardMessage(dto.chatId, dto.fromChatId, dto.messageId);
    return { success: true, result };
  }

  @Get('get-file/:fileId')
  @ApiOperation({ summary: 'Получить информацию о файле' })
  async getFile(@Param('fileId') fileId: string) {
    const result = await this.telegramService.getFile(fileId);
    return { success: true, result };
  }

  // ========== Получение информации ==========

  @Get('get-chat/:chatId')
  @ApiOperation({ summary: 'Получить информацию о чате' })
  async getChat(@Param('chatId') chatId: string) {
    const result = await this.telegramService.getChat(chatId);
    return { success: true, result };
  }

  @Get('get-chat-member')
  @ApiOperation({ summary: 'Получить информацию об участнике чата' })
  async getChatMember(@Query('chatId') chatId: string, @Query('userId') userId: string) {
    const result = await this.telegramService.getChatMember(chatId, parseInt(userId, 10));
    return { success: true, result };
  }

  // ========== Управление участниками ==========

  @Post('ban-chat-member')
  @ApiOperation({ summary: 'Забанить участника чата' })
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
  async getUserPhotos(@Param('userId') userId: string, @Query('limit') limit?: string) {
    const result = await this.telegramService.getUserProfilePhotos(parseInt(userId, 10), {
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { success: true, result };
  }

  // ========== Управление чатами ==========

  @Get('chats')
  @ApiOperation({ summary: 'Получить список всех чатов, в которых состоит бот' })
  async getChats(@Query('active') active?: string) {
    const chats = active === 'true' 
      ? await this.telegramChatsService.findActive()
      : await this.telegramChatsService.findAll();
    return { success: true, data: chats };
  }

  @Get('chats/stats')
  @ApiOperation({ summary: 'Получить статистику по чатам' })
  async getChatStats() {
    const stats = await this.telegramChatsService.getStats();
    return { success: true, data: stats };
  }

  @Delete('chats/:chatId')
  @ApiOperation({ summary: 'Удалить чат из базы данных' })
  async deleteChat(@Param('chatId') chatId: string) {
    await this.telegramChatsService.delete(chatId);
    return { success: true, message: 'Чат удален из базы данных' };
  }

  @Get('chats/:chatId')
  @ApiOperation({ summary: 'Получить информацию о конкретном чате' })
  async getChatInfo(@Param('chatId') chatId: string) {
    const chat = await this.telegramChatsService.findOne(chatId);
    if (!chat) {
      return { success: false, message: 'Чат не найден' };
    }
    
    // Получаем актуальную информацию о чате из Telegram API
    let chatInfo: any = null;
    let membersCount = chat.membersCount || 0;
    
    try {
      chatInfo = await this.telegramService.getChat(chatId);
      if (chatInfo) {
        const totalMembers = (chatInfo as any).members_count || membersCount;
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
        } catch (error) {
          // Если не удалось получить, используем значение из chatInfo
        }
      }
    } catch (error: any) {
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
  async getWelcomeMessage() {
    const message = await this.settingsService.get('telegramGroupWelcomeMessage', '');
    return { success: true, message };
  }

  @Post('welcome-message')
  @ApiOperation({ summary: 'Установить приветственное сообщение для групп' })
  @ApiResponse({ status: 200, description: 'Приветственное сообщение обновлено' })
  async setWelcomeMessage(@Body() body: { message: string }) {
    await this.settingsService.set('telegramGroupWelcomeMessage', body.message || '');
    return { success: true, message: 'Приветственное сообщение обновлено' };
  }

  @Get('start-message')
  @ApiOperation({ summary: 'Получить сообщение для команды /start' })
  @ApiResponse({ status: 200, description: 'Сообщение для /start' })
  async getStartMessage() {
    const message = await this.settingsService.get('telegramStartMessage', '');
    return { success: true, message };
  }

  @Post('start-message')
  @ApiOperation({ summary: 'Установить сообщение для команды /start' })
  @ApiResponse({ status: 200, description: 'Сообщение для /start обновлено' })
  async setStartMessage(@Body() body: { message: string }) {
    await this.settingsService.set('telegramStartMessage', body.message || '');
    return { success: true, message: 'Сообщение для /start обновлено' };
  }

  // ========== Управление чатом ==========

  @Post('chats/:chatId/title')
  @ApiOperation({ summary: 'Установить название чата' })
  async setChatTitle(@Param('chatId') chatId: string, @Body() body: SetChatTitleDto) {
    const result = await this.telegramService.setChatTitle(chatId, body.title);
    return { success: true, result };
  }

  @Post('chats/:chatId/description')
  @ApiOperation({ summary: 'Установить описание чата' })
  async setChatDescription(@Param('chatId') chatId: string, @Body() body: SetChatDescriptionDto) {
    const result = await this.telegramService.setChatDescription(chatId, body.description);
    return { success: true, result };
  }

  @Post('chats/:chatId/photo')
  @ApiOperation({ summary: 'Установить фото чата' })
  async setChatPhoto(@Param('chatId') chatId: string, @Body() body: { photo: string }) {
    const result = await this.telegramService.setChatPhoto(chatId, body.photo);
    return { success: true, result };
  }

  @Delete('chats/:chatId/photo')
  @ApiOperation({ summary: 'Удалить фото чата' })
  async deleteChatPhoto(@Param('chatId') chatId: string) {
    const result = await this.telegramService.deleteChatPhoto(chatId);
    return { success: true, result };
  }

  @Post('chats/:chatId/pin')
  @ApiOperation({ summary: 'Закрепить сообщение в чате' })
  async pinChatMessage(@Param('chatId') chatId: string, @Body() body: PinMessageDto) {
    const result = await this.telegramService.pinChatMessage(chatId, body.messageId, {
      disable_notification: body.disable_notification,
    });
    return { success: true, result };
  }

  @Delete('chats/:chatId/pin')
  @ApiOperation({ summary: 'Открепить сообщение в чате' })
  async unpinChatMessage(@Param('chatId') chatId: string, @Query('messageId') messageId?: number) {
    const result = await this.telegramService.unpinChatMessage(chatId, messageId);
    return { success: true, result };
  }

  @Delete('chats/:chatId/pin/all')
  @ApiOperation({ summary: 'Открепить все сообщения в чате' })
  async unpinAllChatMessages(@Param('chatId') chatId: string) {
    const result = await this.telegramService.unpinAllChatMessages(chatId);
    return { success: true, result };
  }

  @Post('chats/:chatId/permissions')
  @ApiOperation({ summary: 'Установить разрешения чата' })
  async setChatPermissions(@Param('chatId') chatId: string, @Body() body: any) {
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
          // Чат существует, обновляем информацию
          const totalMembers = (chatInfo as any).members_count || chat.membersCount || 0;
          let membersCount = totalMembers;
          
          if (chat.type === 'group' || chat.type === 'supergroup') {
            membersCount = Math.max(0, totalMembers - 1);
          }
          
          chat.membersCount = membersCount;
          chat.title = (chatInfo as any).title || chat.title;
          chat.username = (chatInfo as any).username || chat.username;
          chat.description = (chatInfo as any).description || chat.description;
          chat.isActive = true;
          
          // Обновляем через сервис
          const chatRepo = (this.telegramChatsService as any).telegramChatRepository;
          await chatRepo.save(chat);
          results.updated++;
        }
      } catch (error: any) {
        // Если чат не найден или бот удален из чата
        if (error.code === 400 || error.description?.includes('chat not found') || error.description?.includes('bot is not a member')) {
          chat.isActive = false;
          const chatRepo = (this.telegramChatsService as any).telegramChatRepository;
          await chatRepo.save(chat);
          results.removed++;
        } else {
          results.errors.push(`Ошибка при проверке чата ${chat.chatId}: ${error.message}`);
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
            const chatInfo = await this.telegramService.getChat(chatId);
            const chatType = (chatInfo as any).type;
            
            if (chatType === 'group' || chatType === 'supergroup' || chatType === 'channel') {
              // Проверяем, является ли бот участником
              try {
                const botInfo = await bot.telegram.getMe();
                const member = await this.telegramService.getChatMember(chatId, botInfo.id);
                
                if (member && member.status !== 'left' && member.status !== 'kicked') {
                  // Бот является участником, сохраняем чат через сервис
                  const chatRepo = (this.telegramChatsService as any).telegramChatRepository;
                  const existingChat = await chatRepo.findOne({ where: { chatId } });
                  
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
                    
                    const totalMembers = (chatInfo as any).members_count || null;
                    let membersCount = totalMembers;
                    if (chatType === 'group' || chatType === 'supergroup') {
                      membersCount = totalMembers ? Math.max(0, totalMembers - 1) : null;
                    }
                    
                    const newChat = chatRepo.create({
                      chatId: chatId,
                      type: chatTypeEnum,
                      title: (chatInfo as any).title || null,
                      username: (chatInfo as any).username || null,
                      description: (chatInfo as any).description || null,
                      membersCount: membersCount,
                      isActive: true,
                    });
                    await chatRepo.save(newChat);
                    results.added++;
                  }
                  processedChatIds.add(chatId);
                }
              } catch (memberError: any) {
                // Бот не является участником, пропускаем
              }
            }
          } catch (error: any) {
            // Ошибка при получении информации о чате, пропускаем
          }
        }
      }
    } catch (error: any) {
      // Если getUpdates не доступен (например, при использовании webhook), просто логируем
      this.logger.warn(`Не удалось получить обновления для поиска новых чатов: ${error.message}`);
    }

    return {
      success: true,
      data: results,
    };
  }
}

