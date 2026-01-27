import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramChat, ChatType } from '../../entities/telegram-chat.entity';

@Injectable()
export class TelegramChatsService {
  constructor(
    @InjectRepository(TelegramChat)
    private telegramChatRepository: Repository<TelegramChat>,
  ) {}

  async findAll(): Promise<TelegramChat[]> {
    return await this.telegramChatRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<TelegramChat[]> {
    return await this.telegramChatRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByType(type: ChatType): Promise<TelegramChat[]> {
    return await this.telegramChatRepository.find({
      where: { type, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(chatId: string): Promise<TelegramChat | null> {
    return await this.telegramChatRepository.findOne({
      where: { chatId },
    });
  }

  async getStats() {
    const total = await this.telegramChatRepository.count();
    const active = await this.telegramChatRepository.count({
      where: { isActive: true },
    });
    const groups = await this.telegramChatRepository.count({
      where: { type: ChatType.GROUP, isActive: true },
    });
    const supergroups = await this.telegramChatRepository.count({
      where: { type: ChatType.SUPERGROUP, isActive: true },
    });
    const channels = await this.telegramChatRepository.count({
      where: { type: ChatType.CHANNEL, isActive: true },
    });

    return {
      total,
      active,
      groups,
      supergroups,
      channels,
    };
  }

  async delete(chatId: string): Promise<void> {
    await this.telegramChatRepository.delete({ chatId });
  }

  save(chat: TelegramChat): Promise<TelegramChat> {
    return this.telegramChatRepository.save(chat);
  }

  create(data: Partial<TelegramChat>): TelegramChat {
    return this.telegramChatRepository.create(data);
  }
}

