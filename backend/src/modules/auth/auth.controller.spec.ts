import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, TelegramAuthData } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { User, UserRole } from '../../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateEmailPassword: jest.fn(),
    validateTelegramAuth: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    updatePhone: jest.fn(),
    checkHasUsers: jest.fn(),
    registerFirstAdmin: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('должен авторизовать пользователя', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const mockUser: User = {
        id: 'user-1',
        email: loginDto.email,
        role: UserRole.CLIENT,
      } as User;
      const mockResult = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: mockUser,
      };

      mockAuthService.validateEmailPassword.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto, req);

      expect(result).toEqual(mockResult);
      expect(mockAuthService.validateEmailPassword).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(
        mockUser,
        req.ip,
        req.get('user-agent'),
      );
    });
  });

  describe('telegramAuth', () => {
    it('должен авторизовать через Telegram', async () => {
      const telegramData: TelegramAuthData = {
        id: '123456789',
        first_name: 'Test',
        auth_date: Date.now(),
        hash: 'hash',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const mockUser: User = {
        id: 'user-1',
        telegramId: telegramData.id,
        role: UserRole.CLIENT,
      } as User;
      const mockResult = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: mockUser,
      };

      mockAuthService.validateTelegramAuth.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.telegramAuth(telegramData, req);

      expect(result).toEqual(mockResult);
      expect(mockAuthService.validateTelegramAuth).toHaveBeenCalledWith(telegramData);
    });
  });

  describe('refreshToken', () => {
    it('должен обновить токен', async () => {
      const refreshToken = 'refresh-token';
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const mockResult = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
      };

      mockAuthService.refreshToken.mockResolvedValue(mockResult);

      const result = await controller.refreshToken(refreshToken, req);

      expect(result).toEqual(mockResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshToken,
        req.ip,
        req.get('user-agent'),
      );
    });
  });

  describe('logout', () => {
    it('должен выйти из системы', async () => {
      const req = {
        body: { refreshToken: 'refresh-token' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };

      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout('refresh-token', req);

      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-token', req.ip, req.get('user-agent'));
    });
  });

  describe('updatePhone', () => {
    it('должен обновить номер телефона', async () => {
      const req = {
        user: { sub: 'user-1' },
      };
      const dto = { phone: '+79991234567' };
      const mockUser: User = {
        id: 'user-1',
        phone: dto.phone,
      } as User;

      mockAuthService.updatePhone.mockResolvedValue(mockUser);

      const result = await controller.updatePhone(req, dto);

      expect(result).toEqual(mockUser);
      expect(mockAuthService.updatePhone).toHaveBeenCalledWith(req.user.sub, dto.phone);
    });
  });

  describe('getMe', () => {
    it('должен вернуть текущего пользователя', async () => {
      const req = {
        user: {
          sub: 'user-1',
          role: UserRole.CLIENT,
          email: 'test@example.com',
        },
      };

      const result = await controller.getMe(req);

      expect(result).toEqual(req.user);
    });
  });

  describe('checkSetup', () => {
    it('должен вернуть true если есть администраторы', async () => {
      mockAuthService.checkHasUsers.mockResolvedValue(true);

      const result = await controller.checkSetup();

      expect(result).toEqual({ hasUsers: true, needsSetup: false });
      expect(mockAuthService.checkHasUsers).toHaveBeenCalled();
    });

    it('должен вернуть false если нет администраторов', async () => {
      mockAuthService.checkHasUsers.mockResolvedValue(false);

      const result = await controller.checkSetup();

      expect(result).toEqual({ hasUsers: false, needsSetup: true });
    });
  });

  describe('register', () => {
    it('должен зарегистрировать первого администратора', async () => {
      const registerDto = {
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const mockResult = {
        accessToken: 'token',
        refreshToken: 'refresh',
        user: {
          id: 'admin-1',
          email: registerDto.email,
          role: UserRole.ADMIN,
        },
      };

      mockAuthService.registerFirstAdmin.mockResolvedValue(mockResult);

      const result = await controller.register(registerDto, req);

      expect(result).toEqual(mockResult);
      expect(mockAuthService.registerFirstAdmin).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.firstName,
        registerDto.lastName,
        req.ip,
        req.get('user-agent'),
      );
    });

    it('должен обработать ошибку при регистрации', async () => {
      const registerDto = {
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const error = new Error('Администратор уже существует');

      mockAuthService.registerFirstAdmin.mockRejectedValue(error);

      await expect(controller.register(registerDto, req)).rejects.toThrow(error);
    });
  });

  describe('login - error handling', () => {
    it('должен обработать ошибку при входе', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const error = new Error('Invalid email or password');

      mockAuthService.validateEmailPassword.mockRejectedValue(error);

      await expect(controller.login(loginDto, req)).rejects.toThrow(error);
      expect(mockAuthService.validateEmailPassword).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
    });
  });
});

