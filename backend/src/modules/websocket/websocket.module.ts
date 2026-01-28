import { Module, forwardRef } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { TelegramUserApiModule } from '../telegram-user-api/telegram-user-api.module';

@Module({
  imports: [forwardRef(() => TelegramUserApiModule)], // Telegram User API event emitter (от своего лица)
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}

