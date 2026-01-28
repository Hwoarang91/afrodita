import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, MaxLength } from 'class-validator';

export class UserSendMessageDto {
  @ApiProperty({ description: 'ID чата получателя' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Текст сообщения' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096, { message: 'Текст сообщения не более 4096 символов (лимит Telegram)' })
  message: string;

  @ApiProperty({ description: 'Режим парсинга (HTML, Markdown, MarkdownV2)', required: false })
  @IsOptional()
  @IsString()
  parseMode?: string;

  @ApiProperty({ description: 'ID сообщения для ответа', required: false })
  @IsOptional()
  @IsNumber()
  replyToMessageId?: number;

  @ApiProperty({ description: 'Отключить уведомление', required: false })
  @IsOptional()
  @IsBoolean()
  disableNotification?: boolean;
}

export class UserSendMediaDto {
  @ApiProperty({ description: 'ID чата получателя' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Тип медиа (photo, video, audio, document, sticker)' })
  @IsString()
  @IsNotEmpty()
  mediaType: 'photo' | 'video' | 'audio' | 'document' | 'sticker';

  @ApiProperty({ description: 'URL или file_id медиа' })
  @IsString()
  @IsNotEmpty()
  mediaUrl: string;

  @ApiProperty({ description: 'Подпись к медиа', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1024, { message: 'Подпись не более 1024 символов' })
  caption?: string;

  @ApiProperty({ description: 'Режим парсинга подписи', required: false })
  @IsOptional()
  @IsString()
  parseMode?: string;

  @ApiProperty({ description: 'ID сообщения для ответа', required: false })
  @IsOptional()
  @IsNumber()
  replyToMessageId?: number;

  @ApiProperty({ description: 'Отключить уведомление', required: false })
  @IsOptional()
  @IsBoolean()
  disableNotification?: boolean;
}
