import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './controllers/auth.controller';
import { AuthService, TelegramAuthData } from './auth.service';
import { JwtAuthService } from './services/jwt.service';
import { CsrfService } from './services/csrf.service';
import { TelegramSessionService } from '../telegram-user-api/services/telegram-session.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LoginRequestDto } from './dto/login-request.dto';
import { User, UserRole } from '../../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let jwtAuthService: JwtAuthService;

  const mockAuthService = {
    validateEmailPassword: jest.fn(),
    validateTelegramAuth: jest.fn(),
    logAuthAction: jest.fn().mockResolvedValue(undefined),
    checkHasUsers: jest.fn(),
    registerFirstAdmin: jest.fn(),
  };

  const mockJwtAuthService = {
    generateTokenPair: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  const mockCsrfService = {
    generateCsrfToken: jest.fn().mockReturnValue('csrf-token'),
    getCsrfCookieOptions: jest.fn().mockReturnValue({
      httpOnly: false,
      secure: false,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 86400,
    }),
  };

  const mockTelegramSessionService = {
    load: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };

  function mockRes() {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      setHeader: jest.fn(),
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtAuthService, useValue: mockJwtAuthService },
        { provide: CsrfService, useValue: mockCsrfService },
        { provide: TelegramSessionService, useValue: mockTelegramSessionService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jwtAuthService = module.get<JwtAuthService>(JwtAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('должен авторизовать пользователя и вернуть токены', async () => {
      const loginDto: LoginRequestDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const res = mockRes();
      const mockUser: User = {
        id: 'user-1',
        email: loginDto.email,
        role: UserRole.CLIENT,
        bonusPoints: 0,
      } as User;
      const tokenPair = {
        accessToken: 'token',
        refreshToken: 'refresh',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      };

      mockAuthService.validateEmailPassword.mockResolvedValue(mockUser);
      mockJwtAuthService.generateTokenPair.mockResolvedValue(tokenPair);

      const result = await controller.login(
        loginDto as LoginRequestDto,
        req as any,
        res as any,
      );

      expect(result).toHaveProperty('accessToken', 'token');
      expect(result).toHaveProperty('refreshToken', 'refresh');
      expect(result).toHaveProperty('user');
      expect(mockAuthService.validateEmailPassword).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(mockJwtAuthService.generateTokenPair).toHaveBeenCalledWith(
        mockUser,
        req.ip,
        'Mozilla/5.0',
        false,
      );
      expect(res.cookie).toHaveBeenCalled();
    });

    it('должен передать rememberMe в generateTokenPair и установить cookies', async () => {
      const loginDto: LoginRequestDto = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true,
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const res = mockRes();
      const mockUser = { id: 'user-1', email: loginDto.email, role: UserRole.CLIENT, bonusPoints: 0 } as User;
      const tokenPair = {
        accessToken: 'token',
        refreshToken: 'refresh',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      };

      mockAuthService.validateEmailPassword.mockResolvedValue(mockUser);
      mockJwtAuthService.generateTokenPair.mockResolvedValue(tokenPair);

      await controller.login(loginDto as LoginRequestDto, req as any, res as any);

      expect(mockJwtAuthService.generateTokenPair).toHaveBeenCalledWith(
        mockUser,
        req.ip,
        'Mozilla/5.0',
        true,
      );
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('должен обновить токены и установить cookies', async () => {
      const refreshDto = { refreshToken: 'refresh-token' };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        cookies: {},
      };
      const res = mockRes();
      const tokenPair = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockJwtAuthService.refreshTokens.mockResolvedValue(tokenPair);

      const result = await controller.refresh(
        refreshDto as any,
        req as any,
        res as any,
      );

      expect(result).toHaveProperty('accessToken', 'new-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh');
      expect(mockJwtAuthService.refreshTokens).toHaveBeenCalledWith(
        'refresh-token',
        req.ip,
        'Mozilla/5.0',
      );
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('должен выйти из системы и очистить cookies', async () => {
      const req = {
        user: { sub: 'user-1', email: 'test@example.com' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const res = mockRes();

      const result = await controller.logout(req as any, res as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockJwtAuthService.logout).toHaveBeenCalledWith('user-1');
      expect(mockAuthService.logAuthAction).toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('должен вернуть данные текущего пользователя', async () => {
      const req = {
        user: {
          sub: 'user-1',
          id: 'user-1',
          role: UserRole.CLIENT,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          bonusPoints: 0,
        },
      };

      const result = await controller.getMe(req as any);

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
      });
    });
  });

  describe('checkSetup', () => {
    it('должен вернуть true если есть администраторы', async () => {
      mockAuthService.checkHasUsers.mockResolvedValue(true);

      const result = await controller.checkSetup();

      expect(result).toEqual({ hasUsers: true, needsSetup: false });
      expect(mockAuthService.checkHasUsers).toHaveBeenCalled();
    });

    it('должен вернуть needsSetup true если нет администраторов', async () => {
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
      const res = mockRes();
      const mockResult = {
        accessToken: 'token',
        token: 'token',
        refreshToken: 'refresh',
        user: {
          id: 'admin-1',
          email: registerDto.email,
          role: UserRole.ADMIN,
        },
      };

      mockAuthService.registerFirstAdmin.mockResolvedValue(mockResult);

      const result = await controller.register(
        registerDto as any,
        req as any,
        res as any,
      );

      expect(result).toEqual(mockResult);
      expect(mockAuthService.registerFirstAdmin).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        'Admin',
        'User',
        req.ip,
        'Mozilla/5.0',
      );
      expect(res.cookie).toHaveBeenCalled();
    });

    it('должен пробросить ошибку при регистрации', async () => {
      const registerDto = {
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
      };
      const req = { ip: '127.0.0.1', get: jest.fn().mockReturnValue('Mozilla/5.0') };
      const res = mockRes();
      const error = new Error('Администратор уже существует');

      mockAuthService.registerFirstAdmin.mockRejectedValue(error);

      await expect(
        controller.register(registerDto as any, req as any, res as any),
      ).rejects.toThrow(error);
    });
  });

  describe('telegramAuth', () => {
    it('должен авторизовать через Telegram', async () => {
      const telegramData: TelegramAuthData = {
        id: '123456789',
        first_name: 'Test',
        auth_date: Date.now(),
        hash: 'hash',
      } as TelegramAuthData;
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const res = mockRes();
      const mockUser: User = {
        id: 'user-1',
        telegramId: telegramData.id,
        role: UserRole.CLIENT,
      } as User;
      const tokenPair = {
        accessToken: 'token',
        refreshToken: 'refresh',
        accessTokenExpiresAt: new Date(),
        refreshTokenExpiresAt: new Date(),
      };

      mockAuthService.validateTelegramAuth.mockResolvedValue(mockUser);
      mockJwtAuthService.generateTokenPair.mockResolvedValue(tokenPair);

      const result = await controller.telegramAuth(
        telegramData,
        req as any,
        res as any,
      );

      expect(result).toHaveProperty('accessToken', 'token');
      expect(result).toHaveProperty('refreshToken', 'refresh');
      expect(result).toHaveProperty('user');
      expect(mockAuthService.validateTelegramAuth).toHaveBeenCalledWith(telegramData);
      expect(res.cookie).toHaveBeenCalled();
    });
  });

  describe('login - error handling', () => {
    it('должен пробросить ошибку при неверных данных', async () => {
      const loginDto: LoginRequestDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };
      const req = {
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const res = mockRes();
      const error = new Error('Invalid email or password');

      mockAuthService.validateEmailPassword.mockRejectedValue(error);

      await expect(
        controller.login(loginDto, req as any, res as any),
      ).rejects.toThrow(error);
      expect(mockAuthService.validateEmailPassword).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
    });
  });
});
