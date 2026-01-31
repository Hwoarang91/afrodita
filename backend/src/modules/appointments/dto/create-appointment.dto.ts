import { IsString, IsDateString, IsOptional, IsUUID, IsNumber, Min, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  masterId: string;

  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false, description: 'Предрассчитанная скидка для комплекса услуг (в рублях)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({ required: false, description: 'Общая сумма комплекса услуг (для расчета пропорциональной скидки)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalComplexPrice?: number;

  @ApiProperty({ required: false, description: 'ID выбранных доп. услуг' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  extraServiceIds?: string[];
}

