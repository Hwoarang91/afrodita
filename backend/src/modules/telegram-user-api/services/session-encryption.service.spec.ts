import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { SessionEncryptionService } from './session-encryption.service';
import * as crypto from 'crypto';

describe('SessionEncryptionService', () => {
  const validKey = crypto.randomBytes(32).toString('hex');

  async function createService(overrides: { key?: string; nodeEnv?: string } = {}) {
    const key = overrides.key ?? validKey;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, d?: string) => {
              if (k === 'TELEGRAM_SESSION_ENCRYPTION_KEY') return key;
              if (k === 'NODE_ENV') return overrides.nodeEnv ?? 'test';
              return d;
            }),
          },
        },
      ],
    }).compile();
    return module.get<SessionEncryptionService>(SessionEncryptionService);
  }

  it('шифрует и дешифрует данные', async () => {
    const service = await createService();
    const plain = '{"userId":"u1","sessionId":"s1"}';
    const encrypted = service.encrypt(plain);
    expect(encrypted).toContain(':');
    expect(encrypted.split(':')).toHaveLength(3);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('decrypt пустая строка возвращает {}', async () => {
    const service = await createService();
    expect(service.decrypt('')).toBe('{}');
    expect(service.decrypt(null as any)).toBe('{}');
    expect(service.decrypt(undefined as any)).toBe('{}');
  });

  it('decryptSafe невалидные данные возвращает null', async () => {
    const service = await createService();
    expect(service.decryptSafe('invalid:format')).toBeNull();
  });

  it('decryptSafe {} после decrypt возвращает null', async () => {
    const service = await createService();
    expect(service.decryptSafe('')).toBeNull();
  });

  it('decrypt неверный формат бросает HttpException', async () => {
    const service = await createService();
    await expect(service.decrypt('only-two:parts')).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: HttpStatus.UNAUTHORIZED,
        errorCode: 'SESSION_INVALID',
      }),
    });
  });

  it('требует TELEGRAM_SESSION_ENCRYPTION_KEY', async () => {
    await expect(createService({ key: '' })).rejects.toThrow(/TELEGRAM_SESSION_ENCRYPTION_KEY/);
  });
});
