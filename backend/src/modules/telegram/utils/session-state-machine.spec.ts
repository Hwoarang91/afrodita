/**
 * Тесты для SessionStateMachine
 * 
 * Проверяет:
 * - Разрешенные и запрещенные переходы состояний
 * - Helper функции (assertSessionTransition, isFinalState)
 * - Предотвращение недопустимых переходов
 */

import {
  isTransitionAllowed,
  assertSessionTransition,
  getAllowedTransitions,
  isFinalState,
  SessionStatus,
} from './session-state-machine';

describe('SessionStateMachine', () => {
  describe('isTransitionAllowed', () => {
    it('должен разрешать initializing → active', () => {
      expect(isTransitionAllowed('initializing', 'active')).toBe(true);
    });

    it('должен разрешать initializing → invalid', () => {
      expect(isTransitionAllowed('initializing', 'invalid')).toBe(true);
    });

    it('должен разрешать active → revoked', () => {
      expect(isTransitionAllowed('active', 'revoked')).toBe(true);
    });

    it('должен разрешать active → invalid', () => {
      expect(isTransitionAllowed('active', 'invalid')).toBe(true);
    });

    it('должен запрещать invalid → active', () => {
      expect(isTransitionAllowed('invalid', 'active')).toBe(false);
    });

    it('должен запрещать revoked → active', () => {
      expect(isTransitionAllowed('revoked', 'active')).toBe(false);
    });

    it('должен запрещать invalid → revoked', () => {
      expect(isTransitionAllowed('invalid', 'revoked')).toBe(false);
    });

    it('должен запрещать revoked → invalid', () => {
      expect(isTransitionAllowed('revoked', 'invalid')).toBe(false);
    });

    it('должен запрещать active → initializing', () => {
      expect(isTransitionAllowed('active', 'initializing')).toBe(false);
    });
  });

  describe('assertSessionTransition', () => {
    it('не должен выбрасывать ошибку для разрешенного перехода', () => {
      expect(() => {
        assertSessionTransition('initializing', 'active', 'test-session-id');
      }).not.toThrow();
    });

    it('должен выбрасывать ошибку для запрещенного перехода', () => {
      expect(() => {
        assertSessionTransition('invalid', 'active', 'test-session-id');
      }).toThrow('Недопустимый переход состояния');
    });

    it('должен включать sessionId в сообщение об ошибке', () => {
      try {
        assertSessionTransition('invalid', 'active', 'test-session-id');
        fail('Должна была быть выброшена ошибка');
      } catch (error: any) {
        expect(error.message).toContain('test-session-id');
      }
    });
  });

  describe('getAllowedTransitions', () => {
    it('должен возвращать правильные переходы для initializing', () => {
      const transitions = getAllowedTransitions('initializing');
      
      expect(transitions).toContain('active');
      expect(transitions).toContain('invalid');
      expect(transitions.length).toBe(2);
    });

    it('должен возвращать правильные переходы для active', () => {
      const transitions = getAllowedTransitions('active');
      
      expect(transitions).toContain('revoked');
      expect(transitions).toContain('invalid');
      expect(transitions.length).toBe(2);
    });

    it('должен возвращать пустой массив для invalid', () => {
      const transitions = getAllowedTransitions('invalid');
      
      expect(transitions).toEqual([]);
    });

    it('должен возвращать пустой массив для revoked', () => {
      const transitions = getAllowedTransitions('revoked');
      
      expect(transitions).toEqual([]);
    });
  });

  describe('isFinalState', () => {
    it('должен возвращать false для initializing', () => {
      expect(isFinalState('initializing')).toBe(false);
    });

    it('должен возвращать false для active', () => {
      expect(isFinalState('active')).toBe(false);
    });

    it('должен возвращать true для invalid', () => {
      expect(isFinalState('invalid')).toBe(true);
    });

    it('должен возвращать true для revoked', () => {
      expect(isFinalState('revoked')).toBe(true);
    });
  });
});

