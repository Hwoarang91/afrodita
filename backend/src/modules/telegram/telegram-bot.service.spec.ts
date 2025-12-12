import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TelegramBotService } from './telegram-bot.service';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { MastersService } from '../masters/masters.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReviewsService } from '../reviews/reviews.service';
import { FinancialService } from '../financial/financial.service';
import { User } from '../../entities/user.entity';
import { Service } from '../../entities/service.entity';
import { Master } from '../../entities/master.entity';
import { Appointment } from '../../entities/appointment.entity';
import { TelegramChat } from '../../entities/telegram-chat.entity';
import { GroupSettings } from '../../entities/group-settings.entity';

describe('TelegramBotService', () => {
  let service: TelegramBotService;
  let configService: ConfigService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockServiceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMasterRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAppointmentRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBot = {
    telegram: {
      sendMessage: jest.fn(),
    },
  };

  const mockTelegramChatRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockGroupSettingsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockUsersService = {
    findByTelegramId: jest.fn(),
    normalizePhone: jest.fn(),
  };

  const mockServicesService = {
    findAll: jest.fn(),
    findSubcategories: jest.fn(),
  };

  const mockMastersService = {
    findAll: jest.fn(),
  };

  const mockAppointmentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    reschedule: jest.fn(),
    cancel: jest.fn(),
    getAvailableSlots: jest.fn(),
  };

  const mockSettingsService = {
    getBookingSettings: jest.fn(),
    getFirstVisitDiscountSettings: jest.fn(),
    get: jest.fn(),
    getTelegramAdminUserId: jest.fn().mockResolvedValue('admin-1'),
  };

  const mockNotificationsService = {
    sendBroadcast: jest.fn(),
  };

  const mockReviewsService = {
    create: jest.fn(),
  };

  const mockFinancialService = {
    calculateBonusPoints: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramBotService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
        },
        {
          provide: getRepositoryToken(Master),
          useValue: mockMasterRepository,
        },
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(TelegramChat),
          useValue: mockTelegramChatRepository,
        },
        {
          provide: getRepositoryToken(GroupSettings),
          useValue: mockGroupSettingsRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ServicesService,
          useValue: mockServicesService,
        },
        {
          provide: MastersService,
          useValue: mockMastersService,
        },
        {
          provide: AppointmentsService,
          useValue: mockAppointmentsService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
        {
          provide: FinancialService,
          useValue: mockFinancialService,
        },
      ],
    }).compile();

    service = module.get<TelegramBotService>(TelegramBotService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('должен инициализировать бота если токен установлен', async () => {
      mockConfigService.get.mockReturnValue('test-token');
      
      // Мокаем Telegraf конструктор
      const mockTelegraf = jest.fn().mockImplementation(() => ({
        telegram: {
          setMyCommands: jest.fn().mockResolvedValue(true),
        },
        launch: jest.fn().mockResolvedValue(undefined),
        use: jest.fn(),
        command: jest.fn(),
        on: jest.fn(),
        action: jest.fn(),
        inlineQuery: jest.fn(),
      }));

      jest.doMock('telegraf', () => ({
        Telegraf: mockTelegraf,
        Markup: {},
      }));

      await service.onModuleInit();

      expect(mockConfigService.get).toHaveBeenCalledWith('TELEGRAM_BOT_TOKEN');
    });

    it('не должен инициализировать бота если токен не установлен', async () => {
      mockConfigService.get.mockReturnValue(null);

      await service.onModuleInit();

      expect(mockConfigService.get).toHaveBeenCalledWith('TELEGRAM_BOT_TOKEN');
    });
  });

  describe('onModuleDestroy', () => {
    it('должен остановить бота если он был инициализирован', async () => {
      const mockStop = jest.fn().mockResolvedValue(undefined);
      (service as any).bot = {
        stop: mockStop,
      };

      await service.onModuleDestroy();

      expect(mockStop).toHaveBeenCalled();
    });

    it('не должен падать если бот не был инициализирован', async () => {
      (service as any).bot = null;

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('должен отправить сообщение если бот инициализирован', async () => {
      (service as any).bot = mockBot;
      mockBot.telegram.sendMessage.mockResolvedValue(undefined);

      await service.sendMessage('chat-1', 'Test message');

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith('chat-1', 'Test message', undefined);
    });

    it('не должен падать если бот не инициализирован', async () => {
      (service as any).bot = null;

      await expect(service.sendMessage('chat-1', 'Test message')).resolves.not.toThrow();
    });

    it('должен обработать ошибку при отправке сообщения', async () => {
      (service as any).bot = mockBot;
      mockBot.telegram.sendMessage.mockRejectedValue(new Error('Send failed'));

      await expect(service.sendMessage('chat-1', 'Test message')).resolves.not.toThrow();
    });

    it('должен отправить сообщение с опциями', async () => {
      (service as any).bot = mockBot;
      const options = { parse_mode: 'Markdown' };
      mockBot.telegram.sendMessage.mockResolvedValue(undefined);

      await service.sendMessage('chat-1', 'Test message', options);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith('chat-1', 'Test message', options);
    });
  });

  describe('notifyAdminsAboutNewAppointment', () => {
    it('не должен отправлять уведомления если бот не инициализирован', async () => {
      (service as any).bot = null;

      const appointment = { id: 'appointment-1' } as Appointment;

      await service.notifyAdminsAboutNewAppointment(appointment);

      expect(mockUserRepository.find).not.toHaveBeenCalled();
    });

    it('не должен отправлять уведомления если нет админов', async () => {
      (service as any).bot = mockBot;
      mockUserRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.findOne.mockResolvedValue({
        id: 'appointment-1',
        client: { firstName: 'John' },
        master: { name: 'Master' },
        service: { name: 'Service' },
        startTime: new Date(),
        price: 1000,
      });

      const appointment = { id: 'appointment-1' } as Appointment;

      await service.notifyAdminsAboutNewAppointment(appointment);

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('должен отправить уведомления админам о новой записи', async () => {
      (service as any).bot = mockBot;
      const admin = { id: 'admin-1', telegramId: '123456' };
      mockSettingsService.getTelegramAdminUserId.mockResolvedValue('admin-1');
      mockUserRepository.findOne.mockResolvedValue(admin);
      mockAppointmentRepository.findOne.mockResolvedValue({
        id: 'appointment-1',
        client: { firstName: 'John', lastName: 'Doe', phone: '+79991234567' },
        master: { name: 'Master Name' },
        service: { name: 'Service Name' },
        startTime: new Date('2024-01-01T10:00:00'),
        price: 1000,
      });
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockBot.telegram.sendMessage.mockResolvedValue(undefined);

      const appointment = { id: 'appointment-1' } as Appointment;

      await service.notifyAdminsAboutNewAppointment(appointment);

      expect(mockSettingsService.getTelegramAdminUserId).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
      });
      expect(mockAppointmentRepository.findOne).toHaveBeenCalled();
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyAdminsAboutCancelledAppointment', () => {
    it('не должен отправлять уведомления если бот не инициализирован', async () => {
      (service as any).bot = null;

      const appointment = { id: 'appointment-1' } as Appointment;

      await service.notifyAdminsAboutCancelledAppointment(appointment);

      expect(mockSettingsService.getTelegramAdminUserId).not.toHaveBeenCalled();
    });

    it('должен отправить уведомления админам об отмене записи', async () => {
      (service as any).bot = mockBot;
      const admin = { id: 'admin-1', telegramId: '123456' };
      mockSettingsService.getTelegramAdminUserId.mockResolvedValue('admin-1');
      mockUserRepository.findOne.mockResolvedValue(admin);
      mockAppointmentRepository.findOne.mockResolvedValue({
        id: 'appointment-1',
        client: { firstName: 'John', lastName: 'Doe', phone: '+79991234567' },
        master: { name: 'Master Name' },
        service: { name: 'Service Name' },
        startTime: new Date('2024-01-01T10:00:00'),
        price: 1000,
      });
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockBot.telegram.sendMessage.mockResolvedValue(undefined);

      const appointment = { id: 'appointment-1' } as Appointment;

      await service.notifyAdminsAboutCancelledAppointment(appointment, 'Client request');

      expect(mockSettingsService.getTelegramAdminUserId).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
      });
      expect(mockAppointmentRepository.findOne).toHaveBeenCalled();
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
    });
  });

  describe('sendMessageWithKeyboard', () => {
    it('должен отправить сообщение с клавиатурой если бот инициализирован', async () => {
      (service as any).bot = mockBot;
      const keyboard = { reply_markup: { inline_keyboard: [] } };
      mockBot.telegram.sendMessage.mockResolvedValue(undefined);

      await service.sendMessageWithKeyboard('chat-1', 'Test message', keyboard);

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith('chat-1', 'Test message', keyboard);
    });

    it('не должен падать если бот не инициализирован', async () => {
      (service as any).bot = null;

      await expect(service.sendMessageWithKeyboard('chat-1', 'Test message', {})).resolves.not.toThrow();
    });
  });

  describe('getBot', () => {
    it('должен вернуть бота если он инициализирован', () => {
      (service as any).bot = mockBot;

      const result = service.getBot();

      expect(result).toEqual(mockBot);
    });

    it('должен вернуть null если бот не инициализирован', () => {
      (service as any).bot = null;

      const result = service.getBot();

      expect(result).toBeNull();
    });
  });

  describe('replaceMessageVariables', () => {
    it('должен заменить переменные пользователя', () => {
      const text = 'Hello {first_name} {last_name}! Your ID is {user_id}';
      const user = {
        firstName: 'John',
        lastName: 'Doe',
        telegramId: '123456',
      };

      const result = service.replaceMessageVariables(text, user);

      expect(result).toContain('John');
      expect(result).toContain('Doe');
      expect(result).toContain('123456');
    });

    it('должен заменить переменные чата', () => {
      const text = 'Chat ID: {chat_id}, Title: {chat_title}';
      const chat = {
        chatId: '789012',
        title: 'Test Chat',
      };

      const result = service.replaceMessageVariables(text, undefined, chat);

      expect(result).toContain('789012');
      expect(result).toContain('Test Chat');
    });

    it('должен заменить переменные даты и времени', () => {
      const text = 'Date: {date}, Time: {time}';

      const result = service.replaceMessageVariables(text);

      expect(result).toMatch(/Date: \d{1,2}\.\d{1,2}\.\d{4}/);
      expect(result).toMatch(/Time: \d{1,2}:\d{2}/);
    });

    it('должен вернуть исходный текст если нет переменных', () => {
      const text = 'Simple text without variables';

      const result = service.replaceMessageVariables(text);

      expect(result).toBe(text);
    });

    it('должен вернуть пустую строку если текст пустой', () => {
      const result = service.replaceMessageVariables('');

      expect(result).toBe('');
    });

    it('должен обработать username с @ и без', () => {
      const text = 'Username: {username}';
      const user1 = { username: 'testuser' };
      const user2 = { username: '@testuser' };

      const result1 = service.replaceMessageVariables(text, user1);
      const result2 = service.replaceMessageVariables(text, user2);

      expect(result1).toContain('@testuser');
      expect(result2).toContain('@testuser');
    });

    it('должен обработать snake_case и camelCase для пользователя', () => {
      const text = '{first_name} {last_name}';
      const user1 = { first_name: 'John', last_name: 'Doe' };
      const user2 = { firstName: 'Jane', lastName: 'Smith' };

      const result1 = service.replaceMessageVariables(text, user1);
      const result2 = service.replaceMessageVariables(text, user2);

      expect(result1).toContain('John');
      expect(result1).toContain('Doe');
      expect(result2).toContain('Jane');
      expect(result2).toContain('Smith');
    });
  });
});

