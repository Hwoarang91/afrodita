import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactRequest } from '../../entities/contact-request.entity';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { UpdateContactRequestDto } from './dto/update-contact-request.dto';

@Injectable()
export class ContactRequestsService {
  constructor(
    @InjectRepository(ContactRequest)
    private readonly contactRequestRepository: Repository<ContactRequest>,
  ) {}

  async create(dto: CreateContactRequestDto): Promise<ContactRequest> {
    const contactRequest = this.contactRequestRepository.create(dto);
    return await this.contactRequestRepository.save(contactRequest);
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: 'new' | 'processed',
  ): Promise<{ data: ContactRequest[]; total: number }> {
    const where: any = {};
    if (status === 'new') {
      where.isRead = false;
    } else if (status === 'processed') {
      where.isProcessed = true;
    }

    const [data, total] = await this.contactRequestRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findOne(id: string): Promise<ContactRequest> {
    const contactRequest = await this.contactRequestRepository.findOne({
      where: { id },
    });

    if (!contactRequest) {
      throw new NotFoundException(`Заявка с ID ${id} не найдена`);
    }

    return contactRequest;
  }

  async update(id: string, dto: UpdateContactRequestDto): Promise<ContactRequest> {
    const contactRequest = await this.findOne(id);
    Object.assign(contactRequest, dto);
    return await this.contactRequestRepository.save(contactRequest);
  }

  async remove(id: string): Promise<void> {
    const contactRequest = await this.findOne(id);
    await this.contactRequestRepository.remove(contactRequest);
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.contactRequestRepository.delete(ids);
  }

  async markAsRead(id: string): Promise<ContactRequest> {
    return await this.update(id, { isRead: true });
  }

  async markAsProcessed(id: string): Promise<ContactRequest> {
    return await this.update(id, { isProcessed: true });
  }
}

