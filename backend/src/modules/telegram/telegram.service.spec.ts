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
});

