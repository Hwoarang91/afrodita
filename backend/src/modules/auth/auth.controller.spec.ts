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
});

