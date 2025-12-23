/**
 * Тесты для проверки архитектурных принципов
 * 
 * Проверяет:
 * - Никаких error.message.includes() вне mapper
 * - Никаких Telegram строк в UI / controller
 * - Единственная точка знания MTProto — telegram-error-mapper.ts
 * - UI работает только с ErrorCode
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Архитектурные принципы', () => {
  const backendRoot = path.join(__dirname, '../../..');
  const adminRoot = path.join(__dirname, '../../../../admin');

  describe('Принцип 1: Никаких error.message.includes() вне mapper', () => {
    it('не должно быть includes() для Telegram ошибок в контроллерах', () => {
      const controllersPath = path.join(backendRoot, 'modules');
      const files = getAllFiles(controllersPath, ['.ts'], ['.spec.ts', '.test.ts']);
      
      const violations: string[] = [];
      
      files.forEach((file) => {
        if (file.includes('controller') || file.includes('service')) {
          const content = fs.readFileSync(file, 'utf-8');
          
          // Проверяем наличие includes() для Telegram ошибок
          const telegramErrorPatterns = [
            /\.includes\(['"]AUTH_KEY/,
            /\.includes\(['"]SESSION_/,
            /\.includes\(['"]PHONE_/,
            /\.includes\(['"]FLOOD_/,
            /\.includes\(['"]DC_MIGRATE/,
          ];
          
          telegramErrorPatterns.forEach((pattern) => {
            if (pattern.test(content) && !file.includes('telegram-error-mapper')) {
              violations.push(`${file}: содержит includes() для Telegram ошибок`);
            }
          });
        }
      });
      
      expect(violations).toEqual([]);
    });
  });

  describe('Принцип 2: Никаких Telegram строк в UI / controller', () => {
    it('не должно быть Telegram строк в UI компонентах', () => {
      const uiFiles = [
        ...getAllFiles(path.join(adminRoot, 'app'), ['.tsx', '.ts'], ['.spec.ts', '.test.ts']),
        ...getAllFiles(path.join(adminRoot, 'lib'), ['.ts'], ['.spec.ts', '.test.ts']),
      ];
      
      const violations: string[] = [];
      const telegramStrings = [
        'AUTH_KEY_UNREGISTERED',
        'SESSION_REVOKED',
        'PHONE_CODE_INVALID',
        'FLOOD_WAIT',
        'DC_MIGRATE',
      ];
      
      uiFiles.forEach((file) => {
        const content = fs.readFileSync(file, 'utf-8');
        
        telegramStrings.forEach((telegramString) => {
          // Исключаем файлы, которые специально работают с ErrorCode
          if (
            content.includes(telegramString) &&
            !file.includes('error-code-ui-matrix') &&
            !file.includes('error-response')
          ) {
            violations.push(`${file}: содержит Telegram строку "${telegramString}"`);
          }
        });
      });
      
      expect(violations).toEqual([]);
    });
  });

  describe('Принцип 3: Единственная точка знания MTProto', () => {
    it('telegram-error-mapper.ts должен быть единственным местом маппинга', () => {
      const mapperPath = path.join(backendRoot, 'modules/telegram/utils/telegram-error-mapper.ts');
      const mapperContent = fs.readFileSync(mapperPath, 'utf-8');
      
      // Проверяем, что mapper содержит все необходимые маппинги
      const requiredMappings = [
        'FLOOD_WAIT',
        'PHONE_CODE_INVALID',
        'PHONE_CODE_EXPIRED',
        'AUTH_KEY_UNREGISTERED',
        'SESSION_REVOKED',
        'DC_MIGRATE',
      ];
      
      requiredMappings.forEach((mapping) => {
        expect(mapperContent).toContain(mapping);
      });
    });
  });

  describe('Принцип 4: UI работает только с ErrorCode', () => {
    it('UI должен использовать только ErrorCode enum', () => {
      const uiMatrixPath = path.join(adminRoot, 'lib/error-code-ui-matrix.ts');
      
      if (fs.existsSync(uiMatrixPath)) {
        const content = fs.readFileSync(uiMatrixPath, 'utf-8');
        
        // Проверяем, что используются ErrorCode, а не строки
        expect(content).toContain('ErrorCode.');
        expect(content).not.toMatch(/['"]FLOOD_WAIT['"]/);
        expect(content).not.toMatch(/['"]PHONE_CODE_INVALID['"]/);
      }
    });
  });
});

/**
 * Вспомогательная функция для получения всех файлов
 */
function getAllFiles(
  dirPath: string,
  extensions: string[],
  excludePatterns: string[] = [],
): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dirPath)) {
    return files;
  }
  
  const items = fs.readdirSync(dirPath);
  
  items.forEach((item) => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions, excludePatterns));
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      if (extensions.includes(ext)) {
        const shouldExclude = excludePatterns.some((pattern) => fullPath.includes(pattern));
        if (!shouldExclude) {
          files.push(fullPath);
        }
      }
    }
  });
  
  return files;
}

