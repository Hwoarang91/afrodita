/**
 * SessionStateMachine - явная машина состояний для Telegram сессий
 * 
 * Гарантирует:
 * - Только разрешенные переходы состояний
 * - Предотвращение недопустимых переходов (invalid → active, revoked → active)
 * - Явную документацию всех возможных переходов
 * 
 * Разрешенные переходы:
 * - initializing → active
 * - initializing → invalid
 * - active → revoked
 * - active → invalid
 * 
 * Запрещенные переходы:
 * - invalid → active
 * - revoked → active
 */

export type SessionStatus = 'initializing' | 'active' | 'invalid' | 'revoked';

/**
 * Матрица разрешенных переходов состояний
 * from → to[]
 */
const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  initializing: ['active', 'invalid'],
  active: ['revoked', 'invalid'],
  invalid: [], // invalid - финальное состояние, нельзя перейти обратно
  revoked: [], // revoked - финальное состояние, нельзя перейти обратно
};

/**
 * Проверяет, разрешен ли переход из одного состояния в другое
 * 
 * @param from - Текущее состояние
 * @param to - Целевое состояние
 * @returns true если переход разрешен
 */
export function isTransitionAllowed(from: SessionStatus, to: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Утверждает, что переход состояния разрешен
 * Выбрасывает ошибку, если переход недопустим
 * 
 * @param from - Текущее состояние
 * @param to - Целевое состояние
 * @param sessionId - ID сессии (для логирования)
 * @throws Error если переход недопустим
 */
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

/**
 * Получает список всех разрешенных переходов из текущего состояния
 * 
 * @param from - Текущее состояние
 * @returns Массив разрешенных целевых состояний
 */
export function getAllowedTransitions(from: SessionStatus): SessionStatus[] {
  return ALLOWED_TRANSITIONS[from] || [];
}

/**
 * Проверяет, является ли состояние финальным (нельзя перейти из него)
 * 
 * @param status - Состояние для проверки
 * @returns true если состояние финальное
 */
export function isFinalState(status: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.length === 0;
}

/**
 * Получает описание всех возможных переходов (для документации/логирования)
 */
export function getTransitionMatrix(): Record<SessionStatus, SessionStatus[]> {
  return { ...ALLOWED_TRANSITIONS };
}

