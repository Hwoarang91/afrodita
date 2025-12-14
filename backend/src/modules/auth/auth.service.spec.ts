import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';
import { AuthLog, AuthAction } from '../../entities/auth-log.entity';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let sessionRepository: Repository<Session>;
  let jwtService: JwtService;
  let usersService: UsersService;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockAuthLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockUsersService = {
    normalizePhone: jest.fn(),
    findByTelegramId: jest.fn(),
    findByPhone: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(AuthLog),
          useValue: mockAuthLogRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    sessionRepository = module.get<Repository<Session>>(getRepositoryToken(Session));
    jwtService = module.get<JwtService>(JwtService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('validateEmailPassword', () => {
    it('должен вернуть пользователя при валидных credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed-password';

      const mockUser: User = {
        id: 'user-1',
        email,
        password: hashedPassword,
        isActive: true,
        role: UserRole.CLIENT,
      } as User;

      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateEmailPassword(email, password);

      expect(result).toEqual(mockUser);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('должен выбросить ошибку если пользователь не найден', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.validateEmailPassword(email, password),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить ошибку если пароль неверный', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const hashedPassword = 'hashed-password';

      const mockUser: User = {
        id: 'user-1',
        email,
        password: hashedPassword,
        isActive: true,
      } as User;

      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateEmailPassword(email, password),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить ошибку если аккаунт неактивен', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed-password';

      const mockUser: User = {
        id: 'user-1',
        email,
        password: hashedPassword,
        isActive: false,
      } as User;

      mockQueryBuilder.getOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateEmailPassword(email, password),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // Тесты для метода login() удалены, так как метод был удален
  // Вместо него используется JwtAuthService.generateTokenPair()

  describe('logout', () => {
    it('должен деактивировать сессию', async () => {
      const refreshToken = 'refresh-token';
      const mockSession: Session = {
        id: 'session-1',
        userId: 'user-1',
        refreshToken,
        isActive: true,
        user: {} as User,
      } as Session;

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue({
        ...mockSession,
        isActive: false,
      });
      mockAuthLogRepository.create.mockReturnValue({});
      mockAuthLogRepository.save.mockResolvedValue({});

      await service.logout(refreshToken);

      expect(mockSessionRepository.save).toHaveBeenCalled();
    });
  });

  describe('validateTelegramAuth', () => {
    it('должен создать нового пользователя если не найден', async () => {
      const telegramData = {
        id: 123456,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        hash: 'valid-hash',
      };

      const mockUser = {
        id: 'user-1',
        telegramId: telegramData.id,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
        username: telegramData.username,
        role: UserRole.CLIENT,
      } as unknown as User;

      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockConfigService.get.mockReturnValue('test-bot-token');
      
      // Мокаем crypto для verifyTelegramAuth
      const crypto = require('crypto');
      const createHashSpy = jest.spyOn(crypto, 'createHash').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('secret')),
      } as any);
      const createHmacSpy = jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('valid-hash'),
      } as any);

      const result = await service.validateTelegramAuth(telegramData as any);

      expect(result).toBeDefined();
      expect(result.telegramId).toBe(telegramData.id);
      
      // Очищаем spy после теста
      createHashSpy.mockRestore();
      createHmacSpy.mockRestore();
    });

    it('должен обновить существующего пользователя', async () => {
      const telegramData = {
        id: 123456,
        first_name: 'Updated',
        last_name: 'Name',
        username: 'updateduser',
        hash: 'valid-hash',
      };

      const existingUser = {
        id: 'user-1',
        telegramId: telegramData.id,
        firstName: 'Old',
        lastName: 'Name',
        username: 'olduser',
        role: UserRole.CLIENT,
      } as unknown as User;

      const updatedUser: User = {
        ...existingUser,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
        username: telegramData.username,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);
      mockConfigService.get.mockReturnValue('test-bot-token');
      
      const crypto = require('crypto');
      const createHashSpy = jest.spyOn(crypto, 'createHash').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('secret')),
      } as any);
      const createHmacSpy = jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('valid-hash'),
      } as any);

      const result = await service.validateTelegramAuth(telegramData as any);

      expect(result.firstName).toBe(telegramData.first_name);
      expect(result.role).toBe(UserRole.CLIENT); // Для нового пользователя роль CLIENT
      expect(mockUserRepository.save).toHaveBeenCalled();
      
      // Очищаем spy после теста
      createHashSpy.mockRestore();
      createHmacSpy.mockRestore();
    });
  });

  describe('refreshToken', () => {
    it('должен обновить токены', async () => {
      const refreshToken = 'old-refresh-token';
      const mockUser: User = {
        id: 'user-1',
        role: UserRole.CLIENT,
      } as User;

      const mockSession: Session = {
        id: 'session-1',
        userId: 'user-1',
        refreshToken,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      } as Session;

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue(mockSession);
      mockJwtService.sign.mockReturnValue('new-token');
      mockConfigService.get.mockReturnValue('7d');
      mockAuthLogRepository.create.mockReturnValue({});
      mockAuthLogRepository.save.mockResolvedValue({});

      const result = await service.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если сессия не найдена', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить ошибку если сессия истекла', async () => {
      const mockSession: Session = {
        id: 'session-1',
        refreshToken: 'old-token',
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000),
        user: {} as User,
      } as Session;

      mockSessionRepository.findOne.mockResolvedValue(mockSession);

      await expect(service.refreshToken('old-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validatePhone', () => {
    it('должен вернуть true для валидного телефона', async () => {
      expect(service).toBeDefined();
      const result = await service.validatePhone('+79991234567');
      expect(result).toBe(true);
    });

    it('должен вернуть false для невалидного телефона', async () => {
      expect(service).toBeDefined();
      const result = await service.validatePhone('invalid');
      expect(result).toBe(false);
    });
  });

  describe('updatePhone', () => {
    it('должен обновить телефон пользователя', async () => {
      expect(service).toBeDefined();
      const userId = 'user-1';
      const newPhone = '+79991234567';
      const mockUser: User = {
        id: userId,
        phone: 'old-phone',
      } as User;

      const updatedUser: User = {
        ...mockUser,
        phone: newPhone,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updatePhone(userId, newPhone);

      expect(result.phone).toBe(newPhone);
    });

    it('должен выбросить ошибку для невалидного телефона', async () => {
      expect(service).toBeDefined();
      await expect(service.updatePhone('user-1', 'invalid')).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить ошибку если пользователь не найден', async () => {
      expect(service).toBeDefined();
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.updatePhone('non-existent', '+79991234567')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateEmailPassword - edge cases', () => {
    it('должен обработать пустой email', async () => {
      await expect(service.validateEmailPassword('', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать пустой password', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
      } as User;

      mockQueryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateEmailPassword('test@example.com', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать очень длинный email (255+ символов)', async () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.validateEmailPassword(longEmail, 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать email с невалидными символами', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.validateEmailPassword('test@example@com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать SQL injection попытку в email', async () => {
      const sqlInjectionEmail = "admin' OR '1'='1";
      
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.validateEmailPassword(sqlInjectionEmail, 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать очень длинный password (1000+ символов)', async () => {
      const longPassword = 'a'.repeat(1000);
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
      } as User;

      mockQueryBuilder.getOne.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateEmailPassword('test@example.com', longPassword)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать пользователя без пароля (только Telegram)', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: null, // Пользователь без пароля
        isActive: true,
      } as User;

      mockQueryBuilder.getOne.mockResolvedValue(user);

      await expect(service.validateEmailPassword('test@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateTelegramAuth - edge cases', () => {
    it('должен обработать устаревшие Telegram данные (auth_date > 86400 секунд)', async () => {
      const oldAuthDate = Math.floor(Date.now() / 1000) - 86401; // Более 24 часов назад
      const telegramData = {
        id: '123456789',
        first_name: 'Test',
        auth_date: oldAuthDate,
        hash: 'hash',
      };

      mockConfigService.get.mockReturnValue('bot_token');
      
      // Мокируем verifyTelegramAuth как false для устаревших данных
      jest.spyOn(service as any, 'verifyTelegramAuth').mockReturnValue(false);

      await expect(service.validateTelegramAuth(telegramData as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('должен обработать пустой first_name в Telegram данных', async () => {
      const telegramData = {
        id: '123456789',
        first_name: '',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash',
      };

      const mockUser = {
        id: '1',
        telegramId: telegramData.id,
        firstName: '',
        role: UserRole.CLIENT,
      } as User;

      mockConfigService.get.mockReturnValue('bot_token');
      jest.spyOn(service as any, 'verifyTelegramAuth').mockReturnValue(true);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.validateTelegramAuth(telegramData as any);
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.CLIENT);
    });

    it('должен обработать очень длинный first_name (100+ символов)', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'A'.repeat(100),
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash',
      };

      const mockUser = {
        id: '1',
        telegramId: telegramData.id,
        firstName: 'A'.repeat(100),
        role: UserRole.CLIENT,
      } as User;

      mockConfigService.get.mockReturnValue('bot_token');
      jest.spyOn(service as any, 'verifyTelegramAuth').mockReturnValue(true);
      mockUserRepository.findOne.mockResolvedValue(null); // validateTelegramAuth использует findOne для поиска по telegramId
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.validateTelegramAuth(telegramData as any);
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.CLIENT);
    });

    it('должен разрешить авторизацию через Telegram для существующего админа (роль сохраняется)', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'Admin',
        last_name: 'User',
        username: 'admin_user',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash',
      };

      const adminUser = {
        id: 'admin-1',
        telegramId: telegramData.id,
        firstName: 'Old',
        lastName: 'Name',
        username: 'old_username',
        role: UserRole.ADMIN,
      } as User;

      const updatedAdminUser = {
        ...adminUser,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
        username: telegramData.username,
        role: UserRole.ADMIN, // Роль сохраняется
      } as User;

      mockConfigService.get.mockReturnValue('bot_token');
      jest.spyOn(service as any, 'verifyTelegramAuth').mockReturnValue(true);
      mockUserRepository.findOne.mockResolvedValue(adminUser);
      mockUserRepository.save.mockResolvedValue(updatedAdminUser);

      const result = await service.validateTelegramAuth(telegramData as any);
      
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.ADMIN); // Роль осталась ADMIN
      expect(result.firstName).toBe(telegramData.first_name);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('должен разрешить авторизацию через Telegram для существующего мастера (роль сохраняется)', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'Master',
        last_name: 'User',
        username: 'master_user',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash',
      };

      const masterUser = {
        id: 'master-1',
        telegramId: telegramData.id,
        firstName: 'Old',
        lastName: 'Name',
        username: 'old_username',
        role: UserRole.MASTER,
      } as User;

      const updatedMasterUser = {
        ...masterUser,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name,
        username: telegramData.username,
        role: UserRole.MASTER, // Роль сохраняется
      } as User;

      mockConfigService.get.mockReturnValue('bot_token');
      jest.spyOn(service as any, 'verifyTelegramAuth').mockReturnValue(true);
      mockUserRepository.findOne.mockResolvedValue(masterUser);
      mockUserRepository.save.mockResolvedValue(updatedMasterUser);

      const result = await service.validateTelegramAuth(telegramData as any);
      
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.MASTER); // Роль осталась MASTER
      expect(result.firstName).toBe(telegramData.first_name);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('должен разрешить авторизацию через Telegram для пользователя с ролью ADMIN, найденного по телефону (роль сохраняется)', async () => {
      const telegramData = {
        id: '123456789',
        first_name: 'Admin',
        phone: '+79991234567',
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'hash',
      };

      const adminUser = {
        id: 'admin-1',
        phone: '+79991234567',
        firstName: 'Admin',
        role: UserRole.ADMIN,
      } as User;

      const updatedAdminUser = {
        ...adminUser,
        telegramId: telegramData.id,
        firstName: telegramData.first_name,
        role: UserRole.ADMIN, // Роль сохраняется
      } as User;

      mockConfigService.get.mockReturnValue('bot_token');
      jest.spyOn(service as any, 'verifyTelegramAuth').mockReturnValue(true);
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // Первый вызов - по telegramId
        .mockResolvedValueOnce(adminUser); // Второй вызов - по телефону
      mockUsersService.normalizePhone.mockReturnValue('+79991234567');
      mockUserRepository.save.mockResolvedValue(updatedAdminUser);

      const result = await service.validateTelegramAuth(telegramData as any);
      
      expect(result).toBeDefined();
      expect(result.role).toBe(UserRole.ADMIN); // Роль осталась ADMIN
      expect(result.telegramId).toBe(telegramData.id);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('login - edge cases', () => {
    it('должен обработать истечение refresh token', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
        isActive: true,
      } as User;

      mockJwtService.sign.mockReturnValue('token');
      mockJwtService.verify.mockImplementation((token: string) => {
        if (token === 'expired_refresh_token') {
          throw new Error('Token expired');
        }
        return { sub: '1' };
      });

      mockSessionRepository.findOne.mockResolvedValue({
        userId: '1',
        refreshToken: 'expired_refresh_token',
      });

      await expect(service.refreshToken('expired_refresh_token')).rejects.toThrow();
    });

    it('должен обработать невалидный формат refresh token', async () => {
      await expect(service.refreshToken('invalid.token.format')).rejects.toThrow();
    });
  });

  describe('checkHasUsers', () => {
    it('должен вернуть true если есть администраторы', async () => {
      mockUserRepository.count = jest.fn().mockResolvedValue(1);

      const result = await service.checkHasUsers();

      expect(result).toBe(true);
      expect(mockUserRepository.count).toHaveBeenCalledWith({
        where: { role: UserRole.ADMIN },
      });
    });

    it('должен вернуть false если нет администраторов', async () => {
      mockUserRepository.count = jest.fn().mockResolvedValue(0);

      const result = await service.checkHasUsers();

      expect(result).toBe(false);
    });
  });

  describe('registerFirstAdmin', () => {
    it('должен создать первого администратора', async () => {
      const email = 'admin@example.com';
      const password = 'password123';
      const firstName = 'Admin';
      const lastName = 'User';

      mockUserRepository.count = jest.fn().mockResolvedValue(0);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      
      const mockAdmin: User = {
        id: 'admin-1',
        email,
        password: 'hashed-password',
        firstName,
        lastName,
        role: UserRole.ADMIN,
        isActive: true,
      } as User;

      mockUserRepository.create.mockReturnValue(mockAdmin);
      mockUserRepository.save.mockResolvedValue(mockAdmin);
      mockJwtService.sign.mockReturnValue('token');
      mockConfigService.get.mockReturnValue('7d');
      mockSessionRepository.create.mockReturnValue({} as Session);
      mockSessionRepository.save.mockResolvedValue({} as Session);
      mockAuthLogRepository.create.mockReturnValue({});
      mockAuthLogRepository.save.mockResolvedValue({});

      const result = await service.registerFirstAdmin(email, password, firstName, lastName);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если администратор уже существует', async () => {
      mockUserRepository.count = jest.fn().mockResolvedValue(1);

      await expect(
        service.registerFirstAdmin('admin@example.com', 'password', 'Admin'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить ошибку если пользователь с таким email уже существует', async () => {
      const existingUser: User = {
        id: 'user-1',
        email: 'admin@example.com',
      } as User;

      mockUserRepository.count = jest.fn().mockResolvedValue(0);
      mockQueryBuilder.getOne.mockResolvedValue(existingUser); // Используем mockQueryBuilder для registerFirstAdmin

      await expect(
        service.registerFirstAdmin('admin@example.com', 'password', 'Admin'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateTelegramAuth - edge cases', () => {
    it('должен выбросить ошибку при невалидном hash', async () => {
      const telegramData = {
        id: '123456',
        first_name: 'Test',
        auth_date: Date.now(),
        hash: 'invalid-hash',
      };

      mockConfigService.get.mockReturnValue('test-bot-token');
      
      const crypto = require('crypto');
      const createHashSpy = jest.spyOn(crypto, 'createHash').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('secret')),
      } as any);
      const createHmacSpy = jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('different-hash'),
      } as any);

      await expect(service.validateTelegramAuth(telegramData as any)).rejects.toThrow(
        UnauthorizedException,
      );

      createHashSpy.mockRestore();
      createHmacSpy.mockRestore();
    });

    it('должен найти пользователя по телефону если не найден по telegramId', async () => {
      const telegramData = {
        id: '123456',
        first_name: 'Test',
        phone: '+79991234567',
        auth_date: Date.now(),
        hash: 'valid-hash',
      };

      const existingUser: User = {
        id: 'user-1',
        phone: '+79991234567',
        telegramId: null,
        role: UserRole.CLIENT,
      } as User;

      const updatedUser: User = {
        ...existingUser,
        telegramId: telegramData.id,
        firstName: telegramData.first_name,
        role: UserRole.CLIENT, // Роль сохраняется
      } as User;

      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // не найден по telegramId
        .mockResolvedValueOnce(existingUser); // найден по телефону
      mockUsersService.normalizePhone.mockReturnValue('+79991234567');
      mockUserRepository.save.mockResolvedValue(updatedUser);
      mockConfigService.get.mockReturnValue('test-bot-token');
      
      const crypto = require('crypto');
      const createHashSpy = jest.spyOn(crypto, 'createHash').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(Buffer.from('secret')),
      } as any);
      const createHmacSpy = jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('valid-hash'),
      } as any);

      const result = await service.validateTelegramAuth(telegramData as any);

      expect(result.telegramId).toBe(telegramData.id);
      expect(mockUserRepository.save).toHaveBeenCalled();

      createHashSpy.mockRestore();
      createHmacSpy.mockRestore();
    });
  });
});

