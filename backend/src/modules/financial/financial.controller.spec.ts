import { Test, TestingModule } from '@nestjs/testing';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Transaction, TransactionType } from '../../entities/transaction.entity';

describe('FinancialController', () => {
  let controller: FinancialController;
  let financialService: FinancialService;

  const mockFinancialService = {
    getUserTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialController],
      providers: [
        {
          provide: FinancialService,
          useValue: mockFinancialService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FinancialController>(FinancialController);
    financialService = module.get<FinancialService>(FinancialService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserTransactions', () => {
    it('должен вернуть транзакции пользователя', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockTransactions: Transaction[] = [
        {
          id: 'transaction-1',
          userId: 'user-1',
          type: TransactionType.PAYMENT,
          amount: -1000,
        } as Transaction,
      ];

      mockFinancialService.getUserTransactions.mockResolvedValue(mockTransactions);

      const result = await controller.getUserTransactions(req);

      expect(result).toEqual(mockTransactions);
      expect(mockFinancialService.getUserTransactions).toHaveBeenCalledWith('user-1');
    });
  });
});

