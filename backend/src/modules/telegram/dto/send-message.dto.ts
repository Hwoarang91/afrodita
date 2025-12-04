import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, IsEnum } from 'class-validator';

export enum ParseMode {
  HTML = 'HTML',
  Markdown = 'Markdown',
  MarkdownV2 = 'MarkdownV2',
}

export class SendMessageDto {
  @ApiProperty({ description: 'ID чата (число или строка)' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Текст сообщения' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Режим парсинга', enum: ParseMode, required: false })
  @IsOptional()
  @IsEnum(ParseMode)
  parse_mode?: ParseMode;

  @ApiProperty({ description: 'ID сообщения для ответа', required: false })
  @IsOptional()
  @IsNumber()
  reply_to_message_id?: number;

  @ApiProperty({ description: 'Отключить уведомление', required: false })
  @IsOptional()
  @IsBoolean()
  disable_notification?: boolean;

  @ApiProperty({ description: 'Отключить превью ссылок', required: false })
  @IsOptional()
  @IsBoolean()
  disable_web_page_preview?: boolean;
}

export class SendPhotoDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'File ID, URL или base64 строку фото' })
  @IsString()
  @IsNotEmpty()
  photo: string;

  @ApiProperty({ description: 'Подпись к фото', required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ description: 'Режим парсинга', enum: ParseMode, required: false })
  @IsOptional()
  @IsEnum(ParseMode)
  parse_mode?: ParseMode;

  @ApiProperty({ description: 'ID сообщения для ответа', required: false })
  @IsOptional()
  @IsNumber()
  reply_to_message_id?: number;
}

export class SendMediaDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'File ID, URL или base64 строку медиа' })
  @IsString()
  @IsNotEmpty()
  media: string;

  @ApiProperty({ description: 'Подпись', required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ description: 'Режим парсинга', enum: ParseMode, required: false })
  @IsOptional()
  @IsEnum(ParseMode)
  parse_mode?: ParseMode;
}

export class SendLocationDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Широта' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Долгота' })
  @IsNumber()
  longitude: number;
}

export class SendVenueDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Широта' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: 'Долгота' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ description: 'Название места' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Адрес' })
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class SendContactDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Номер телефона' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ description: 'Имя' })
  @IsString()
  @IsNotEmpty()
  firstName: string;
}

export class SendPollDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Вопрос опроса' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Варианты ответов', type: [String] })
  @IsArray()
  @IsString({ each: true })
  options: string[];

  @ApiProperty({ description: 'Анонимный опрос', required: false })
  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @ApiProperty({ description: 'Тип опроса', enum: ['quiz', 'regular'], required: false })
  @IsOptional()
  @IsEnum(['quiz', 'regular'])
  type?: 'quiz' | 'regular';

  @ApiProperty({ description: 'Позволить множественные ответы', required: false })
  @IsOptional()
  @IsBoolean()
  allows_multiple_answers?: boolean;
}

export class DeleteMessageDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'ID сообщения для удаления' })
  @IsNumber()
  @IsNotEmpty()
  messageId: number;
}

export class PinMessageDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'ID сообщения для закрепления' })
  @IsNumber()
  @IsNotEmpty()
  messageId: number;

  @ApiProperty({ description: 'Отключить уведомление', required: false })
  @IsOptional()
  @IsBoolean()
  disable_notification?: boolean;
}

export class SetChatTitleDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Новое название чата' })
  @IsString()
  @IsNotEmpty()
  title: string;
}

export class SetChatDescriptionDto {
  @ApiProperty({ description: 'ID чата' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'Новое описание чата' })
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ForwardMessageDto {
  @ApiProperty({ description: 'ID чата для отправки' })
  @IsNotEmpty()
  chatId: string | number;

  @ApiProperty({ description: 'ID чата-источника' })
  @IsNotEmpty()
  fromChatId: string | number;

  @ApiProperty({ description: 'ID сообщения для пересылки' })
  @IsNumber()
  @IsNotEmpty()
  messageId: number;
}

