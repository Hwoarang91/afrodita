import {
  isTransitionAllowed,
  assertSessionTransition,
  getAllowedTransitions,
  isFinalState,
  getTransitionMatrix,
} from './session-state-machine';

describe('session-state-machine', () => {
  describe('isTransitionAllowed', () => {
    it('initializing → active', () => {
      expect(isTransitionAllowed('initializing', 'active')).toBe(true);
    });
    it('initializing → invalid', () => {
      expect(isTransitionAllowed('initializing', 'invalid')).toBe(true);
    });
    it('initializing → revoked запрещён', () => {
      expect(isTransitionAllowed('initializing', 'revoked')).toBe(false);
    });
    it('active → revoked', () => {
      expect(isTransitionAllowed('active', 'revoked')).toBe(true);
    });
    it('active → invalid', () => {
      expect(isTransitionAllowed('active', 'invalid')).toBe(true);
    });
    it('active → initializing запрещён', () => {
      expect(isTransitionAllowed('active', 'initializing')).toBe(false);
    });
    it('invalid и revoked — конечные', () => {
      expect(isTransitionAllowed('invalid', 'active')).toBe(false);
      expect(isTransitionAllowed('revoked', 'active')).toBe(false);
    });
  });

  describe('assertSessionTransition', () => {
    it('не бросает для допустимого перехода', () => {
      expect(() => assertSessionTransition('initializing', 'active')).not.toThrow();
    });
    it('бросает для недопустимого перехода', () => {
      expect(() => assertSessionTransition('active', 'initializing')).toThrow(
        /Недопустимый переход состояния сессии/,
      );
    });
    it('включает sessionId в сообщение при переданном id', () => {
      expect(() =>
        assertSessionTransition('active', 'initializing', 'sid-1'),
      ).toThrow(/sessionId: sid-1/);
    });
  });

  describe('getAllowedTransitions', () => {
    it('возвращает массив разрешённых переходов', () => {
      expect(getAllowedTransitions('initializing')).toEqual(['active', 'invalid']);
      expect(getAllowedTransitions('active')).toEqual(['revoked', 'invalid']);
      expect(getAllowedTransitions('invalid')).toEqual([]);
      expect(getAllowedTransitions('revoked')).toEqual([]);
    });
  });

  describe('isFinalState', () => {
    it('true для invalid и revoked', () => {
      expect(isFinalState('invalid')).toBe(true);
      expect(isFinalState('revoked')).toBe(true);
    });
    it('false для initializing и active', () => {
      expect(isFinalState('initializing')).toBe(false);
      expect(isFinalState('active')).toBe(false);
    });
  });

  describe('getTransitionMatrix', () => {
    it('возвращает копию матрицы переходов', () => {
      const m = getTransitionMatrix();
      expect(m.initializing).toEqual(['active', 'invalid']);
      expect(m.active).toEqual(['revoked', 'invalid']);
      expect(m.invalid).toEqual([]);
      expect(m.revoked).toEqual([]);
    });
  });
});
