import {
  escapeMarkdownV2,
  escapeForMarkdownV2Entity,
  validateMarkdownV2,
  convertToMarkdownV2,
  isMarkdownV2,
} from './markdown-v2.utils';

describe('MarkdownV2 Utils', () => {
  describe('escapeMarkdownV2', () => {
    it('должен экранировать специальные символы', () => {
      const text = 'Hello *world* _test_';
      const result = escapeMarkdownV2(text);
      expect(result).toBe('Hello \\*world\\* \\_test\\_');
    });

    it('должен экранировать все специальные символы', () => {
      const text = '_*[]()~`>#+-=|{}.!';
      const result = escapeMarkdownV2(text);
      expect(result).toContain('\\_');
      expect(result).toContain('\\*');
      expect(result).toContain('\\[');
      expect(result).toContain('\\]');
    });

    it('должен исключать указанные символы из экранирования', () => {
      const text = 'Hello *world* [link](url)';
      const result = escapeMarkdownV2(text, ['[', ']', '(', ')']);
      expect(result).toContain('[link](url)');
      expect(result).toContain('\\*world\\*');
    });

    it('должен обработать пустую строку', () => {
      expect(escapeMarkdownV2('')).toBe('');
    });

    it('должен обработать null/undefined', () => {
      expect(escapeMarkdownV2(null as any)).toBe(null);
      expect(escapeMarkdownV2(undefined as any)).toBe(undefined);
    });

    it('должен экранировать символ в начале строки', () => {
      const text = '*bold*';
      const result = escapeMarkdownV2(text);
      expect(result).toBe('\\*bold\\*');
    });

    it('должен избегать двойного экранирования', () => {
      const text = '\\*already escaped\\*';
      const result = escapeMarkdownV2(text);
      // Не должно быть тройного экранирования
      expect(result).not.toContain('\\\\\\*');
    });
  });

  describe('escapeForMarkdownV2Entity', () => {
    it('должен экранировать текст для обычного текста', () => {
      const text = 'Hello *world*';
      const result = escapeForMarkdownV2Entity(text, 'text');
      expect(result).toContain('\\*');
    });

    it('должен экранировать текст для ссылок, исключая скобки', () => {
      const text = 'Link [text](url)';
      const result = escapeForMarkdownV2Entity(text, 'link');
      expect(result).toContain('[text](url)');
    });

    it('должен экранировать текст для кода, исключая обратные кавычки', () => {
      const text = 'Code `test`';
      const result = escapeForMarkdownV2Entity(text, 'code');
      expect(result).toContain('`test`');
    });

    it('должен экранировать текст для pre блоков', () => {
      const text = 'Pre *code*';
      const result = escapeForMarkdownV2Entity(text, 'pre');
      expect(result).toContain('\\*');
    });

    it('должен обработать пустую строку', () => {
      expect(escapeForMarkdownV2Entity('', 'text')).toBe('');
    });
  });

  describe('validateMarkdownV2', () => {
    it('должен вернуть валидный результат для пустой строки', () => {
      const result = validateMarkdownV2('');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('должен обнаружить незакрытые теги жирного текста', () => {
      const text = 'Hello *world';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Незакрытые теги жирного текста (*)');
    });

    it('должен обнаружить незакрытые теги курсива', () => {
      const text = 'Hello _world';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Незакрытые теги курсива (_)');
    });

    it('должен обнаружить незакрытые ссылки', () => {
      const text = 'Hello [world';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Незакрытые ссылки ([...])');
    });

    it('должен обнаружить незакрытые скобки в ссылках', () => {
      const text = 'Hello [world](url';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Незакрытые скобки в ссылках ((...))');
    });

    it('должен обнаружить пробелы в URL ссылок', () => {
      const text = 'Hello [world](url with spaces)';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL в ссылках не может содержать пробелы');
    });

    it('должен вернуть валидный результат для корректного MarkdownV2', () => {
      const text = 'Hello *world* _test_ [link](url)';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('должен обработать валидные блоки кода', () => {
      const text = '```code block```';
      const result = validateMarkdownV2(text);
      expect(result.isValid).toBe(true);
    });
  });

  describe('convertToMarkdownV2', () => {
    it('должен конвертировать обычный текст в MarkdownV2', () => {
      const text = 'Hello world';
      const result = convertToMarkdownV2(text);
      expect(result).toBe('Hello world');
    });

    it('должен экранировать специальные символы', () => {
      const text = 'Hello *world*';
      const result = convertToMarkdownV2(text);
      expect(result).toContain('\\*');
    });

    it('должен обработать пустую строку', () => {
      expect(convertToMarkdownV2('')).toBe('');
    });

    it('должен обработать null/undefined', () => {
      expect(convertToMarkdownV2(null as any)).toBe(null);
      expect(convertToMarkdownV2(undefined as any)).toBe(undefined);
    });
  });

  describe('isMarkdownV2', () => {
    it('должен вернуть true для текста с жирным шрифтом', () => {
      expect(isMarkdownV2('Hello *world*')).toBe(true);
    });

    it('должен вернуть true для текста с курсивом', () => {
      expect(isMarkdownV2('Hello _world_')).toBe(true);
    });

    it('должен вернуть true для текста с подчеркиванием', () => {
      expect(isMarkdownV2('Hello __world__')).toBe(true);
    });

    it('должен вернуть true для текста с зачеркиванием', () => {
      expect(isMarkdownV2('Hello ~world~')).toBe(true);
    });

    it('должен вернуть true для текста с кодом', () => {
      expect(isMarkdownV2('Hello `world`')).toBe(true);
    });

    it('должен вернуть true для текста с блоком кода', () => {
      expect(isMarkdownV2('```code block```')).toBe(true);
    });

    it('должен вернуть true для текста со ссылкой', () => {
      expect(isMarkdownV2('Hello [world](url)')).toBe(true);
    });

    it('должен вернуть true для текста со спойлером', () => {
      expect(isMarkdownV2('Hello ||world||')).toBe(true);
    });

    it('должен вернуть false для обычного текста', () => {
      expect(isMarkdownV2('Hello world')).toBe(false);
    });

    it('должен вернуть false для пустой строки', () => {
      expect(isMarkdownV2('')).toBe(false);
    });

    it('должен вернуть false для null/undefined', () => {
      expect(isMarkdownV2(null as any)).toBe(false);
      expect(isMarkdownV2(undefined as any)).toBe(false);
    });
  });
});

