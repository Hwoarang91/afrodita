import { UserRole } from '../../../entities/user.entity';

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  user: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    bonusPoints: number;
  };
}
