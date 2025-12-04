/**
 * Утилиты для работы с MarkdownV2 в Telegram Bot API
 */

/**
 * Символы, которые нужно экранировать в MarkdownV2
 */
const MARKDOWNV2_ESCAPE_CHARS = [
  '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!',
];

/**
 * Экранирует специальные символы для MarkdownV2
 * @param text - текст для экранирования
 * @param excludeChars - символы, которые не нужно экранировать (например, внутри ссылок)
 * @returns экранированный текст
 */
export function escapeMarkdownV2(text: string, excludeChars: string[] = []): string {
  if (!text) return text;

  let result = text;
  const charsToEscape = MARKDOWNV2_ESCAPE_CHARS.filter((char) => !excludeChars.includes(char));

  // Экранируем каждый специальный символ
  // Избегаем двойного экранирования, проверяя, что перед символом нет обратного слеша
  for (const char of charsToEscape) {
    // Заменяем символ на экранированный, только если перед ним нет обратного слеша
    const regex = new RegExp(`([^\\\\])${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    result = result.replace(regex, `$1\\${char}`);
    
    // Обрабатываем случай, когда символ находится в начале строки
    if (result.startsWith(char)) {
      result = `\\${char}${result.substring(1)}`;
    }
  }

  return result;
}

/**
 * Экранирует текст для использования внутри MarkdownV2 сущностей
 * @param text - текст для экранирования
 * @param entityType - тип сущности (bold, italic, code, и т.д.)
 * @returns экранированный текст
 */
export function escapeForMarkdownV2Entity(text: string, entityType: 'bold' | 'italic' | 'code' | 'pre' | 'link' | 'text' = 'text'): string {
  if (!text) return text;

  // Для ссылок экранируем все, кроме скобок и слешей
  if (entityType === 'link') {
    return escapeMarkdownV2(text, ['[', ']', '(', ')', '/']);
  }

  // Для кода экранируем все, кроме обратных кавычек (но их нужно экранировать отдельно)
  if (entityType === 'code' || entityType === 'pre') {
    return escapeMarkdownV2(text, ['`']);
  }

  // Для обычного текста экранируем все
  return escapeMarkdownV2(text);
}

/**
 * Валидирует MarkdownV2 текст на наличие ошибок
 * @param text - текст для валидации
 * @returns объект с результатом валидации
 */
export function validateMarkdownV2(text: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text) {
    return { isValid: true, errors, warnings };
  }

  // Проверка на незакрытые теги
  const boldMatches = text.match(/\*[^*]+\*/g) || [];
  const boldOpen = (text.match(/\*/g) || []).length;
  if (boldOpen % 2 !== 0) {
    errors.push('Незакрытые теги жирного текста (*)');
  }

  const italicMatches = text.match(/_[^_]+_/g) || [];
  const italicOpen = (text.match(/_/g) || []).length;
  if (italicOpen % 2 !== 0) {
    errors.push('Незакрытые теги курсива (_)');
  }

  // Проверка на незакрытые ссылки
  const linkOpen = (text.match(/\[/g) || []).length;
  const linkClose = (text.match(/\]/g) || []).length;
  if (linkOpen !== linkClose) {
    errors.push('Незакрытые ссылки ([...])');
  }

  const parenOpen = (text.match(/\(/g) || []).length;
  const parenClose = (text.match(/\)/g) || []).length;
  if (parenOpen !== parenClose) {
    errors.push('Незакрытые скобки в ссылках ((...))');
  }

  // Проверка на обратные кавычки в code блоках
  const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
  for (const block of codeBlocks) {
    if (block.includes('`') && !block.startsWith('```')) {
      warnings.push('В блоках кода нельзя использовать неэкранированные обратные кавычки');
    }
  }

  // Проверка на пробелы в URL ссылок
  const linkMatches = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  for (const match of linkMatches) {
    const urlMatch = match.match(/\(([^)]+)\)/);
    if (urlMatch && urlMatch[1].includes(' ')) {
      errors.push('URL в ссылках не может содержать пробелы');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Конвертирует обычный текст в MarkdownV2 с автоматическим экранированием
 * @param text - текст для конвертации
 * @returns текст в формате MarkdownV2
 */
export function convertToMarkdownV2(text: string): string {
  if (!text) return text;

  // Экранируем весь текст
  return escapeMarkdownV2(text);
}

/**
 * Определяет, является ли текст валидным MarkdownV2
 * @param text - текст для проверки
 * @returns true, если текст валиден
 */
export function isMarkdownV2(text: string): boolean {
  if (!text) return false;

  // Проверяем наличие MarkdownV2 паттернов
  const markdownV2Patterns = [
    /\*[^*]+\*/,                    // *bold*
    /_[^_]+_/,                      // _italic_
    /__[^_]+__/,                    // __underline__
    /~[^~]+~/,                      // ~strike~
    /`[^`]+`/,                      // `code`
    /```[\s\S]*?```/,               // ```code block```
    /\[[^\]]+\]\([^)]+\)/,          // [link](url)
    /\|\|[^|]+\|\|/,                // ||spoiler||
  ];

  return markdownV2Patterns.some((pattern) => pattern.test(text));
}

