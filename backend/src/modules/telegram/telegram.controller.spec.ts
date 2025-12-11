import { Test, TestingModule } from '@nestjs/testing';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramChatsService } from './telegram-chats.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChatType } from '../../entities/telegram-chat.entity';

describe('TelegramController', () => {
  let controller: TelegramController;
  let telegramService: TelegramService;
  let telegramBotService: TelegramBotService;
  let telegramChatsService: TelegramChatsService;
  let settingsService: SettingsService;

  const mockTelegramService = {
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
    deleteMessage: jest.fn(),
    forwardMessage: jest.fn(),
    getFile: jest.fn(),
    getChat: jest.fn(),
    getChatMember: jest.fn(),
    getUserProfilePhotos: jest.fn(),
    getChatMemberCount: jest.fn(),
    setChatTitle: jest.fn(),
    setChatDescription: jest.fn(),
    setChatPhoto: jest.fn(),
    deleteChatPhoto: jest.fn(),
    setChatPermissions: jest.fn(),
  };

  const mockTelegramBotService = {
    replaceMessageVariables: jest.fn(),
    getBot: jest.fn(),
  };

  const mockTelegramChatsService = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    getStats: jest.fn(),
  };

  const mockSettingsService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        {
          provide: TelegramBotService,
          useValue: mockTelegramBotService,
        },
        {
          provide: TelegramChatsService,
          useValue: mockTelegramChatsService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelegramController>(TelegramController);
    telegramService = module.get<TelegramService>(TelegramService);
    telegramBotService = module.get<TelegramBotService>(TelegramBotService);
    telegramChatsService = module.get<TelegramChatsService>(TelegramChatsService);
    settingsService = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение', async () => {
      const dto = {
        chatId: '123456',
        message: 'Test message',
      };
      const mockResult = { message_id: 1 };

      mockTelegramService.getChat.mockResolvedValue({ type: 'private', id: 123456 });
      mockTelegramService.getChatMember.mockResolvedValue({ user: { id: 123456, first_name: 'Test' } });
      mockTelegramBotService.replaceMessageVariables.mockReturnValue('Test message');
      mockTelegramService.sendMessage.mockResolvedValue(mockResult);

      const result = await controller.sendMessage(dto);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.sendMessage).toHaveBeenCalled();
    });

    it('должен обработать ошибку при получении информации о чате', async () => {
      const dto = {
        chatId: '123456',
        message: 'Test message',
      };
      const mockResult = { message_id: 1 };

      mockTelegramService.getChat.mockRejectedValue(new Error('Chat not found'));
      mockTelegramService.sendMessage.mockResolvedValue(mockResult);

      const result = await controller.sendMessage(dto);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('detectParseMode', () => {
    it('должен определить HTML режим', () => {
      const text = '<b>Bold</b> text';
      const result = (controller as any).detectParseMode(text);
      expect(result).toBe('HTML');
    });

    it('должен определить Markdown режим', () => {
      const text = '**Bold** text';
      const result = (controller as any).detectParseMode(text);
      expect(result).toBe('Markdown');
    });

    it('должен определить MarkdownV2 режим', () => {
      const text = '__Underline__ text';
      const result = (controller as any).detectParseMode(text);
      expect(result).toBe('MarkdownV2');
    });

    it('должен вернуть HTML по умолчанию', () => {
      const text = 'Plain text';
      const result = (controller as any).detectParseMode(text);
      expect(result).toBe('HTML');
    });
  });

  describe('sendPhoto', () => {
    it('должен отправить фото', async () => {
      const dto = {
        chatId: '123456',
        photo: 'photo-url',
        caption: 'Photo caption',
      };
      const mockResult = { message_id: 1 };

      mockTelegramService.getChat.mockResolvedValue({ type: 'group', id: 123456 });
      mockTelegramBotService.replaceMessageVariables.mockReturnValue('Photo caption');
      mockTelegramService.sendPhoto.mockResolvedValue(mockResult);

      const result = await controller.sendPhoto(dto);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.sendPhoto).toHaveBeenCalled();
    });
  });

  describe('getChats', () => {
    it('должен вернуть список всех чатов', async () => {
      const mockChats = [
        { id: '1', chatId: '123456', type: ChatType.GROUP },
        { id: '2', chatId: '789012', type: ChatType.PRIVATE },
      ];

      mockTelegramChatsService.findAll.mockResolvedValue(mockChats);

      const result = await controller.getChats();

      expect(result).toEqual({ success: true, data: mockChats });
      expect(mockTelegramChatsService.findAll).toHaveBeenCalled();
    });

    it('должен вернуть список активных чатов', async () => {
      const mockChats = [{ id: '1', chatId: '123456', type: ChatType.GROUP, isActive: true }];

      mockTelegramChatsService.findActive.mockResolvedValue(mockChats);

      const result = await controller.getChats('true');

      expect(result).toEqual({ success: true, data: mockChats });
      expect(mockTelegramChatsService.findActive).toHaveBeenCalled();
    });
  });

  describe('getChatStats', () => {
    it('должен вернуть статистику по чатам', async () => {
      const mockStats = {
        total: 10,
        active: 8,
        groups: 5,
        private: 3,
      };

      mockTelegramChatsService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getChatStats();

      expect(result).toEqual({ success: true, data: mockStats });
      expect(mockTelegramChatsService.getStats).toHaveBeenCalled();
    });
  });

  describe('deleteChat', () => {
    it('должен удалить чат', async () => {
      const chatId = '123456';

      mockTelegramChatsService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteChat(chatId);

      expect(result).toEqual({ success: true, message: 'Чат удален из базы данных' });
      expect(mockTelegramChatsService.delete).toHaveBeenCalledWith(chatId);
    });
  });

  describe('getChatInfo', () => {
    it('должен вернуть информацию о чате', async () => {
      const chatId = '123456';
      const mockChat = {
        id: '1',
        chatId: '123456',
        type: ChatType.GROUP,
        title: 'Test Group',
        membersCount: 10,
      };
      const mockChatInfo = {
        id: 123456,
        type: 'group',
        title: 'Test Group',
        members_count: 11,
      };

      mockTelegramChatsService.findOne.mockResolvedValue(mockChat);
      mockTelegramService.getChat.mockResolvedValue(mockChatInfo);
      mockTelegramService.getChatMemberCount.mockResolvedValue(11);

      const result = await controller.getChatInfo(chatId);

      expect(result.success).toBe(true);
      expect(result.data.chatId).toBe(chatId);
      expect(result.data.membersCount).toBe(10); // Вычитаем бота
    });

    it('должен вернуть ошибку, если чат не найден', async () => {
      const chatId = '123456';

      mockTelegramChatsService.findOne.mockResolvedValue(null);

      const result = await controller.getChatInfo(chatId);

      expect(result).toEqual({ success: false, message: 'Чат не найден' });
    });
  });

  describe('getWelcomeMessage', () => {
    it('должен вернуть приветственное сообщение', async () => {
      const mockMessage = 'Welcome to our group!';

      mockSettingsService.get.mockResolvedValue(mockMessage);

      const result = await controller.getWelcomeMessage();

      expect(result).toEqual({ success: true, message: mockMessage });
      expect(mockSettingsService.get).toHaveBeenCalledWith('telegramGroupWelcomeMessage', '');
    });
  });

  describe('setWelcomeMessage', () => {
    it('должен установить приветственное сообщение', async () => {
      const body = { message: 'New welcome message' };

      mockSettingsService.set.mockResolvedValue(undefined);

      const result = await controller.setWelcomeMessage(body);

      expect(result).toEqual({ success: true, message: 'Приветственное сообщение обновлено' });
      expect(mockSettingsService.set).toHaveBeenCalledWith('telegramGroupWelcomeMessage', body.message || '');
    });
  });

  describe('getStartMessage', () => {
    it('должен вернуть сообщение для команды /start', async () => {
      const mockMessage = 'Start message';

      mockSettingsService.get.mockResolvedValue(mockMessage);

      const result = await controller.getStartMessage();

      expect(result).toEqual({ success: true, message: mockMessage });
      expect(mockSettingsService.get).toHaveBeenCalledWith('telegramStartMessage', '');
    });
  });

  describe('setStartMessage', () => {
    it('должен установить сообщение для команды /start', async () => {
      const body = { message: 'New start message' };

      mockSettingsService.set.mockResolvedValue(undefined);

      const result = await controller.setStartMessage(body);

      expect(result).toEqual({ success: true, message: 'Сообщение для /start обновлено' });
      expect(mockSettingsService.set).toHaveBeenCalledWith('telegramStartMessage', body.message || '');
    });
  });

  describe('sendVideo', () => {
    it('должен отправить видео', async () => {
      const dto = {
        chatId: '123456',
        media: 'video-url',
        caption: 'Video caption',
      };
      const mockResult = { message_id: 1 };

      mockTelegramService.sendVideo.mockResolvedValue(mockResult);

      const result = await controller.sendVideo(dto);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.sendVideo).toHaveBeenCalled();
    });
  });

  describe('sendLocation', () => {
    it('должен отправить локацию', async () => {
      const dto = {
        chatId: '123456',
        latitude: 55.7558,
        longitude: 37.6173,
      };
      const mockResult = { message_id: 1 };

      mockTelegramService.sendLocation.mockResolvedValue(mockResult);

      const result = await controller.sendLocation(dto);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.sendLocation).toHaveBeenCalledWith(
        dto.chatId,
        dto.latitude,
        dto.longitude,
      );
    });
  });

  describe('deleteMessage', () => {
    it('должен удалить сообщение', async () => {
      const dto = {
        chatId: '123456',
        messageId: 1,
      };
      const mockResult = { success: true };

      mockTelegramService.deleteMessage.mockResolvedValue(mockResult);

      const result = await controller.deleteMessage(dto);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.deleteMessage).toHaveBeenCalledWith(dto.chatId, dto.messageId);
    });
  });

  describe('getFile', () => {
    it('должен получить информацию о файле', async () => {
      const fileId = 'file-id';
      const mockResult = { file_id: fileId, file_path: 'path/to/file' };

      mockTelegramService.getFile.mockResolvedValue(mockResult);

      const result = await controller.getFile(fileId);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.getFile).toHaveBeenCalledWith(fileId);
    });
  });

  describe('getChat', () => {
    it('должен получить информацию о чате', async () => {
      const chatId = '123456';
      const mockResult = { id: 123456, type: 'group', title: 'Test Group' };

      mockTelegramService.getChat.mockResolvedValue(mockResult);

      const result = await controller.getChat(chatId);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.getChat).toHaveBeenCalledWith(chatId);
    });
  });

  describe('setChatTitle', () => {
    it('должен установить название чата', async () => {
      const chatId = '123456';
      const body = { chatId: '123456', title: 'New Title' };
      const mockResult = { success: true };

      mockTelegramService.setChatTitle.mockResolvedValue(mockResult);

      const result = await controller.setChatTitle(chatId, body);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.setChatTitle).toHaveBeenCalledWith(chatId, body.title);
    });
  });

  describe('setChatDescription', () => {
    it('должен установить описание чата', async () => {
      const chatId = '123456';
      const body = { chatId: '123456', description: 'New Description' };
      const mockResult = { success: true };

      mockTelegramService.setChatDescription.mockResolvedValue(mockResult);

      const result = await controller.setChatDescription(chatId, body);

      expect(result).toEqual({ success: true, result: mockResult });
      expect(mockTelegramService.setChatDescription).toHaveBeenCalledWith(chatId, body.description);
    });
  });
});

