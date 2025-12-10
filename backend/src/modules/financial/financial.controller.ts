import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancialService } from './financial.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('financial')
@Controller('financial')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('transactions')
  @ApiOperation({ summary: 'Получение транзакций пользователя' })
  async getUserTransactions(@Request() req) {
    return await this.financialService.getUserTransactions(req.user.sub);
  }
}

