import { IsString, IsDateString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'Новая дата и время начала записи',
    example: '2024-12-25T14:00:00Z',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'Причина переноса (опционально)',
    example: 'Изменение планов',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Причина переноса не более 2000 символов' })
  reason?: string;
}

