import { Controller, Get, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancialService } from './financial.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

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

  @Get('users/:userId/transactions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Получение транзакций пользователя (только для админов)' })
  async getClientTransactions(@Param('userId') userId: string) {
    return await this.financialService.getUserTransactions(userId);
  }
}

