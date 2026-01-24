import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
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
  @MaxLength(5000, { message: 'Комментарий не более 5000 символов' })
  comment?: string;
}

