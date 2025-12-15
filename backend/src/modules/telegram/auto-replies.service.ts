import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutoReply } from '../../entities/auto-reply.entity';

@Injectable()
export class AutoRepliesService {
  constructor(
    @InjectRepository(AutoReply)
    private autoReplyRepository: Repository<AutoReply>,
  ) {}

  async findAll(): Promise<AutoReply[]> {
    return await this.autoReplyRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<AutoReply[]> {
    return await this.autoReplyRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<AutoReply> {
    const autoReply = await this.autoReplyRepository.findOne({ where: { id } });
    if (!autoReply) {
      throw new NotFoundException('Автоматический ответ не найден');
    }
    return autoReply;
  }

  async create(data: {
    keyword: string;
    response: string;
    matchType?: 'exact' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
    caseSensitive?: boolean;
    isActive?: boolean;
    chatType?: 'all' | 'private' | 'group' | 'supergroup' | 'channel' | null;
    chatId?: string | null;
  }): Promise<AutoReply> {
    const autoReply = this.autoReplyRepository.create({
      keyword: data.keyword,
      response: data.response,
      matchType: data.matchType || 'contains',
      caseSensitive: data.caseSensitive ?? false,
      isActive: data.isActive ?? true,
      chatType: data.chatType || 'all',
      chatId: data.chatId || null,
    });
    return await this.autoReplyRepository.save(autoReply);
  }

  async update(id: string, data: Partial<AutoReply>): Promise<AutoReply> {
    const autoReply = await this.findOne(id);
    Object.assign(autoReply, data);
    return await this.autoReplyRepository.save(autoReply);
  }

  async delete(id: string): Promise<void> {
    const autoReply = await this.findOne(id);
    await this.autoReplyRepository.remove(autoReply);
  }

  async findMatchingReply(
    message: string,
    chatType: string,
    chatId?: string,
  ): Promise<AutoReply | null> {
    const activeReplies = await this.autoReplyRepository.find({
      where: { isActive: true },
    });

    for (const reply of activeReplies) {
      // Проверяем тип чата
      if (reply.chatType !== 'all' && reply.chatType !== chatType) {
        continue;
      }

      // Проверяем конкретный чат
      if (reply.chatId && reply.chatId !== chatId) {
        continue;
      }

      // Проверяем совпадение
      const keyword = reply.caseSensitive ? reply.keyword : reply.keyword.toLowerCase();
      const messageToCheck = reply.caseSensitive ? message : message.toLowerCase();

      let matches = false;

      switch (reply.matchType) {
        case 'exact':
          matches = messageToCheck === keyword;
          break;
        case 'contains':
          matches = messageToCheck.includes(keyword);
          break;
        case 'startsWith':
          matches = messageToCheck.startsWith(keyword);
          break;
        case 'endsWith':
          matches = messageToCheck.endsWith(keyword);
          break;
        case 'regex':
          try {
            const regex = new RegExp(keyword, reply.caseSensitive ? '' : 'i');
            matches = regex.test(message);
          } catch {
            // Невалидный regex, пропускаем
            continue;
          }
          break;
      }

      if (matches) {
        // Увеличиваем счетчик использования
        reply.usageCount += 1;
        reply.lastUsedAt = new Date();
        await this.autoReplyRepository.save(reply);
        return reply;
      }
    }

    return null;
  }
}

