import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UserSendMessageDto {
  @ApiProperty({ description: 'ID чата получателя' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Текст сообщения' })
  @IsString()
  @IsNotEmpty()
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

