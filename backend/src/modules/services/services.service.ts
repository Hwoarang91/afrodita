import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Service } from '../../entities/service.entity';
import { Master } from '../../entities/master.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CacheService } from '../../common/cache/cache.service';
import { normalizePagination } from '../../common/dto/pagination.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
    private cacheService: CacheService,
  ) {}

  async create(dto: CreateServiceDto): Promise<Service> {
    const isCategory = dto.isCategory ?? false;
    
    // Валидация: если это категория, цена и время должны быть 0 или не указаны
    if (isCategory) {
      if (dto.price && dto.price > 0) {
        throw new BadRequestException('Категория не может иметь цену');
      }
      if (dto.duration && dto.duration > 0) {
        throw new BadRequestException('Категория не может иметь длительность');
      }
      // Категория не может быть подкатегорией
      if (dto.parentServiceId) {
        throw new BadRequestException('Категория не может быть подкатегорией');
      }
    }

    // Валидация: allowMultipleSubcategories может быть true только для категорий
    if (dto.allowMultipleSubcategories && !isCategory) {
      throw new BadRequestException('allowMultipleSubcategories может быть true только для категорий');
    }

    // Если это подкатегория, isCategory должен быть false
    if (dto.parentServiceId && isCategory) {
      throw new BadRequestException('Подкатегория не может быть категорией');
    }

    // Если это подкатегория, цена и время обязательны
    if (dto.parentServiceId && (!dto.price || dto.price <= 0 || !dto.duration || dto.duration <= 0)) {
      throw new BadRequestException('Подкатегория должна иметь цену и длительность');
    }

    // Если это самостоятельная услуга, цена и время обязательны
    if (!isCategory && !dto.parentServiceId && (!dto.price || dto.price <= 0 || !dto.duration || dto.duration <= 0)) {
      throw new BadRequestException('Самостоятельная услуга должна иметь цену и длительность');
    }

    const service = this.serviceRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
      isCategory: isCategory,
      price: isCategory ? 0 : (dto.price ?? 0),
      duration: isCategory ? 0 : (dto.duration ?? 60),
      allowMultipleSubcategories: isCategory ? (dto.allowMultipleSubcategories ?? false) : false,
    });
    const savedService = await this.serviceRepository.save(service);

    // Связываем услугу с мастерами, если указаны masterIds
    if (dto.masterIds && dto.masterIds.length > 0) {
      const masters = await this.masterRepository.find({
        where: { id: In(dto.masterIds) },
      });
      savedService.masters = masters;
      await this.serviceRepository.save(savedService);
    }

    // Очищаем кэш услуг
    this.cacheService.clearByPattern('^services:');

    return await this.findById(savedService.id);
  }

  async findAll(category?: string, page?: string | number, limit?: string | number, search?: string, isActive?: boolean, includeSubcategories: boolean = false): Promise<{ data: Service[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page: p, limit: l } = normalizePagination(page, limit);
    const query = this.serviceRepository.createQueryBuilder('service')
      .leftJoinAndSelect('service.masters', 'masters')
      .leftJoinAndSelect('service.subcategories', 'subcategories')
      .leftJoinAndSelect('service.parentService', 'parentService');

    if (isActive !== undefined) {
      query.where('service.isActive = :isActive', { isActive });
    } else {
      query.where('service.isActive = :isActive', { isActive: true });
    }

    // По умолчанию показываем только основные услуги (без родителя)
    if (!includeSubcategories) {
      query.andWhere('service.parentServiceId IS NULL');
    }

    if (category) {
      query.andWhere('service.category = :category', { category });
    }

    if (search) {
      query.andWhere(
        '(service.name ILIKE :search OR service.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('service.name', 'ASC');

    const total = await query.getCount();
    query.skip((p - 1) * l).take(l);

    const data = await query.getMany();

    return {
      data,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
    };
  }

  // Получить подкатегории для родительской услуги
  async findSubcategories(parentServiceId: string): Promise<Service[]> {
    return await this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.masters', 'masters')
      .where('service.parentServiceId = :parentServiceId', { parentServiceId })
      .andWhere('service.isActive = :isActive', { isActive: true })
      .orderBy('service.name', 'ASC')
      .getMany();
  }

  // Получить только самостоятельные услуги (не категории, не подкатегории)
  // Также возвращает подкатегории, если они есть
  async findMainServices(isActive: boolean = true, category?: string): Promise<Service[]> {
    // Получаем самостоятельные услуги
    const query = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.masters', 'masters')
      .where('service.parentServiceId IS NULL')
      .andWhere('service.isCategory = :isCategory', { isCategory: false })
      .andWhere('service.isActive = :isActive', { isActive });
    
    if (category) {
      query.andWhere('service.category = :category', { category });
    }
    
    const mainServices = await query.orderBy('service.name', 'ASC').getMany();
    
    // Если указана категория, получаем также подкатегории из категорий с этой категорией
    // Если категория не указана, получаем все подкатегории
    const subcategoriesQuery = this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.masters', 'masters')
      .leftJoinAndSelect('service.parentService', 'parentService')
      .where('service.parentServiceId IS NOT NULL')
      .andWhere('service.isCategory = :isCategory', { isCategory: false })
      .andWhere('service.isActive = :isActive', { isActive });
    
    if (category) {
      // Для подкатегорий берем категорию из родительской категории или из строкового поля category
      subcategoriesQuery.andWhere(
        '(parentService.category = :category OR service.category = :category)',
        { category }
      );
    }
    
    const subcategories = await subcategoriesQuery.orderBy('service.name', 'ASC').getMany();
    
    // Заполняем поле category у подкатегорий из родительской категории, если оно пустое
    const subcategoriesWithCategory = subcategories.map(sub => {
      if (!sub.category && sub.parentService) {
        // Используем категорию из родительской категории
        sub.category = sub.parentService.category || null;
      }
      return sub;
    });
    
    // Объединяем самостоятельные услуги и подкатегории
    return [...mainServices, ...subcategoriesWithCategory];
  }

  // Получить только категории (без подкатегорий)
  async findCategories(isActive: boolean = true): Promise<Service[]> {
    const cacheKey = `services:categories:${isActive}`;
    const cached = this.cacheService.get<Service[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.serviceRepository
      .createQueryBuilder('service')
      .leftJoinAndSelect('service.masters', 'masters')
      .leftJoinAndSelect('service.subcategories', 'subcategories')
      .where('service.isCategory = :isCategory', { isCategory: true })
      .andWhere('service.isActive = :isActive', { isActive })
      .orderBy('service.name', 'ASC')
      .getMany();
    
    // Кэшируем на 5 минут
    this.cacheService.set(cacheKey, result, 300);
    
    return result;
  }

  // Получить услуги для бота (самостоятельные + категории, без подкатегорий)
  async findServicesForBot(isActive: boolean = true): Promise<Service[]> {
    const cacheKey = `services:bot:${isActive}`;
    const cached = this.cacheService.get<Service[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Используем QueryBuilder для более точной фильтрации
    const query = this.serviceRepository.createQueryBuilder('service')
      .leftJoinAndSelect('service.masters', 'masters')
      .leftJoinAndSelect('service.subcategories', 'subcategories')
      .where('service.isActive = :isActive', { isActive })
      .andWhere(
        '(service.parentServiceId IS NULL AND service.isCategory = false) OR service.isCategory = true'
      )
      .orderBy('service.name', 'ASC');
    
    const result = await query.getMany();
    // Кэшируем на 5 минут
    this.cacheService.set(cacheKey, result, 300);
    
    return result;
  }

  async findById(id: string): Promise<Service> {
    const service = await this.serviceRepository.findOne({
      where: { id },
      relations: ['masters', 'subcategories', 'parentService'],
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  /** Загрузка нескольких услуг по id (для устранения N+1 в циклах). Порядок в массиве не гарантируется. */
  async findByIds(ids: string[]): Promise<Service[]> {
    if (!ids || ids.length === 0) return [];
    return this.serviceRepository.find({
      where: { id: In(ids) },
      relations: ['masters', 'subcategories', 'parentService'],
    });
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    // Очищаем кэш перед обновлением
    this.cacheService.clearByPattern('^services:');
    const service = await this.findById(id);
    
    const newIsCategory = dto.isCategory !== undefined ? dto.isCategory : service.isCategory;
    const newParentServiceId = dto.parentServiceId !== undefined ? dto.parentServiceId : service.parentServiceId;
    
    // Валидация: если это категория, цена и время должны быть 0
    if (newIsCategory) {
      if (dto.price !== undefined && dto.price > 0) {
        throw new BadRequestException('Категория не может иметь цену');
      }
      if (dto.duration !== undefined && dto.duration > 0) {
        throw new BadRequestException('Категория не может иметь длительность');
      }
      // Категория не может быть подкатегорией
      if (newParentServiceId) {
        throw new BadRequestException('Категория не может быть подкатегорией');
      }
    }

    // Валидация: allowMultipleSubcategories может быть true только для категорий
    if (dto.allowMultipleSubcategories && !newIsCategory) {
      throw new BadRequestException('allowMultipleSubcategories может быть true только для категорий');
    }

    // Если это подкатегория, isCategory должен быть false
    if (newParentServiceId && newIsCategory) {
      throw new BadRequestException('Подкатегория не может быть категорией');
    }

    // Если устанавливаем parentServiceId, сбрасываем isCategory и allowMultipleSubcategories
    if (dto.parentServiceId !== undefined && dto.parentServiceId) {
      dto.isCategory = false;
      dto.allowMultipleSubcategories = false;
    }

    // Если устанавливаем isCategory в true, сбрасываем parentServiceId и allowMultipleSubcategories
    if (dto.isCategory === true) {
      dto.parentServiceId = null;
      dto.allowMultipleSubcategories = dto.allowMultipleSubcategories ?? false;
    }

    // Если это подкатегория, цена и время обязательны
    if (newParentServiceId && (!dto.price || dto.price <= 0 || !dto.duration || dto.duration <= 0)) {
      // Проверяем текущие значения, если новые не указаны
      const finalPrice = dto.price !== undefined ? dto.price : service.price;
      const finalDuration = dto.duration !== undefined ? dto.duration : service.duration;
      if (!finalPrice || finalPrice <= 0 || !finalDuration || finalDuration <= 0) {
        throw new BadRequestException('Подкатегория должна иметь цену и длительность');
      }
    }

    // Если это самостоятельная услуга, цена и время обязательны
    if (!newIsCategory && !newParentServiceId) {
      const finalPrice = dto.price !== undefined ? dto.price : service.price;
      const finalDuration = dto.duration !== undefined ? dto.duration : service.duration;
      if (!finalPrice || finalPrice <= 0 || !finalDuration || finalDuration <= 0) {
        throw new BadRequestException('Самостоятельная услуга должна иметь цену и длительность');
      }
    }

    // Обновляем поля
    if (newIsCategory) {
      dto.price = 0;
      dto.duration = 0;
    }

    Object.assign(service, dto);

    // Обновляем связи с мастерами, если указаны masterIds
    if (dto.masterIds !== undefined) {
      if (dto.masterIds.length > 0) {
        const masters = await this.masterRepository.find({
          where: { id: In(dto.masterIds) },
        });
        service.masters = masters;
      } else {
        service.masters = [];
      }
    }

    await this.serviceRepository.save(service);
    
    // Очищаем кэш услуг
    this.cacheService.clearByPattern('^services:');
    
    return await this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const service = await this.findById(id);
    service.isActive = false;
    await this.serviceRepository.save(service);
    
    // Очищаем кэш услуг
    this.cacheService.clearByPattern('^services:');
  }
}

