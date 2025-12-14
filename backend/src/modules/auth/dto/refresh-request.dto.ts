import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshRequestDto {
  @IsString({ message: 'Refresh token должен быть строкой' })
  @IsNotEmpty({ message: 'Refresh token обязателен' })
  refreshToken: string;
}
