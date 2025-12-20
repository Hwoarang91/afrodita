import { IsOptional, IsString } from 'class-validator';

export class RefreshRequestDto {
  @IsOptional()
  @IsString({ message: 'Refresh token должен быть строкой' })
  refreshToken?: string; // Опциональный, так как может быть в cookies
}
