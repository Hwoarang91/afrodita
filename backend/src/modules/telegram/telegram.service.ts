import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { Markup } from 'telegraf';

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_to_message_id?: number;
  disable_notification?: boolean;
  disable_web_page_preview?: boolean;
  reply_markup?: any;
}

export interface SendPhotoOptions extends SendMessageOptions {
  caption?: string;
}

export interface SendMediaOptions {
  caption?: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_to_message_id?: number;
  disable_notification?: boolean;
}

export interface SendLocationOptions {
  reply_to_message_id?: number;
  disable_notification?: boolean;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface SendVenueOptions {
  reply_to_message_id?: number;
  disable_notification?: boolean;
  foursquare_id?: string;
  foursquare_type?: string;
  google_place_id?: string;
  google_place_type?: string;
}

export interface SendContactOptions {
  reply_to_message_id?: number;
  disable_notification?: boolean;
  vcard?: string;
}

export interface SendPollOptions {
  is_anonymous?: boolean;
  type?: 'quiz' | 'regular';
  allows_multiple_answers?: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  open_period?: number;
  close_date?: number;
  is_closed?: boolean;
  reply_to_message_id?: number;
  disable_notification?: boolean;
}

@Injectable()
export class TelegramService {
  constructor(
    private botService: TelegramBotService,
  ) {}

  private getBot() {
    const bot = this.botService.getBot();
    if (!bot) {
      throw new ServiceUnavailableException('Bot is not initialized');
    }
    return bot;
  }

  // ========== Базовые методы отправки сообщений ==========

  async sendMessage(
    chatId: string | number,
    message: string,
    options?: SendMessageOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendMessage(chatId, message, options);
  }

  async sendNotification(telegramId: string, title: string, message: string): Promise<void> {
    const fullMessage = `*${title}*\n\n${message}`;
    await this.sendMessage(telegramId, fullMessage, { parse_mode: 'Markdown' });
  }

  // ========== Медиа сообщения ==========

  async sendPhoto(
    chatId: string | number,
    photo: string | any,
    options?: SendPhotoOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendPhoto(chatId, photo as any, options);
  }

  async sendVideo(
    chatId: string | number,
    video: string | any,
    options?: SendMediaOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendVideo(chatId, video as any, options);
  }

  async sendAudio(
    chatId: string | number,
    audio: string | any,
    options?: SendMediaOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendAudio(chatId, audio as any, options);
  }

  async sendVoice(
    chatId: string | number,
    voice: string | any,
    options?: SendMediaOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendVoice(chatId, voice as any, options);
  }

  async sendVideoNote(
    chatId: string | number,
    videoNote: string | any,
    options?: { reply_to_message_id?: number; disable_notification?: boolean; length?: number; duration?: number },
  ): Promise<any> {
    return await this.getBot().telegram.sendVideoNote(chatId, videoNote as any, options);
  }

  async sendSticker(
    chatId: string | number,
    sticker: string | any,
    options?: { reply_to_message_id?: number; disable_notification?: boolean },
  ): Promise<any> {
    return await this.getBot().telegram.sendSticker(chatId, sticker as any, options);
  }

  async sendDocument(
    chatId: string | number,
    document: string | any,
    options?: SendMediaOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendDocument(chatId, document as any, options);
  }

  async sendAnimation(
    chatId: string | number,
    animation: string | any,
    options?: SendMediaOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendAnimation(chatId, animation as any, options);
  }

  // ========== Локация и контакты ==========

  async sendLocation(
    chatId: string | number,
    latitude: number,
    longitude: number,
    options?: SendLocationOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendLocation(chatId, latitude, longitude, options);
  }

  async sendVenue(
    chatId: string | number,
    latitude: number,
    longitude: number,
    title: string,
    address: string,
    options?: SendVenueOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendVenue(
      chatId,
      latitude,
      longitude,
      title,
      address,
      options,
    );
  }

  async sendContact(
    chatId: string | number,
    phoneNumber: string,
    firstName: string,
    options?: SendContactOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendContact(chatId, phoneNumber, firstName, options);
  }

  // ========== Специальные типы ==========

  async sendDice(
    chatId: string | number,
    options?: { emoji?: string; reply_to_message_id?: number; disable_notification?: boolean },
  ): Promise<any> {
    return await this.getBot().telegram.sendDice(chatId, options);
  }

  async sendPoll(
    chatId: string | number,
    question: string,
    options: string[],
    pollOptions?: SendPollOptions,
  ): Promise<any> {
    return await this.getBot().telegram.sendPoll(chatId, question, options, pollOptions);
  }

  // ========== Действия чата ==========

  async sendChatAction(
    chatId: string | number,
    action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note',
  ): Promise<boolean> {
    return await this.getBot().telegram.sendChatAction(chatId, action);
  }

  // ========== Работа с медиа ==========

  async getFile(fileId: string): Promise<any> {
    return await this.getBot().telegram.getFile(fileId);
  }

  async forwardMessage(
    chatId: string | number,
    fromChatId: string | number,
    messageId: number,
    options?: { disable_notification?: boolean },
  ): Promise<any> {
    return await this.getBot().telegram.forwardMessage(chatId, fromChatId, messageId, options);
  }

  // ========== Управление чатом ==========

  async setChatTitle(chatId: string | number, title: string): Promise<boolean> {
    return await this.getBot().telegram.setChatTitle(chatId, title);
  }

  async setChatDescription(chatId: string | number, description: string): Promise<boolean> {
    return await this.getBot().telegram.setChatDescription(chatId, description);
  }

  async setChatPhoto(chatId: string | number, photo: string | any): Promise<boolean> {
    return await this.getBot().telegram.setChatPhoto(chatId, photo as any);
  }

  async deleteChatPhoto(chatId: string | number): Promise<boolean> {
    return await this.getBot().telegram.deleteChatPhoto(chatId);
  }

  async pinChatMessage(
    chatId: string | number,
    messageId: number,
    options?: { disable_notification?: boolean },
  ): Promise<boolean> {
    return await this.getBot().telegram.pinChatMessage(chatId, messageId, options);
  }

  async unpinChatMessage(chatId: string | number, messageId?: number): Promise<boolean> {
    return await this.getBot().telegram.unpinChatMessage(chatId, messageId);
  }

  async unpinAllChatMessages(chatId: string | number): Promise<boolean> {
    return await this.getBot().telegram.unpinAllChatMessages(chatId);
  }

  async setChatPermissions(
    chatId: string | number,
    permissions: {
      can_send_messages?: boolean;
      can_send_media_messages?: boolean;
      can_send_polls?: boolean;
      can_send_other_messages?: boolean;
      can_add_web_page_previews?: boolean;
      can_change_info?: boolean;
      can_invite_users?: boolean;
      can_pin_messages?: boolean;
    },
  ): Promise<boolean> {
    return await this.getBot().telegram.setChatPermissions(chatId, permissions);
  }

  // ========== Удаление контента ==========

  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    return await this.getBot().telegram.deleteMessage(chatId, messageId);
  }

  async deleteMyCommands(options?: { scope?: any; language_code?: string }): Promise<boolean> {
    return await this.getBot().telegram.deleteMyCommands(options);
  }

  // ========== Получение информации ==========

  async getUserProfilePhotos(userId: number, options?: { offset?: number; limit?: number }): Promise<any> {
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return await this.getBot().telegram.getUserProfilePhotos(userId, offset, limit);
  }

  async getChat(chatId: string | number): Promise<any> {
    return await this.getBot().telegram.getChat(chatId);
  }

  async getChatMember(chatId: string | number, userId: number): Promise<any> {
    return await this.getBot().telegram.getChatMember(chatId, userId);
  }

  async getChatMemberCount(chatId: string | number): Promise<number> {
    try {
      const result = await this.getBot().telegram.getChatMembersCount(chatId);
      return result;
    } catch (_error: unknown) {
      return 0;
    }
  }

  // ========== Управление участниками ==========

  async banChatMember(
    chatId: string | number,
    userId: number,
    options?: { until_date?: number; revoke_messages?: boolean },
  ): Promise<boolean> {
    const untilDate = options?.until_date;
    if (options?.revoke_messages !== undefined) {
      return await this.getBot().telegram.banChatMember(chatId, userId, untilDate, {
        revoke_messages: options.revoke_messages,
      });
    }
    return await this.getBot().telegram.banChatMember(chatId, userId, untilDate);
  }

  async unbanChatMember(
    chatId: string | number,
    userId: number,
    options?: { only_if_banned?: boolean },
  ): Promise<boolean> {
    return await this.getBot().telegram.unbanChatMember(chatId, userId, options);
  }

  async restrictChatMember(
    chatId: string | number,
    userId: number,
    permissions: {
      can_send_messages?: boolean;
      can_send_media_messages?: boolean;
      can_send_polls?: boolean;
      can_send_other_messages?: boolean;
      can_add_web_page_previews?: boolean;
      can_change_info?: boolean;
      can_invite_users?: boolean;
      can_pin_messages?: boolean;
    },
    options?: { until_date?: number },
  ): Promise<boolean> {
    const untilDate = options?.until_date;
    // Telegraf: restrictChatMember(chatId, userId, permissions, extra?); as any — типы @types/telegraf для permissions/until_date
    if (untilDate !== undefined) {
      return await this.getBot().telegram.restrictChatMember(chatId, userId, {
        permissions,
        until_date: untilDate,
      } as any);
    }
    return await this.getBot().telegram.restrictChatMember(chatId, userId, { permissions } as any);
  }

  async promoteChatMember(
    chatId: string | number,
    userId: number,
    options?: {
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
    },
  ): Promise<boolean> {
    return await this.getBot().telegram.promoteChatMember(chatId, userId, options ?? {});
  }

  async setChatAdministratorCustomTitle(
    chatId: string | number,
    userId: number,
    customTitle: string,
  ): Promise<boolean> {
    return await this.getBot().telegram.setChatAdministratorCustomTitle(chatId, userId, customTitle);
  }

  // ========== Inline кнопки ==========

  createInlineKeyboard(buttons: Array<Array<{ text: string; callback_data?: string; url?: string; switch_inline_query?: string; request_contact?: boolean; request_location?: boolean }>>) {
    const keyboardButtons: any[][] = buttons.map(row =>
      row.map(btn => {
        if (btn.url) {
          return Markup.button.url(btn.text, btn.url);
        } else if (btn.switch_inline_query) {
          // Используем callback_data как fallback, если switchInlineQuery не поддерживается
          return Markup.button.callback(btn.text, btn.switch_inline_query);
        } else if (btn.request_contact) {
          return Markup.button.contactRequest(btn.text);
        } else if (btn.request_location) {
          return Markup.button.locationRequest(btn.text);
        } else {
          return Markup.button.callback(btn.text, btn.callback_data || '');
        }
      })
    );
    return Markup.inlineKeyboard(keyboardButtons as any);
  }

  createReplyKeyboard(
    buttons: Array<Array<string>>,
    options?: { resize_keyboard?: boolean; one_time_keyboard?: boolean; selective?: boolean },
  ) {
    return Markup.keyboard(buttons.map(row => row.map(text => Markup.button.text(text))))
      .resize(options?.resize_keyboard)
      .oneTime(options?.one_time_keyboard)
      .selective(options?.selective);
  }

  removeKeyboard(selective?: boolean) {
    const keyboard = Markup.removeKeyboard();
    if (selective) {
      return { ...keyboard, selective: true } as any;
    }
    return keyboard;
  }

  forceReply(selective?: boolean) {
    const reply = Markup.forceReply();
    if (selective) {
      return { ...reply, selective: true } as any;
    }
    return reply;
  }
}

