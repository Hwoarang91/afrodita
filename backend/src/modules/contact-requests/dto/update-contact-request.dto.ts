import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContactRequestDto {
  @ApiProperty({ description: 'Прочитано', required: false })
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;

  @ApiProperty({ description: 'Обработано', required: false })
  @IsBoolean()
  @IsOptional()
  isProcessed?: boolean;

  @ApiProperty({ description: 'Комментарий администратора', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}

