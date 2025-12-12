import { Test, TestingModule } from '@nestjs/testing';
import { TelegramStrategy } from './telegram.strategy';
import { AuthService, TelegramAuthData } from '../auth.service';
import { User, UserRole } from '../../../entities/user.entity';

describe('TelegramStrategy', () => {
  let strategy: TelegramStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateTelegramAuth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<TelegramStrategy>(TelegramStrategy);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should call authService.validateTelegramAuth with correct data', async () => {
      const telegramData: TelegramAuthData = {
        id: '123456',
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        auth_date: Date.now(),
        hash: 'test-hash',
      };

      const mockUser: Partial<User> = {
        id: '1',
        telegramId: '123456',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.CLIENT,
      };

      mockAuthService.validateTelegramAuth.mockResolvedValue(mockUser);

      const result = await strategy.validate(telegramData);

      expect(authService.validateTelegramAuth).toHaveBeenCalledWith(telegramData);
      expect(result).toEqual(mockUser);
    });

    it('should return null when authService.validateTelegramAuth returns null', async () => {
      const telegramData: TelegramAuthData = {
        id: '123456',
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        auth_date: Date.now(),
        hash: 'invalid-hash',
      };

      mockAuthService.validateTelegramAuth.mockResolvedValue(null);

      const result = await strategy.validate(telegramData);

      expect(authService.validateTelegramAuth).toHaveBeenCalledWith(telegramData);
      expect(result).toBeNull();
    });

    it('should handle errors from authService.validateTelegramAuth', async () => {
      const telegramData: TelegramAuthData = {
        id: '123456',
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        auth_date: Date.now(),
        hash: 'test-hash',
      };

      const error = new Error('Validation failed');
      mockAuthService.validateTelegramAuth.mockRejectedValue(error);

      await expect(strategy.validate(telegramData)).rejects.toThrow('Validation failed');
      expect(authService.validateTelegramAuth).toHaveBeenCalledWith(telegramData);
    });
  });
});

