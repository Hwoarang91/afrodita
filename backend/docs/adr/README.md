# Architecture Decision Records (ADR)

Этот каталог содержит Architecture Decision Records (ADR) для проекта Afrodita.

## Что такое ADR?

ADR — это документ, который фиксирует важное архитектурное решение, принятое в проекте, вместе с его контекстом и последствиями.

## Структура ADR

Каждый ADR содержит:
- **Статус:** Принято / Отклонено / Заменено
- **Дата:** Дата создания/изменения
- **Контекст:** Почему нужно было принять решение
- **Решение:** Что было решено
- **Последствия:** Положительные и отрицательные эффекты

## Список ADR

### ADR-001: Telegram Error Normalization
**Статус:** ✅ Принято  
**Дата:** 2025-12-23

Фиксирует принципы нормализации Telegram MTProto ошибок:
- Единственная точка знания MTProto — `telegram-error-mapper.ts`
- Запрет `string.includes()` вне mapper
- ErrorCode — единственный контракт
- Message всегда string

[Читать полностью →](./ADR-001-telegram-error-normalization.md)

---

### ADR-002: Telegram Session Lifecycle
**Статус:** ✅ Принято  
**Дата:** 2025-12-23

Фиксирует lifecycle Telegram сессий:
- Явная state machine для переходов состояний
- Запрет обратных переходов (invalid → active)
- One client = one sessionId

[Читать полностью →](./ADR-002-telegram-session-lifecycle.md)

---

### ADR-003: Error Handling Strategy
**Статус:** ✅ Принято  
**Дата:** 2025-12-23

Фиксирует стратегию обработки ошибок:
- ErrorResponse contract
- Глобальные фильтры
- UI behavior matrix

[Читать полностью →](./ADR-003-error-handling-strategy.md)

---

## Как создать новый ADR

1. Создайте файл `ADR-XXX-short-title.md`
2. Используйте шаблон из любого существующего ADR
3. Обновите этот README
4. Закоммитьте изменения

## Ссылки

- [ADR Template](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

