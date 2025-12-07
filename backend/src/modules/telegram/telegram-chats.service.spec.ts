import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramChatsService } from './telegram-chats.service';
import { TelegramChat, ChatType } from '../../entities/telegram-chat.entity';

describe('TelegramChatsService', () => {
  let service: TelegramChatsService;
  let telegramChatRepository: Repository<TelegramChat>;

  const mockTelegramChatRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramChatsService,
        {
          provide: getRepositoryToken(TelegramChat),
          useValue: mockTelegramChatRepository,
        },
      ],
    }).compile();

    service = module.get<TelegramChatsService>(TelegramChatsService);
    telegramChatRepository = module.get<Repository<TelegramChat>>(
      getRepositoryToken(TelegramChat),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть все чаты', async () => {
      const mockChats: TelegramChat[] = [
        {
          id: 'chat-1',
          chatId: '123456789',
          type: ChatType.PRIVATE,
          isActive: true,
        } as TelegramChat,
      ];

      mockTelegramChatRepository.find.mockResolvedValue(mockChats);

      const result = await service.findAll();

      expect(result).toEqual(mockChats);
      expect(mockTelegramChatRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findActive', () => {
    it('должен вернуть только активные чаты', async () => {
      const mockChats: TelegramChat[] = [
        {
          id: 'chat-1',
          chatId: '123456789',
          isActive: true,
        } as TelegramChat,
      ];

      mockTelegramChatRepository.find.mockResolvedValue(mockChats);

      const result = await service.findActive();

      expect(result).toEqual(mockChats);
      expect(mockTelegramChatRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findByType', () => {
    it('должен вернуть чаты по типу', async () => {
      const mockChats: TelegramChat[] = [
        {
          id: 'chat-1',
          chatId: '123456789',
          type: ChatType.GROUP,
          isActive: true,
        } as TelegramChat,
      ];

      mockTelegramChatRepository.find.mockResolvedValue(mockChats);

      const result = await service.findByType(ChatType.GROUP);

      expect(result).toEqual(mockChats);
      expect(mockTelegramChatRepository.find).toHaveBeenCalledWith({
        where: { type: ChatType.GROUP, isActive: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('должен вернуть чат по chatId', async () => {
      const mockChat: TelegramChat = {
        id: 'chat-1',
        chatId: '123456789',
        type: ChatType.PRIVATE,
      } as TelegramChat;

      mockTelegramChatRepository.findOne.mockResolvedValue(mockChat);

      const result = await service.findOne('123456789');

      expect(result).toEqual(mockChat);
      expect(mockTelegramChatRepository.findOne).toHaveBeenCalledWith({
        where: { chatId: '123456789' },
      });
    });

    it('должен вернуть null если чат не найден', async () => {
      mockTelegramChatRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('должен вернуть статистику по чатам', async () => {
      mockTelegramChatRepository.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // active
        .mockResolvedValueOnce(3) // groups
        .mockResolvedValueOnce(2) // supergroups
        .mockResolvedValueOnce(1); // channels

      const result = await service.getStats();

      expect(result).toEqual({
        total: 10,
        active: 8,
        groups: 3,
        supergroups: 2,
        channels: 1,
      });
    });
  });

  describe('delete', () => {
    it('должен удалить чат', async () => {
      mockTelegramChatRepository.delete.mockResolvedValue(undefined);

      await service.delete('123456789');

      expect(mockTelegramChatRepository.delete).toHaveBeenCalledWith({
        chatId: '123456789',
      });
    });
  });
});

