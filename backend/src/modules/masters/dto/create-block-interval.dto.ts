import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBlockIntervalDto {
  @ApiProperty({ example: '2025-01-20T10:00:00.000Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2025-01-20T12:00:00.000Z' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
