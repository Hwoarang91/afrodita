import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class TelegramPhoneRequestDto {
  @ApiProperty({
    description: 'Номер телефона в международном формате',
    example: '+79991234567',
  })
  @IsString({ message: 'Номер телефона должен быть строкой' })
  @IsNotEmpty({ message: 'Номер телефона обязателен' })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Номер телефона должен быть в международном формате',
  })
  phoneNumber: string;
}

