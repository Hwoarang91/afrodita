-- Миграция для исправления enum reviews_status_enum
-- Выполните этот SQL скрипт в базе данных, если миграция через TypeORM не работает

-- 1. Обновляем существующие значения на lowercase
UPDATE reviews 
SET status = CASE 
  WHEN status::text = 'PENDING' THEN 'pending'::text
  WHEN status::text = 'APPROVED' THEN 'approved'::text
  WHEN status::text = 'REJECTED' THEN 'rejected'::text
  ELSE status::text
END
WHERE status::text IN ('PENDING', 'APPROVED', 'REJECTED');

-- 2. Временно изменяем колонку на text
ALTER TABLE reviews 
ALTER COLUMN status TYPE text;

-- 3. Удаляем старый enum
DROP TYPE IF EXISTS reviews_status_enum CASCADE;

-- 4. Создаем новый enum с правильными значениями (lowercase)
CREATE TYPE reviews_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- 5. Возвращаем колонку к типу enum
ALTER TABLE reviews 
ALTER COLUMN status TYPE reviews_status_enum 
USING status::reviews_status_enum;

