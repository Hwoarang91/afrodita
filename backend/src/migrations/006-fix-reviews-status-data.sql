-- Исправление данных в таблице reviews
-- Этот скрипт обновляет все записи с uppercase значениями на lowercase

-- Сначала проверяем, есть ли записи с неправильными значениями
SELECT COUNT(*) as uppercase_count
FROM reviews
WHERE status::text IN ('PENDING', 'APPROVED', 'REJECTED');

-- Временно изменяем тип колонки на text
ALTER TABLE reviews
ALTER COLUMN status TYPE text USING status::text;

-- Обновляем все значения на lowercase
UPDATE reviews
SET status = CASE
  WHEN status = 'PENDING' THEN 'pending'
  WHEN status = 'APPROVED' THEN 'approved'
  WHEN status = 'REJECTED' THEN 'rejected'
  WHEN status = 'pending' THEN 'pending'
  WHEN status = 'approved' THEN 'approved'
  WHEN status = 'rejected' THEN 'rejected'
  ELSE LOWER(status)
END
WHERE status IS NOT NULL;

-- Возвращаем тип колонки обратно на enum
ALTER TABLE reviews
ALTER COLUMN status TYPE reviews_status_enum USING status::reviews_status_enum;

