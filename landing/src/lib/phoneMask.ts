/**
 * Форматирует номер телефона в формат +7 (XXX) XXX-XX-XX
 */
export const formatPhoneNumber = (value: string): string => {
  // Удаляем все нецифровые символы
  const onlyDigits = value.replace(/\D/g, '');
  
  if (onlyDigits.length === 0) {
    return '+7';
  }
  
  // Нормализуем: если начинается с 8, заменяем на 7
  let normalizedDigits = onlyDigits;
  if (normalizedDigits.startsWith('8')) {
    normalizedDigits = '7' + normalizedDigits.slice(1);
  }
  // Если не начинается с 7, добавляем 7
  if (!normalizedDigits.startsWith('7')) {
    normalizedDigits = '7' + normalizedDigits;
  }
  
  // Ограничиваем до 11 цифр (7 + 10 цифр номера)
  const limitedDigits = normalizedDigits.slice(0, 11);
  
  // Если только код страны
  if (limitedDigits.length <= 1) {
    return '+7';
  }
  
  // Берем цифры после кода страны (7)
  const phoneDigits = limitedDigits.slice(1);
  
  // Форматируем: +7 (XXX) XXX-XX-XX
  let formatted = '+7';
  
  if (phoneDigits.length > 0) {
    formatted += ' (' + phoneDigits.slice(0, 3);
  }
  
  if (phoneDigits.length > 3) {
    formatted += ') ' + phoneDigits.slice(3, 6);
  }
  
  if (phoneDigits.length > 6) {
    formatted += '-' + phoneDigits.slice(6, 8);
  }
  
  if (phoneDigits.length > 8) {
    formatted += '-' + phoneDigits.slice(8, 10);
  }
  
  return formatted;
};

/**
 * Извлекает только цифры из номера телефона (включая код страны)
 */
export const getPhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  // Если начинается с 8, заменяем на 7
  if (digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }
  // Если не начинается с 7, добавляем 7
  if (!digits.startsWith('7')) {
    return '7' + digits;
  }
  return digits;
};

