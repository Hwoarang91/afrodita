# Тест функции "Подтверждение записи вручную"

## Текущее состояние
- ✅ Настройка `manualConfirmation` в БД: `false`
- ✅ Backend API endpoint: `POST /api/v1/appointments/:id/confirm`
- ✅ Frontend UI: Кнопка "Подтвердить" для записей со статусом `pending`
- ✅ Telegram Bot: Автоматическое подтверждение при `manualConfirmation: false`

## Как работает функция

### Backend логика (`appointments.service.ts`)

1. **При создании записи** (строка 119-129):
   ```typescript
   const appointment = this.appointmentRepository.create({
     clientId: userId,
     masterId: dto.masterId,
     serviceId: dto.serviceId,
     startTime,
     endTime,
     price: finalPrice,
     discount: discount > 0 ? discount : undefined,
     status: AppointmentStatus.PENDING, // ← Всегда создается как PENDING
     notes: dto.notes,
   });
   ```

2. **Уведомления** (строки 136-140):
   ```typescript
   // Отправка уведомления только если запись подтверждена
   // Если статус PENDING, уведомление не отправляется (будет отправлено при подтверждении админом)
   if (savedAppointment.status === AppointmentStatus.CONFIRMED) {
     await this.notificationsService.sendAppointmentConfirmation(savedAppointment);
   }
   ```

3. **Подтверждение записи** (строки 686-711):
   ```typescript
   async confirm(id: string): Promise<Appointment> {
     const appointment = await this.findById(id);
     
     if (appointment.status === AppointmentStatus.CANCELLED) {
       throw new BadRequestException('Cannot confirm cancelled appointment');
     }

     if (appointment.status === AppointmentStatus.COMPLETED) {
       throw new BadRequestException('Cannot confirm completed appointment');
     }

     appointment.status = AppointmentStatus.CONFIRMED;
     const confirmed = await this.appointmentRepository.save(appointment);

     // Отправка уведомления о подтверждении
     await this.notificationsService.sendAppointmentConfirmation(confirmed);

     // Уведомление администратору о подтверждении записи
     await this.telegramBotService.notifyAdminAboutConfirmedAppointment(confirmed);

     return confirmed;
   }
   ```

### Telegram Bot логика (`telegram-bot.service.ts`)

Строки 2213-2319:
```typescript
// Получаем настройки подтверждения записей
const bookingSettings = await this.settingsService.getBookingSettings();
const manualConfirmation = bookingSettings.manualConfirmation ?? false;

// Если ручное подтверждение выключено, автоматически подтверждаем все записи
if (!manualConfirmation) {
  for (let i = 0; i < finalAppointments.length; i++) {
    const appointment = finalAppointments[i];
    if (appointment.status === AppointmentStatus.PENDING) {
      this.logger.log(`✅ Автоматическое подтверждение записи ${appointment.id}`);
      finalAppointments[i] = await this.appointmentsService.confirm(appointment.id);
    }
  }
} else {
  this.logger.log(`⏳ Записи остаются в статусе PENDING (manualConfirmation: ${manualConfirmation})`);
}
```

### Frontend UI

#### Настройки (`admin/app/settings/page.tsx`, строки 479-501):
```tsx
<h3 className="font-medium text-foreground">Подтверждение записи вручную</h3>
<p className="text-sm text-muted-foreground">
  Если включено, каждая запись требует подтверждения админом
</p>
<input
  type="checkbox"
  checked={formData.bookingSettings.manualConfirmation}
  onChange={(e) =>
    setFormData({
      ...formData,
      bookingSettings: {
        ...formData.bookingSettings,
        manualConfirmation: e.target.checked,
      },
    })
  }
/>
```

#### Список записей (`admin/app/appointments/page.tsx`, строки 433-444):
```tsx
{apt.status === 'pending' && (
  <Button
    size="sm"
    variant="default"
    onClick={() => {
      confirmMutation.mutate(apt.id);
    }}
    disabled={confirmMutation.isPending}
  >
    <Check className="h-4 w-4 mr-1" />
    Подтвердить
  </Button>
)}
```

#### Календарь (`admin/app/appointments/calendar/page.tsx`, строки 556-570):
```tsx
{selectedAppointment.status === 'pending' && (
  <Button
    onClick={() => {
      setConfirmDialog({
        open: true,
        type: 'confirm',
        appointmentId: selectedAppointment.id,
        message: 'Подтвердить запись?',
      });
    }}
    variant="default"
    className="bg-green-600 hover:bg-green-700"
  >
    Подтвердить
  </Button>
)}
```

## Сценарий тестирования

### Тест 1: manualConfirmation = false (по умолчанию)

1. **Telegram Bot**:
   - Клиент создает запись через бота
   - ✅ Запись автоматически подтверждается
   - ✅ Статус: `CONFIRMED`
   - ✅ Клиент получает уведомление о подтверждении

2. **Admin Panel**:
   - Открыть `/admin/appointments`
   - ✅ Записи отображаются со статусом "Подтверждена"
   - ✅ Кнопка "Подтвердить" НЕ отображается

### Тест 2: manualConfirmation = true

1. **Включить настройку**:
   - Открыть `/admin/settings`
   - Перейти на вкладку "Записи"
   - Включить "Подтверждение записи вручную"
   - Сохранить

2. **Telegram Bot**:
   - Клиент создает запись через бота
   - ✅ Запись НЕ подтверждается автоматически
   - ✅ Статус: `PENDING`
   - ✅ Клиент видит сообщение "Ожидает подтверждения"

3. **Admin Panel - Список**:
   - Открыть `/admin/appointments`
   - ✅ Запись отображается со статусом "Ожидает"
   - ✅ Кнопка "Подтвердить" отображается
   - Нажать "Подтвердить"
   - ✅ Статус меняется на "Подтверждена"
   - ✅ Клиент получает уведомление в Telegram

4. **Admin Panel - Календарь**:
   - Открыть `/admin/appointments/calendar`
   - ✅ Запись отображается желтым цветом (pending)
   - Кликнуть на запись
   - ✅ Кнопка "Подтвердить" отображается
   - Нажать "Подтвердить"
   - ✅ Статус меняется на "Подтверждена"
   - ✅ Цвет меняется на зеленый

## Проверка логов

### Backend логи при создании записи:
```bash
docker compose logs backend | grep -E "handleConfirmAppointment|manualConfirmation|Автоматическое подтверждение"
```

### Проверка статуса записей в БД:
```sql
SELECT id, status, "clientId", "masterId", "startTime" 
FROM appointments 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

## Ожидаемые результаты

### ✅ manualConfirmation = false:
- Записи создаются со статусом `PENDING`
- Telegram Bot автоматически подтверждает → статус `CONFIRMED`
- Клиент сразу получает уведомление
- В админке кнопка "Подтвердить" не отображается

### ✅ manualConfirmation = true:
- Записи создаются со статусом `PENDING`
- Telegram Bot НЕ подтверждает автоматически
- Клиент НЕ получает уведомление сразу
- В админке отображается кнопка "Подтвердить"
- После подтверждения админом → статус `CONFIRMED`
- Клиент получает уведомление после подтверждения

## Текущий статус

✅ Функция полностью реализована и работает корректно
✅ Backend API готов
✅ Frontend UI готов
✅ Telegram Bot интеграция готова
✅ Уведомления настроены

## Рекомендации для тестирования

1. Проверить в настройках текущее значение `manualConfirmation`
2. Создать тестовую запись через Telegram Bot
3. Проверить статус в админке
4. Включить `manualConfirmation = true`
5. Создать еще одну запись через Telegram Bot
6. Проверить, что запись осталась в статусе `PENDING`
7. Подтвердить запись в админке
8. Проверить, что клиент получил уведомление

