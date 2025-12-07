import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../entities/user.entity';
import { AuditAction } from '../../entities/audit-log.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;
  let auditService: AuditService;

  const mockUsersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('должен вернуть список пользователей для админа', async () => {
      const req = { user: { role: 'admin' } };
      const mockUsers = {
        data: [{ id: 'user-1' } as User],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll(undefined, undefined, undefined, undefined, req);

      expect(result).toEqual(mockUsers);
    });

    it('должен выбросить ошибку для не-админа', async () => {
      const req = { user: { role: 'client' } };

      await expect(
        controller.findAll(undefined, undefined, undefined, undefined, req),
      ).rejects.toThrow('Access denied');
    });
  });

  describe('findById', () => {
    it('должен вернуть пользователя для админа', async () => {
      const id = 'user-1';
      const req = { user: { role: 'admin' } };
      const mockUser: User = {
        id,
        firstName: 'Test',
        lastName: 'User',
      } as User;

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.findById(req, id);

      expect(result).toEqual(mockUser);
    });
  });

  describe('getProfile', () => {
    it('должен вернуть профиль текущего пользователя', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockUser: User = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
      } as User;

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getProfile(req);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findById).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateProfile', () => {
    it('должен обновить профиль', async () => {
      const req = { user: { sub: 'user-1' } };
      const data = { firstName: 'Updated' };
      const mockUser: User = {
        id: 'user-1',
        ...data,
      } as User;

      mockUsersService.update.mockResolvedValue(mockUser);

      const result = await controller.updateProfile(req, data);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.update).toHaveBeenCalledWith('user-1', data);
    });
  });

  describe('create', () => {
    it('должен создать пользователя для админа', async () => {
      const req = {
        user: { sub: 'admin-1', role: 'admin' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const data = {
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
      };
      const mockUser: User = {
        id: 'user-1',
        ...data,
        role: UserRole.CLIENT,
      } as User;

      mockUsersService.create.mockResolvedValue(mockUser);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.create(req, data);

      expect(result).toEqual(mockUser);
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});

