import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from '../../entities/template.entity';
import { NotificationType, NotificationChannel } from '../../entities/notification.entity';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private templateRepository: Repository<Template>,
  ) {}

  async findAll(): Promise<Template[]> {
    return await this.templateRepository.find({
      order: { type: 'ASC', channel: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Template> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Шаблон не найден');
    }
    return template;
  }

  async findByTypeAndChannel(type: NotificationType, channel: NotificationChannel): Promise<Template | null> {
    return await this.templateRepository.findOne({
      where: { type, channel },
    });
  }

  async create(data: {
    name: string;
    type: NotificationType;
    channel: NotificationChannel;
    subject: string;
    body: string;
    variables?: string[];
    isActive?: boolean;
  }): Promise<Template> {
    const template = this.templateRepository.create(data);
    return await this.templateRepository.save(template);
  }

  async update(id: string, data: Partial<Template>): Promise<Template> {
    const template = await this.findOne(id);
    Object.assign(template, data);
    return await this.templateRepository.save(template);
  }

  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepository.remove(template);
  }

  async preview(templateId: string, sampleData: Record<string, any>): Promise<{ subject: string; body: string }> {
    const template = await this.findOne(templateId);
    const Handlebars = require('handlebars');
    const subjectTemplate = Handlebars.compile(template.subject);
    const bodyTemplate = Handlebars.compile(template.body);
    return {
      subject: subjectTemplate(sampleData),
      body: bodyTemplate(sampleData),
    };
  }

  getAvailableVariables(type: NotificationType): string[] {
    const variables: Record<NotificationType, string[]> = {
      [NotificationType.APPOINTMENT_CONFIRMED]: [
        'serviceName',
        'masterName',
        'startTime',
        'price',
        'clientName',
        'appointmentId',
      ],
      [NotificationType.APPOINTMENT_CANCELLED]: [
        'serviceName',
        'masterName',
        'startTime',
        'reason',
        'clientName',
        'appointmentId',
      ],
      [NotificationType.APPOINTMENT_RESCHEDULED]: [
        'serviceName',
        'masterName',
        'startTime',
        'oldStartTime',
        'clientName',
        'appointmentId',
      ],
      [NotificationType.APPOINTMENT_REMINDER]: [
        'serviceName',
        'masterName',
        'startTime',
        'reminderHours',
        'clientName',
        'appointmentId',
      ],
      [NotificationType.BONUS_EARNED]: ['points', 'totalPoints', 'clientName'],
      [NotificationType.FEEDBACK_REQUEST]: [
        'serviceName',
        'masterName',
        'appointmentId',
        'clientName',
      ],
      [NotificationType.BIRTHDAY_GREETING]: ['clientName', 'dateOfBirth'],
      [NotificationType.MARKETING]: ['clientName', 'message'],
    };
    return variables[type] || [];
  }
}

