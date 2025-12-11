import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';

describe('TelegramService', () => {
  let service: TelegramService;
  let botService: TelegramBotService;

  const mockBot = {
    telegram: {
      sendMessage: jest.fn(),
      sendPhoto: jest.fn(),
      sendVideo: jest.fn(),
      sendAudio: jest.fn(),
      sendVoice: jest.fn(),
      sendDocument: jest.fn(),
      sendSticker: jest.fn(),
      sendAnimation: jest.fn(),
      sendLocation: jest.fn(),
      sendVenue: jest.fn(),
      sendContact: jest.fn(),
      sendPoll: jest.fn(),
      sendDice: jest.fn(),
      pinChatMessage: jest.fn(),
      unpinChatMessage: jest.fn(),
      unpinAllChatMessages: jest.fn(),
      forwardMessage: jest.fn(),
      getFile: jest.fn(),
      getChat: jest.fn(),
      getChatMember: jest.fn(),
      getChatMembersCount: jest.fn(),
      setChatTitle: jest.fn(),
      setChatDescription: jest.fn(),
      setChatPhoto: jest.fn(),
      deleteChatPhoto: jest.fn(),
      setChatPermissions: jest.fn(),
      getUserProfilePhotos: jest.fn(),
      sendChatAction: jest.fn(),
      editMessageText: jest.fn(),
      deleteMessage: jest.fn(),
    },
  };

  const mockBotService = {
    getBot: jest.fn().mockReturnValue(mockBot),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: TelegramBotService,
          useValue: mockBotService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    botService = module.get<TelegramBotService>(TelegramBotService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение', async () => {
      const chatId = '123456789';
      const message = 'Test message';
      const result = { message_id: 1 };

      mockBot.telegram.sendMessage.mockResolvedValue(result);

      const response = await service.sendMessage(chatId, message);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        message,
        undefined,
      );
    });

    it('должен отправить сообщение с опциями', async () => {
      const chatId = '123456789';
      const message = 'Test message';
      const options = { parse_mode: 'Markdown' as const };
      const result = { message_id: 1 };

      mockBot.telegram.sendMessage.mockResolvedValue(result);

      const response = await service.sendMessage(chatId, message, options);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        chatId,
        message,
        options,
      );
    });
  });

  describe('sendNotification', () => {
    it('должен отправить уведомление с заголовком и сообщением', async () => {
      const telegramId = '123456789';
      const title = 'Test Title';
      const message = 'Test message';
      const result = { message_id: 1 };

      mockBot.telegram.sendMessage.mockResolvedValue(result);

      await service.sendNotification(telegramId, title, message);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        telegramId,
        `*${title}*\n\n${message}`,
        { parse_mode: 'Markdown' as const },
      );
    });
  });

  describe('sendPhoto', () => {
    it('должен отправить фото', async () => {
      const chatId = '123456789';
      const photo = 'https://example.com/photo.jpg';
      const result = { message_id: 1 };

      mockBot.telegram.sendPhoto.mockResolvedValue(result);

      const response = await service.sendPhoto(chatId, photo);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendPhoto).toHaveBeenCalledWith(
        chatId,
        photo,
        undefined,
      );
    });
  });

  describe('createInlineKeyboard', () => {
    it('должен создать inline клавиатуру', () => {
      const buttons = [
        [{ text: 'Button 1', callback_data: 'action1' }],
        [{ text: 'Button 2', callback_data: 'action2' }],
      ];

      const result = service.createInlineKeyboard(buttons);

      expect(result).toHaveProperty('reply_markup');
      expect(result.reply_markup).toHaveProperty('inline_keyboard');
      expect(Array.isArray(result.reply_markup.inline_keyboard)).toBe(true);
    });
  });

  describe('createReplyKeyboard', () => {
    it('должен создать reply клавиатуру', () => {
      const buttons = [
        ['Button 1', 'Button 2'],
        ['Button 3'],
      ];

      const result = service.createReplyKeyboard(buttons);

      expect(result).toHaveProperty('reply_markup');
      expect(result.reply_markup).toHaveProperty('keyboard');
    });

    it('должен создать reply клавиатуру с опциями', () => {
      const buttons = [['Button 1']];
      const options = { resize_keyboard: true, one_time_keyboard: true };

      const result = service.createReplyKeyboard(buttons, options);

      expect(result.reply_markup.resize_keyboard).toBe(true);
      expect(result.reply_markup.one_time_keyboard).toBe(true);
    });
  });

  describe('getBot - edge cases', () => {
    it('должен выбросить ошибку если бот не инициализирован', async () => {
      mockBotService.getBot.mockReturnValueOnce(null);

      await expect(service.sendMessage('123', 'test')).rejects.toThrow('Bot is not initialized');
    });
  });

  describe('deleteMessage', () => {
    it('должен удалить сообщение', async () => {
      const chatId = '123456789';
      const messageId = 1;
      const result = { ok: true };

      mockBot.telegram.deleteMessage.mockResolvedValue(result);

      const response = await service.deleteMessage(chatId, messageId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.deleteMessage).toHaveBeenCalledWith(
        chatId,
        messageId,
      );
    });
  });

  describe('sendVideo', () => {
    it('должен отправить видео', async () => {
      const chatId = '123456789';
      const video = 'https://example.com/video.mp4';
      const result = { message_id: 1 };

      mockBot.telegram.sendVideo = jest.fn().mockResolvedValue(result);

      const response = await service.sendVideo(chatId, video);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendVideo).toHaveBeenCalledWith(chatId, video, undefined);
    });
  });

  describe('sendAudio', () => {
    it('должен отправить аудио', async () => {
      const chatId = '123456789';
      const audio = 'https://example.com/audio.mp3';
      const result = { message_id: 1 };

      mockBot.telegram.sendAudio = jest.fn().mockResolvedValue(result);

      const response = await service.sendAudio(chatId, audio);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendAudio).toHaveBeenCalledWith(chatId, audio, undefined);
    });
  });

  describe('sendVoice', () => {
    it('должен отправить голосовое сообщение', async () => {
      const chatId = '123456789';
      const voice = 'voice-file-id';
      const result = { message_id: 1 };

      mockBot.telegram.sendVoice = jest.fn().mockResolvedValue(result);

      const response = await service.sendVoice(chatId, voice);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendVoice).toHaveBeenCalledWith(chatId, voice, undefined);
    });
  });

  describe('sendDocument', () => {
    it('должен отправить документ', async () => {
      const chatId = '123456789';
      const document = 'https://example.com/doc.pdf';
      const result = { message_id: 1 };

      mockBot.telegram.sendDocument = jest.fn().mockResolvedValue(result);

      const response = await service.sendDocument(chatId, document);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendDocument).toHaveBeenCalledWith(chatId, document, undefined);
    });
  });

  describe('sendSticker', () => {
    it('должен отправить стикер', async () => {
      const chatId = '123456789';
      const sticker = 'sticker-id';
      const result = { message_id: 1 };

      mockBot.telegram.sendSticker = jest.fn().mockResolvedValue(result);

      const response = await service.sendSticker(chatId, sticker);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendSticker).toHaveBeenCalledWith(chatId, sticker, undefined);
    });
  });

  describe('sendAnimation', () => {
    it('должен отправить анимацию', async () => {
      const chatId = '123456789';
      const animation = 'https://example.com/animation.gif';
      const result = { message_id: 1 };

      mockBot.telegram.sendAnimation = jest.fn().mockResolvedValue(result);

      const response = await service.sendAnimation(chatId, animation);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendAnimation).toHaveBeenCalledWith(chatId, animation, undefined);
    });
  });

  describe('sendLocation', () => {
    it('должен отправить локацию', async () => {
      const chatId = '123456789';
      const latitude = 55.7558;
      const longitude = 37.6173;
      const result = { message_id: 1 };

      mockBot.telegram.sendLocation = jest.fn().mockResolvedValue(result);

      const response = await service.sendLocation(chatId, latitude, longitude);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendLocation).toHaveBeenCalledWith(
        chatId,
        latitude,
        longitude,
        undefined,
      );
    });
  });

  describe('sendVenue', () => {
    it('должен отправить место', async () => {
      const chatId = '123456789';
      const latitude = 55.7558;
      const longitude = 37.6173;
      const title = 'Test Venue';
      const address = 'Test Address';
      const result = { message_id: 1 };

      mockBot.telegram.sendVenue = jest.fn().mockResolvedValue(result);

      const response = await service.sendVenue(chatId, latitude, longitude, title, address);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendVenue).toHaveBeenCalledWith(
        chatId,
        latitude,
        longitude,
        title,
        address,
        undefined,
      );
    });
  });

  describe('sendContact', () => {
    it('должен отправить контакт', async () => {
      const chatId = '123456789';
      const phoneNumber = '+79991234567';
      const firstName = 'Test';
      const result = { message_id: 1 };

      mockBot.telegram.sendContact = jest.fn().mockResolvedValue(result);

      const response = await service.sendContact(chatId, phoneNumber, firstName);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendContact).toHaveBeenCalledWith(
        chatId,
        phoneNumber,
        firstName,
        undefined,
      );
    });
  });

  describe('sendPoll', () => {
    it('должен отправить опрос', async () => {
      const chatId = '123456789';
      const question = 'Test question?';
      const options = ['Option 1', 'Option 2'];
      const result = { message_id: 1 };

      mockBot.telegram.sendPoll = jest.fn().mockResolvedValue(result);

      const response = await service.sendPoll(chatId, question, options);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendPoll).toHaveBeenCalledWith(chatId, question, options, undefined);
    });
  });

  describe('sendDice', () => {
    it('должен отправить кубик', async () => {
      const chatId = '123456789';
      const result = { message_id: 1 };

      mockBot.telegram.sendDice = jest.fn().mockResolvedValue(result);

      const response = await service.sendDice(chatId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.sendDice).toHaveBeenCalledWith(chatId, undefined);
    });
  });

  describe('pinChatMessage', () => {
    it('должен закрепить сообщение', async () => {
      const chatId = '123456789';
      const messageId = 1;
      const result = true;

      mockBot.telegram.pinChatMessage = jest.fn().mockResolvedValue(result);

      const response = await service.pinChatMessage(chatId, messageId);

      expect(response).toBe(result);
      expect(mockBot.telegram.pinChatMessage).toHaveBeenCalledWith(chatId, messageId, undefined);
    });
  });

  describe('unpinChatMessage', () => {
    it('должен открепить сообщение', async () => {
      const chatId = '123456789';
      const messageId = 1;
      const result = true;

      mockBot.telegram.unpinChatMessage = jest.fn().mockResolvedValue(result);

      const response = await service.unpinChatMessage(chatId, messageId);

      expect(response).toBe(result);
      expect(mockBot.telegram.unpinChatMessage).toHaveBeenCalledWith(chatId, messageId);
    });
  });

  describe('unpinAllChatMessages', () => {
    it('должен открепить все сообщения', async () => {
      const chatId = '123456789';
      const result = true;

      mockBot.telegram.unpinAllChatMessages = jest.fn().mockResolvedValue(result);

      const response = await service.unpinAllChatMessages(chatId);

      expect(response).toBe(result);
      expect(mockBot.telegram.unpinAllChatMessages).toHaveBeenCalledWith(chatId);
    });
  });

  describe('forwardMessage', () => {
    it('должен переслать сообщение', async () => {
      const chatId = '123456789';
      const fromChatId = '987654321';
      const messageId = 1;
      const result = { message_id: 2 };

      mockBot.telegram.forwardMessage = jest.fn().mockResolvedValue(result);

      const response = await service.forwardMessage(chatId, fromChatId, messageId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.forwardMessage).toHaveBeenCalledWith(
        chatId,
        fromChatId,
        messageId,
        undefined,
      );
    });
  });

  describe('getFile', () => {
    it('должен получить информацию о файле', async () => {
      const fileId = 'file-id';
      const result = { file_id: fileId, file_path: 'path/to/file' };

      mockBot.telegram.getFile = jest.fn().mockResolvedValue(result);

      const response = await service.getFile(fileId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.getFile).toHaveBeenCalledWith(fileId);
    });
  });

  describe('getChat', () => {
    it('должен получить информацию о чате', async () => {
      const chatId = '123456789';
      const result = { id: 123456789, type: 'group', title: 'Test Group' };

      mockBot.telegram.getChat = jest.fn().mockResolvedValue(result);

      const response = await service.getChat(chatId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.getChat).toHaveBeenCalledWith(chatId);
    });
  });

  describe('getChatMember', () => {
    it('должен получить информацию об участнике чата', async () => {
      const chatId = '123456789';
      const userId = 123456;
      const result = { user: { id: userId, first_name: 'Test' }, status: 'member' };

      mockBot.telegram.getChatMember = jest.fn().mockResolvedValue(result);

      const response = await service.getChatMember(chatId, userId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.getChatMember).toHaveBeenCalledWith(chatId, userId);
    });
  });

  describe('getChatMemberCount', () => {
    it('должен получить количество участников чата', async () => {
      const chatId = '123456789';
      const result = 10;

      mockBot.telegram.getChatMembersCount = jest.fn().mockResolvedValue(result);

      const response = await service.getChatMemberCount(chatId);

      expect(response).toBe(result);
      expect(mockBot.telegram.getChatMembersCount).toHaveBeenCalledWith(chatId);
    });

    it('должен вернуть 0 при ошибке', async () => {
      const chatId = '123456789';

      mockBot.telegram.getChatMembersCount = jest.fn().mockRejectedValue(new Error('Chat not found'));

      const response = await service.getChatMemberCount(chatId);

      expect(response).toBe(0);
    });
  });

  describe('setChatTitle', () => {
    it('должен установить название чата', async () => {
      const chatId = '123456789';
      const title = 'New Title';
      const result = true;

      mockBot.telegram.setChatTitle = jest.fn().mockResolvedValue(result);

      const response = await service.setChatTitle(chatId, title);

      expect(response).toBe(result);
      expect(mockBot.telegram.setChatTitle).toHaveBeenCalledWith(chatId, title);
    });
  });

  describe('setChatDescription', () => {
    it('должен установить описание чата', async () => {
      const chatId = '123456789';
      const description = 'New Description';
      const result = true;

      mockBot.telegram.setChatDescription = jest.fn().mockResolvedValue(result);

      const response = await service.setChatDescription(chatId, description);

      expect(response).toBe(result);
      expect(mockBot.telegram.setChatDescription).toHaveBeenCalledWith(chatId, description);
    });
  });

  describe('setChatPhoto', () => {
    it('должен установить фото чата', async () => {
      const chatId = '123456789';
      const photo = 'photo-file-id';
      const result = true;

      mockBot.telegram.setChatPhoto = jest.fn().mockResolvedValue(result);

      const response = await service.setChatPhoto(chatId, photo);

      expect(response).toBe(result);
      expect(mockBot.telegram.setChatPhoto).toHaveBeenCalledWith(chatId, photo);
    });
  });

  describe('deleteChatPhoto', () => {
    it('должен удалить фото чата', async () => {
      const chatId = '123456789';
      const result = true;

      mockBot.telegram.deleteChatPhoto = jest.fn().mockResolvedValue(result);

      const response = await service.deleteChatPhoto(chatId);

      expect(response).toBe(result);
      expect(mockBot.telegram.deleteChatPhoto).toHaveBeenCalledWith(chatId);
    });
  });

  describe('setChatPermissions', () => {
    it('должен установить разрешения чата', async () => {
      const chatId = '123456789';
      const permissions = {
        can_send_messages: true,
        can_send_media_messages: true,
      };
      const result = true;

      mockBot.telegram.setChatPermissions = jest.fn().mockResolvedValue(result);

      const response = await service.setChatPermissions(chatId, permissions);

      expect(response).toBe(result);
      expect(mockBot.telegram.setChatPermissions).toHaveBeenCalledWith(chatId, permissions);
    });
  });

  describe('getUserProfilePhotos', () => {
    it('должен получить фото профиля пользователя', async () => {
      const userId = 123456;
      const result = { total_count: 1, photos: [] };

      mockBot.telegram.getUserProfilePhotos = jest.fn().mockResolvedValue(result);

      const response = await service.getUserProfilePhotos(userId);

      expect(response).toEqual(result);
      expect(mockBot.telegram.getUserProfilePhotos).toHaveBeenCalledWith(userId, 0, 100);
    });

    it('должен получить фото профиля с опциями', async () => {
      const userId = 123456;
      const options = { offset: 5, limit: 10 };
      const result = { total_count: 1, photos: [] };

      mockBot.telegram.getUserProfilePhotos = jest.fn().mockResolvedValue(result);

      const response = await service.getUserProfilePhotos(userId, options);

      expect(response).toEqual(result);
      expect(mockBot.telegram.getUserProfilePhotos).toHaveBeenCalledWith(userId, 5, 10);
    });
  });

  describe('sendChatAction', () => {
    it('должен отправить действие чата', async () => {
      const chatId = '123456789';
      const action = 'typing';
      const result = true;

      mockBot.telegram.sendChatAction = jest.fn().mockResolvedValue(result);

      const response = await service.sendChatAction(chatId, action);

      expect(response).toBe(result);
      expect(mockBot.telegram.sendChatAction).toHaveBeenCalledWith(chatId, action);
    });
  });
});

