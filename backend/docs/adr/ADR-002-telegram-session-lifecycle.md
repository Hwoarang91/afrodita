# ADR-002: Telegram Session Lifecycle

**Статус:** ✅ Принято  
**Дата:** 2025-12-23  
**Авторы:** Development Team  
**Контекст:** Telegram сессии имеют сложный lifecycle с несколькими состояниями. Необходимо гарантировать корректные переходы состояний и предотвратить использование невалидных сессий.

---

## Проблема

### До введения state machine

1. **Неконтролируемые переходы:**
   ```typescript
   // ❌ Можно было перейти из invalid в active
   session.status = 'invalid';
   // ... позже
   session.status = 'active'; // ← Недопустимо!
   ```

2. **Множественные клиенты для одного userId:**
   ```typescript
   // ❌ Создавался новый клиент для каждого запроса
   const client1 = await getClient(userId); // новый клиент
   const client2 = await getClient(userId); // еще один клиент
   // → Утечка памяти, конфликты сессий
   ```

3. **Проблемы:**
   - `AUTH_KEY_UNREGISTERED` из-за использования невалидных сессий
   - Утечки памяти из-за множественных клиентов
   - Невозможность отследить, какая сессия активна

---

## Решение

### 1. Явная state machine для сессий

**Правило:** Сессии могут переходить только в разрешенные состояния.

**Разрешенные переходы:**
```
initializing → active
initializing → invalid
active → revoked
active → invalid
```

**Запрещенные переходы:**
```
invalid → active      ❌
revoked → active      ❌
active → initializing ❌
```

**Реализация:**
```typescript
// session-state-machine.ts
export function assertSessionTransition(
  from: SessionStatus,
  to: SessionStatus,
  sessionId?: string,
): void {
  if (!isTransitionAllowed(from, to)) {
    throw new Error(
      `Недопустимый переход состояния сессии: ${from} → ${to}`
    );
  }
}
```

**Почему запрещены обратные переходы:**

1. **Семантика состояний:**
   - `invalid` = сессия повреждена, нельзя восстановить
   - `revoked` = сессия отозвана Telegram, нельзя восстановить
   - `active` = сессия валидна и работает

2. **Предотвращение ошибок:**
   ```typescript
   // ❌ Попытка использовать невалидную сессию
   session.status = 'invalid';
   // ... позже
   session.status = 'active'; // ← Должна быть ошибка!
   await getClient(session.id); // ← AUTH_KEY_UNREGISTERED
   ```

3. **Явность намерений:**
   - Если нужна новая сессия → создать новую
   - Не пытаться "воскресить" старую

---

### 2. One client = one sessionId

**Правило:** Один MTKruto клиент соответствует одной сессии (sessionId), никогда userId.

**Почему one client = one sessionId:**

1. **Изоляция сессий:**
   ```typescript
   // ✅ Правильно
   const client1 = await getClient(sessionId1); // клиент для sessionId1
   const client2 = await getClient(sessionId2); // клиент для sessionId2
   
   // ❌ Неправильно
   const client = await getClient(userId); // какой sessionId использовать?
   ```

2. **Предотвращение конфликтов:**
   ```typescript
   // ❌ Проблема: userId может иметь несколько сессий
   const session1 = { userId: '123', sessionId: 'abc', status: 'active' };
   const session2 = { userId: '123', sessionId: 'def', status: 'active' };
   
   // Какой клиент вернуть для userId?
   const client = await getClient(userId); // ← Неоднозначно!
   ```

3. **Корректное кеширование:**
   ```typescript
   // ✅ Кеш по sessionId
   private clients = new Map<sessionId, Client>();
   
   // ❌ Кеш по userId (неоднозначно)
   private clients = new Map<userId, Client>(); // ← Какая сессия?
   ```

4. **Правильный lifecycle:**
   ```typescript
   // ✅ Создание клиента для конкретной сессии
   const session = await createSession(userId);
   const client = await createClientForAuth(session.id);
   
   // ✅ Использование клиента
   await client.invoke({ _: 'users.getMe' });
   await saveSession(session.id, client);
   
   // ✅ Повторное использование
   const cachedClient = await getClient(session.id); // ← Тот же клиент
   ```

---

### 3. Жизненный цикл сессии

**Этапы:**

1. **initializing:**
   - Создается при начале авторизации
   - `encryptedSessionData = null`
   - Может перейти в `active` или `invalid`

2. **active:**
   - Сессия успешно авторизована
   - `encryptedSessionData` содержит валидные данные
   - Может перейти в `revoked` или `invalid`

3. **invalid:**
   - Сессия повреждена или невалидна
   - Финальное состояние (нельзя восстановить)
   - Удаляется через 30 дней

4. **revoked:**
   - Сессия отозвана Telegram
   - Финальное состояние (нельзя восстановить)
   - Удаляется через 30 дней

**Автоматическая очистка:**
```typescript
// cleanupTelegramSessions cron job
@Cron('0 3 * * *') // Каждый день в 3:00 UTC
async cleanupTelegramSessions() {
  // initializing > 24 часа → invalid
  // invalid/revoked > 30 дней → DELETE
}
```

---

## Последствия

### Положительные

1. ✅ Невозможность использовать невалидные сессии
2. ✅ Предотвращение `AUTH_KEY_UNREGISTERED` ошибок
3. ✅ Явный lifecycle, легко отслеживать состояние
4. ✅ Корректное кеширование клиентов
5. ✅ Автоматическая очистка старых сессий

### Отрицательные

1. ⚠️ Требуется явное указание sessionId везде
2. ⚠️ Нельзя "воскресить" невалидную сессию (нужно создать новую)

---

## Проверка соблюдения

### Автоматические тесты

```typescript
// session-state-machine.spec.ts
it('должен запрещать invalid → active', () => {
  expect(isTransitionAllowed('invalid', 'active')).toBe(false);
});
```

### Ручная проверка

```bash
# Ищем использование getClient(userId)
grep -r "getClient.*userId" backend/src
```

---

## Связанные документы

- `session-state-machine.ts` - реализация state machine
- `telegram-user-client.service.ts` - управление клиентами
- `scheduler.service.ts` - cleanup job

---

## История изменений

- **2025-12-23:** Создан ADR-002

