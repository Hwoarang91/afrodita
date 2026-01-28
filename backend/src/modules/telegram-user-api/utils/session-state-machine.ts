/**
 * SessionStateMachine — машина состояний Telegram сессий (модуль telegram-user-api)
 */

export type SessionStatus = 'initializing' | 'active' | 'invalid' | 'revoked';

const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  initializing: ['active', 'invalid'],
  active: ['revoked', 'invalid'],
  invalid: [],
  revoked: [],
};

export function isTransitionAllowed(from: SessionStatus, to: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertSessionTransition(
  from: SessionStatus,
  to: SessionStatus,
  sessionId?: string,
): void {
  if (!isTransitionAllowed(from, to)) {
    const sessionInfo = sessionId ? ` (sessionId: ${sessionId})` : '';
    throw new Error(
      `Недопустимый переход состояния сессии${sessionInfo}: ${from} → ${to}. ` +
        `Разрешенные переходы из ${from}: ${ALLOWED_TRANSITIONS[from]?.join(', ') || 'нет'}`,
    );
  }
}

export function getAllowedTransitions(from: SessionStatus): SessionStatus[] {
  return ALLOWED_TRANSITIONS[from] || [];
}

export function isFinalState(status: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.length === 0;
}

export function getTransitionMatrix(): Record<SessionStatus, SessionStatus[]> {
  return { ...ALLOWED_TRANSITIONS };
}
