import { Request } from 'express';

/** JWT payload / Passport user, добавляемый JwtAuthGuard в req.user */
export interface JwtUser {
  sub?: string;
  id?: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  bonusPoints?: number;
}

/** Express Request, расширенный user (JWT) и telegramSessionId (TelegramSessionGuard) */
export type AuthRequest = Request & {
  user?: JwtUser;
  telegramSessionId?: string;
};
