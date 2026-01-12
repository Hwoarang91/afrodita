import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { SensitiveDataMasker } from '../utils/sensitive-data-masker';

/**
 * Безопасный Logger Service с автоматическим маскированием чувствительных данных
 * Использует встроенный NestJS Logger, но маскирует phoneNumber, sessionString, encryptedSessionData
 */
@Injectable({ scope: Scope.TRANSIENT })
export class SafeLoggerService implements NestLoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  /**
   * Маскирует чувствительные данные в сообщении перед логированием
   */
  private maskMessage(message: any): any {
    if (typeof message === 'string') {
      return SensitiveDataMasker.maskLogString(message);
    }
    
    if (typeof message === 'object' && message !== null) {
      return SensitiveDataMasker.maskObject(message);
    }

    return message;
  }

  /**
   * Логирует сообщение с маскированием чувствительных данных
   */
  log(message: any, ...optionalParams: any[]): void {
    const maskedMessage = this.maskMessage(message);
    const maskedParams = optionalParams.map(param => this.maskMessage(param));
    console.log(maskedMessage, ...maskedParams);
  }

  error(message: any, trace?: string, context?: string): void {
    const maskedMessage = this.maskMessage(message);
    const maskedTrace = trace ? SensitiveDataMasker.maskLogString(trace) : trace;
    const ctx = context || this.context;
    console.error(`[${ctx || 'Application'}] ERROR:`, maskedMessage);
    if (maskedTrace) {
      console.error('Trace:', maskedTrace);
    }
  }

  warn(message: any, ...optionalParams: any[]): void {
    const maskedMessage = this.maskMessage(message);
    const maskedParams = optionalParams.map(param => this.maskMessage(param));
    console.warn(maskedMessage, ...maskedParams);
  }

  debug(message: any, ...optionalParams: any[]): void {
    if (process.env.NODE_ENV !== 'production') {
      const maskedMessage = this.maskMessage(message);
      const maskedParams = optionalParams.map(param => this.maskMessage(param));
      console.debug(maskedMessage, ...maskedParams);
    }
  }

  verbose(message: any, ...optionalParams: any[]): void {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }
    const maskedMessage = this.maskMessage(message);
    const maskedParams = optionalParams.map(param => this.maskMessage(param));
    console.log('[VERBOSE]', maskedMessage, ...maskedParams);
  }
}
