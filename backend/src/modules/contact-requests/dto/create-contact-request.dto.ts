import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactRequestDto {
  @ApiProperty({ description: 'Имя клиента', example: 'Иван Иванов' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Номер телефона', example: '+79991234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;

  @ApiProperty({ description: 'Сообщение', example: 'Хочу записаться на массаж', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(5000, { message: 'Сообщение не более 5000 символов' })
  message?: string;
}

