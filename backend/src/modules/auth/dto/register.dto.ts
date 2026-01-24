import { IsEmail, IsString, MinLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Email адрес администратора',
    example: 'admin@example.com',
  })
  @IsEmail({}, { message: 'Email должен быть валидным адресом' })
  email: string;

  @ApiProperty({
    description: 'Пароль администратора',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Пароль должен содержать хотя бы одну строчную букву, одну заглавную букву и одну цифру',
  })
  password: string;

  @ApiProperty({
    description: 'Имя администратора',
    example: 'Иван',
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({
    description: 'Фамилия администратора',
    example: 'Иванов',
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName?: string;
}
