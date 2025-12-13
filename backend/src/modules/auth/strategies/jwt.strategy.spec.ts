import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { AuthService, JwtPayload } from '../auth.service';
import { User, UserRole } from '../../../entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let userRepository: Repository<User>;

  const mockAuthService = {
    validateTelegramAuth: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
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
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get<ConfigService>(ConfigService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('должен вернуть пользователя по payload с актуальной ролью из БД', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: UserRole.ADMIN, // Роль изменилась в БД
        isActive: true,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
      expect(result).toEqual({
        ...payload,
        role: UserRole.ADMIN, // Роль из БД, а не из токена
      });
    });

    it('должен выбросить ошибку, если пользователь не найден', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow('User not found');
    });

    it('должен выбросить ошибку, если пользователь неактивен', async () => {
      const payload: JwtPayload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
      };

      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: UserRole.CLIENT,
        isActive: false,
      } as User;

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(strategy.validate(payload)).rejects.toThrow('User account is inactive');
    });
  });
});

