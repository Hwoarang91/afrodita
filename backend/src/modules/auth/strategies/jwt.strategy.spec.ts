import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, JwtPayload } from '../auth.service';
import { UserRole } from '../../../entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;

  const mockAuthService = {
    validateTelegramAuth: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('должен вернуть пользователя по payload', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual(payload);
    });
  });
});

