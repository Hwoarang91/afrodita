import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup, Context } from 'telegraf';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, MoreThanOrEqual } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { Service } from '../../entities/service.entity';
import { Master } from '../../entities/master.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { TelegramChat, ChatType } from '../../entities/telegram-chat.entity';
import { GroupSettings } from '../../entities/group-settings.entity';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { MastersService } from '../masters/masters.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationChannel } from '../../entities/notification.entity';
import { ReviewsService } from '../reviews/reviews.service';
import { FinancialService } from '../financial/financial.service';
import { Transaction, TransactionType } from '../../entities/transaction.entity';

interface BotSession {
  step?: string;
  selectedServiceId?: string; // Выбранная основная услуга
  selectedSubcategoryIds?: string[]; // Выбранные подкатегории
  selectedMasterId?: string;
  selectedDate?: string;
  selectedTime?: string;
  selectedAppointmentId?: string; // Для переноса записей
  rescheduleReason?: string; // Причина переноса записи
  availableMasters?: Array<{ id: string; name: string; rating?: string }>; // Кэш доступных мастеров для текущей услуги
  timeSlots?: string[]; // Кэш доступных временных слотов (ISO строки)
  broadcastMessage?: string; // Сообщение для рассылки
  selectedAppointmentForReview?: string; // ID записи для отзыва
  reviewRating?: number; // Рейтинг отзыва
  showPreview?: boolean; // Показывать ли предпросмотр перед подтверждением
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private sessions: Map<number, BotSession> = new Map();
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(TelegramChat)
    private telegramChatRepository: Repository<TelegramChat>,
    @InjectRepository(GroupSettings)
    private groupSettingsRepository: Repository<GroupSettings>,
    private usersService: UsersService,
    private servicesService: ServicesService,
    private mastersService: MastersService,
    @Inject(forwardRef(() => AppointmentsService))
    private appointmentsService: AppointmentsService,
    private settingsService: SettingsService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private reviewsService: ReviewsService,
    private financialService: FinancialService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не установлен. Бот не будет запущен.');
      return;
    }

    try {
      this.bot = new Telegraf(token);
      
      // ВАЖНО: Порядок регистрации обработчиков имеет значение!
      // Сначала упоминания бота, потом команды, потом обработка контактов, потом обработка групп, потом callbacks, потом обработка ошибок
      this.setupMentionHandler(); // Обработка упоминаний бота (@botname) - должна быть ДО команд
      this.setupCommands();
      this.setupContactHandler();
      this.setupGroupHandlers(); // Обработка событий группы
      this.setupInlineQuery(); // Обработка inline-запросов
      this.setupCallbacks();
      this.setupErrorHandling();
      
      // Устанавливаем команды бота через Bot API (после регистрации обработчиков)
      try {
        await this.bot.telegram.setMyCommands([
          { command: 'start', description: 'Главное меню' },
          { command: 'help', description: 'Справка по командам' },
          { command: 'book', description: 'Записаться на услугу' },
          { command: 'appointments', description: 'Мои записи' },
          { command: 'services', description: 'Список услуг' },
          { command: 'profile', description: 'Мой профиль' },
          { command: 'bonus', description: 'Баланс и история бонусов' },
          { command: 'reschedule', description: 'Перенести запись' },
          { command: 'cancel', description: 'Отменить запись' },
          { command: 'schedule', description: 'Свободные слоты (работает в группах)' },
          { command: 'masters', description: 'Информация о мастерах (работает в группах)' },
          { command: 'promotions', description: 'Акции и скидки (работает в группах)' },
          { command: 'faq', description: 'Часто задаваемые вопросы (работает в группах)' },
          { command: 'admin', description: 'Админская панель (только для админов)' },
          { command: 'stats', description: 'Статистика бота (только для админов)' },
        ]);
        this.logger.log('✅ Команды бота установлены');
      } catch (error: any) {
        this.logger.warn(`Не удалось установить команды бота: ${error.message}`);
      }
      
      // Запускаем бота асинхронно, чтобы не блокировать запуск приложения
      this.bot.launch().then(() => {
        this.logger.log('🤖 Telegram bot успешно запущен');
      }).catch((error: any) => {
        this.logger.error(`Ошибка при запуске бота: ${error.message}`, error.stack);
      });
    } catch (error: any) {
      // Обработка ошибки 409 - конфликт с другим экземпляром бота
      if (error.response?.error_code === 409 || error.message?.includes('409') || error.message?.includes('Conflict')) {
        this.logger.warn('⚠️ Другой экземпляр бота уже запущен. Этот экземпляр не будет обрабатывать обновления.');
        this.logger.warn('💡 Убедитесь, что запущен только один экземпляр бота (Docker или локально, но не оба одновременно).');
        // Не выбрасываем ошибку, чтобы приложение могло продолжить работу
        // Бот просто не будет обрабатывать обновления, но API будет работать
        return;
      }
      this.logger.error(`Ошибка при запуске бота: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    if (this.bot) {
      try {
        this.logger.log('🛑 Остановка Telegram бота...');
        await this.bot.stop('SIGTERM');
        this.logger.log('✅ Telegram бот корректно остановлен');
      } catch (error: any) {
        this.logger.warn(`⚠️ Ошибка при остановке бота: ${error.message}`);
        // Пытаемся принудительно остановить
        try {
          if (this.bot.telegram) {
            await this.bot.telegram.deleteWebhook({ drop_pending_updates: false });
          }
        } catch (e) {
          // Игнорируем ошибки при принудительной остановке
        }
      }
    }
  }

  /**
   * Обработка упоминаний бота в групповых чатах (@botname)
   * Должна быть зарегистрирована ДО обработчиков команд
   */
  private setupMentionHandler() {
    if (!this.bot) {
      this.logger.warn('Бот не инициализирован, пропускаем setupMentionHandler');
      return;
    }
    
    // Используем middleware для обработки упоминаний
    this.bot.use(async (ctx, next) => {
      // Проверяем только текстовые сообщения в группах
      if (!ctx.message || !('text' in ctx.message)) {
        return next();
      }
      
      const messageText = ctx.message.text;
        
      // Пропускаем команды
      if (messageText.startsWith('/')) {
        return next();
      }
        
      const isGroup = this.isGroupChat(ctx.chat);
      if (isGroup && messageText) {
        try {
          const botInfo = await this.bot.telegram.getMe();
          const botUsername = botInfo.username;
          const botMention = `@${botUsername}`;
          
          // Проверяем, упоминается ли бот в сообщении
          const hasMention = messageText.includes(botMention) || 
            ctx.message.entities?.some((entity: any) => {
              if (entity.type === 'mention') {
                const mentionText = messageText.substring(entity.offset, entity.offset + entity.length);
                return mentionText === botMention;
              }
              return false;
            });
          
          if (hasMention) {
            // Отправляем приватный ответ на упоминание
            const customStartMessage = await this.settingsService.get('telegramStartMessage', null);
            const keyboard = Markup.inlineKeyboard([
              [{ text: '📅 Записаться', switch_inline_query: 'book' }],
              [{ text: '📋 Мои записи', switch_inline_query: 'appointments' }],
              [Markup.button.url('💬 Перейти в личный чат', `https://t.me/${botUsername}?start=group_${ctx.chat.id}`)],
            ]);
            
            let replyMessage = customStartMessage || 
              `👋 Привет, ${ctx.from.first_name}!\n\n` +
              `Я бот салона красоты "Афродита". Для работы со мной используйте кнопки ниже или перейдите в личный чат.`;
            
            // Заменяем переменные в сообщении
            if (customStartMessage) {
              const user = await this.userRepository.findOne({ where: { telegramId: ctx.from.id.toString() } }).catch(() => null);
              replyMessage = this.replaceMessageVariables(replyMessage, user || ctx.from, ctx.chat);
            }
            
            await this.sendPrivateReply(ctx, replyMessage, { 
              reply_markup: keyboard.reply_markup,
            });
            return; // Не передаем управление дальше
          }
        } catch (error: any) {
          this.logger.error(`Ошибка при обработке упоминания бота: ${error.message}`);
        }
      }
      
      return next(); // Передаем управление следующему обработчику
    });
  }

  private setupErrorHandling() {
    // Обработка ошибок бота
    this.bot.catch((err, ctx) => {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Ошибка в боте: ${error.message}`, error.stack);
      ctx.reply('Произошла ошибка. Попробуйте позже или используйте /start для перезапуска.');
    });

    // Обработка неизвестных команд и текстовых сообщений
    this.bot.on('text', async (ctx) => {
      // Проверяем, не является ли это командой
      if (ctx.message.text.startsWith('/')) {
        return; // Команды обрабатываются отдельно
      }

      const session = this.getSession(ctx.from.id);
      
      // Обработка рассылки
      if (session.step === 'broadcast:message') {
        await this.handleBroadcastMessage(ctx);
        return;
      }

      // Обработка подтверждения рассылки
      if (session.step === 'broadcast:confirm') {
        if (ctx.message.text.toLowerCase() === 'да' || ctx.message.text.toLowerCase() === 'yes') {
          await this.executeBroadcast(ctx, session.broadcastMessage);
        } else {
          session.step = undefined;
          session.broadcastMessage = undefined;
          await ctx.reply('❌ Рассылка отменена.');
        }
        return;
      }

      // Обработка текстовой причины переноса
      if (session.step === 'reschedule_reason_text') {
        session.rescheduleReason = ctx.message.text;
        session.step = undefined;
        
        // Возвращаемся к подтверждению переноса
        if (session.selectedAppointmentId && session.selectedTime) {
          await this.handleConfirmReschedule(ctx, session.selectedAppointmentId);
        } else {
          await ctx.reply('❌ Ошибка: данные сессии потеряны. Начните заново.');
        }
        return;
      }

      // Обработка текста отзыва
      if (session.step === 'review_comment' && session.selectedAppointmentForReview && session.reviewRating) {
        await this.handleReviewComment(ctx, ctx.message.text);
        return;
      }
      const text = ctx.message.text;
      // Игнорируем команды и кнопки меню
      if (text.startsWith('/') || 
          ['📅 Записаться', '📋 Мои записи', '💆 Услуги', '👤 Профиль', 'ℹ️ Помощь'].includes(text)) {
        return;
      }
      
      // Отвечаем на неизвестные сообщения
      const keyboard = Markup.keyboard([
        [Markup.button.text('📅 Записаться'), Markup.button.text('📋 Мои записи')],
        [Markup.button.text('💆 Услуги'), Markup.button.text('👤 Профиль')],
        [Markup.button.text('ℹ️ Помощь')],
      ])
        .resize()
        .persistent();

      await ctx.reply(
        'Я не понимаю эту команду. Используйте /help для списка доступных команд.',
        keyboard,
      );
    });
  }

  private setupGroupHandlers() {
    // Обработка добавления бота в группу/чат
    this.bot.on('new_chat_members', async (ctx) => {
      const chat = ctx.chat;
      const newMembers = ctx.message.new_chat_members || [];
      
      // Проверяем, был ли добавлен сам бот
      const botInfo = await this.bot.telegram.getMe();
      const botAdded = newMembers.some(member => member.id === botInfo.id);
      
      if (botAdded) {
        this.logger.log(`Бот добавлен в ${chat.type === 'group' ? 'группу' : chat.type === 'supergroup' ? 'супергруппу' : 'чат'}: ${chat.id}`);
        
        // Сохраняем информацию о чате в базу данных
        try {
          await this.saveChatInfo(chat);
        } catch (error: any) {
          this.logger.error(`Ошибка при сохранении информации о чате: ${error.message}`);
        }
      }
      
      // Отправляем приветственное сообщение каждому новому участнику (кроме бота) индивидуально
      for (const member of newMembers) {
        if (member.id !== botInfo.id) {
          this.logger.debug(`Новый участник добавлен в чат ${chat.id}: ${member.first_name}`);
          
          // Отправляем приветственное сообщение индивидуально через личные сообщения
          try {
            await this.sendWelcomeMessageToNewMember(member.id, chat);
          } catch (error: any) {
            this.logger.error(`Ошибка при отправке приветственного сообщения пользователю ${member.id}: ${error.message}`);
          }
        }
      }
    });
    
    // Обработка удаления участника из группы
    this.bot.on('left_chat_member', async (ctx) => {
      const chat = ctx.chat;
      const leftMember = ctx.message.left_chat_member;
      const botInfo = await this.bot.telegram.getMe();
      
      // Проверяем, был ли удален сам бот
      if (leftMember.id === botInfo.id) {
        this.logger.log(`Бот удален из ${chat.type === 'group' ? 'группы' : chat.type === 'supergroup' ? 'супергруппы' : 'чата'}: ${chat.id}`);
        
        // Обновляем статус чата в базе данных
        try {
          const chatRecord = await this.telegramChatRepository.findOne({
            where: { chatId: chat.id.toString() },
          });
          
          if (chatRecord) {
            chatRecord.isActive = false;
            await this.telegramChatRepository.save(chatRecord);
          }
        } catch (error: any) {
          this.logger.error(`Ошибка при обновлении статуса чата: ${error.message}`);
        }
      }
    });
    
    // Обработка изменения информации о чате
    this.bot.on('new_chat_title', async (ctx) => {
      this.logger.log(`Название чата изменено: ${ctx.message.new_chat_title}`);
      
      // Обновляем название чата в базе данных
      try {
        const chatRecord = await this.telegramChatRepository.findOne({
          where: { chatId: ctx.chat.id.toString() },
        });
        
        if (chatRecord) {
          chatRecord.title = ctx.message.new_chat_title;
          await this.telegramChatRepository.save(chatRecord);
        }
      } catch (error: any) {
        this.logger.error(`Ошибка при обновлении названия чата: ${error.message}`);
      }
    });
    
    this.bot.on('new_chat_photo', async (ctx) => {
      this.logger.log(`Фото чата изменено`);
      
      // Обновляем фото чата в базе данных
      try {
        const chatInfo = await this.bot.telegram.getChat(ctx.chat.id);
        const chatRecord = await this.telegramChatRepository.findOne({
          where: { chatId: ctx.chat.id.toString() },
        });
        
        if (chatRecord && (chatInfo as any).photo) {
          const fileId = (chatInfo as any).photo.small_file_id;
          const file = await this.bot.telegram.getFile(fileId);
          chatRecord.photoUrl = `https://api.telegram.org/file/bot${this.configService.get('TELEGRAM_BOT_TOKEN')}/${file.file_path}`;
          await this.telegramChatRepository.save(chatRecord);
        }
      } catch (error: any) {
        this.logger.error(`Ошибка при обновлении фото чата: ${error.message}`);
      }
    });
    
    this.bot.on('delete_chat_photo', async (ctx) => {
      this.logger.log(`Фото чата удалено`);
      
      // Обновляем фото чата в базе данных
      try {
        const chatRecord = await this.telegramChatRepository.findOne({
          where: { chatId: ctx.chat.id.toString() },
        });
        
        if (chatRecord) {
          chatRecord.photoUrl = null;
          await this.telegramChatRepository.save(chatRecord);
        }
      } catch (error: any) {
        this.logger.error(`Ошибка при обновлении фото чата: ${error.message}`);
      }
    });
    
    // Обработка закрепленных сообщений
    this.bot.on('pinned_message', async (ctx) => {
      this.logger.log(`Сообщение закреплено в чате ${ctx.chat.id}`);
    });
  }

  private async saveChatInfo(chat: any) {
    try {
      // Получаем полную информацию о чате
      const chatInfo = await this.bot.telegram.getChat(chat.id);
      
      // Определяем тип чата
      let chatType: ChatType;
      switch (chat.type) {
        case 'group':
          chatType = ChatType.GROUP;
          break;
        case 'supergroup':
          chatType = ChatType.SUPERGROUP;
          break;
        case 'channel':
          chatType = ChatType.CHANNEL;
          break;
        default:
          chatType = ChatType.PRIVATE;
      }
      
      // Проверяем, существует ли уже запись о чате
      let chatRecord = await this.telegramChatRepository.findOne({
        where: { chatId: chat.id.toString() },
      });
      
      if (!chatRecord) {
        // Создаем новую запись
        chatRecord = this.telegramChatRepository.create({
          chatId: chat.id.toString(),
          type: chatType,
          title: (chatInfo as any).title || chat.title || null,
          username: (chatInfo as any).username || chat.username || null,
          description: (chatInfo as any).description || null,
          photoUrl: null,
          membersCount: (() => {
            const totalMembers = (chatInfo as any).members_count || null;
            // Вычитаем бота из общего количества участников для групп и супергрупп
            if (chatType === ChatType.GROUP || chatType === ChatType.SUPERGROUP) {
              return totalMembers ? Math.max(0, totalMembers - 1) : null;
            }
            return totalMembers;
          })(),
          isActive: true,
          metadata: {
            first_name: (chatInfo as any).first_name || null,
            last_name: (chatInfo as any).last_name || null,
          },
        });
      } else {
        // Обновляем существующую запись
        chatRecord.type = chatType;
        chatRecord.title = (chatInfo as any).title || chat.title || chatRecord.title;
        chatRecord.username = (chatInfo as any).username || chat.username || chatRecord.username;
        chatRecord.description = (chatInfo as any).description || chatRecord.description;
          const totalMembers = (chatInfo as any).members_count || chatRecord.membersCount || 0;
          // Вычитаем бота из общего количества участников для групп и супергрупп
          if (chatType === ChatType.GROUP || chatType === ChatType.SUPERGROUP) {
            chatRecord.membersCount = Math.max(0, totalMembers - 1);
          } else {
            chatRecord.membersCount = totalMembers;
          }
        chatRecord.isActive = true;
      }
      
      // Получаем фото чата, если есть
      if ((chatInfo as any).photo) {
        try {
          const fileId = (chatInfo as any).photo.small_file_id;
          const file = await this.bot.telegram.getFile(fileId);
          chatRecord.photoUrl = `https://api.telegram.org/file/bot${this.configService.get('TELEGRAM_BOT_TOKEN')}/${file.file_path}`;
        } catch (error: any) {
          this.logger.warn(`Не удалось получить фото чата: ${error.message}`);
        }
      }
      
      await this.telegramChatRepository.save(chatRecord);
      this.logger.log(`Информация о чате ${chat.id} сохранена в базу данных`);
    } catch (error: any) {
      this.logger.error(`Ошибка при сохранении информации о чате: ${error.message}`);
      throw error;
    }
  }

  private setupContactHandler() {
    // Обработка получения контакта от пользователя
    this.bot.on('contact', async (ctx) => {
      const contact = ctx.message.contact;
      const telegramId = ctx.from.id.toString();

      this.logger.log(`Получен контакт от пользователя ${telegramId}: ${contact.phone_number}`);

      // Проверяем, что контакт принадлежит отправителю
      if (contact.user_id && contact.user_id.toString() !== telegramId) {
        await ctx.reply('Пожалуйста, поделитесь своим контактом, а не контактом другого человека.');
        return;
      }

      // Нормализуем номер телефона
      const normalizedPhone = this.usersService.normalizePhone(contact.phone_number);

      // Находим пользователя по Telegram ID
      let user = await this.usersService.findByTelegramId(telegramId);
      
      // Ищем пользователя по номеру телефона
      const userByPhone = await this.usersService.findByPhone(normalizedPhone);
      
      if (!user && !userByPhone) {
        // Создаем нового пользователя
        user = this.userRepository.create({
          telegramId,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          phone: normalizedPhone,
          role: 'client' as any,
        });
      } else if (user && userByPhone && user.id !== userByPhone.id) {
        // Объединяем данные: пользователь с Telegram ID существует, но есть другой пользователь с таким же телефоном
        // Объединяем данные: обновляем существующего пользователя с телефоном данными из Telegram
        userByPhone.telegramId = telegramId;
        userByPhone.firstName = ctx.from.first_name || userByPhone.firstName;
        userByPhone.lastName = ctx.from.last_name || userByPhone.lastName;
        userByPhone.username = ctx.from.username || userByPhone.username;
        
        // Удаляем дубликат пользователя с Telegram ID (если он был создан ранее)
        await this.userRepository.remove(user);
        user = userByPhone;
      } else if (user && !userByPhone) {
        // Пользователь с Telegram ID существует, но нет пользователя с таким телефоном
        // Обновляем телефон
        user.phone = normalizedPhone;
        user.firstName = ctx.from.first_name || user.firstName;
        user.lastName = ctx.from.last_name || user.lastName;
        user.username = ctx.from.username || user.username;
      } else if (!user && userByPhone) {
        // Пользователь с телефоном существует, но нет пользователя с Telegram ID
        // Объединяем: добавляем Telegram ID к существующему пользователю
        userByPhone.telegramId = telegramId;
        userByPhone.firstName = ctx.from.first_name || userByPhone.firstName;
        userByPhone.lastName = ctx.from.last_name || userByPhone.lastName;
        userByPhone.username = ctx.from.username || userByPhone.username;
        user = userByPhone;
      } else {
        // Оба пользователя существуют и это один и тот же пользователь
        user.phone = normalizedPhone;
        user.firstName = ctx.from.first_name || user.firstName;
        user.lastName = ctx.from.last_name || user.lastName;
        user.username = ctx.from.username || user.username;
      }

      await this.userRepository.save(user);

      // Отправляем приветственное сообщение с клавиатурой
      const keyboard = Markup.keyboard([
        [Markup.button.text('📅 Записаться'), Markup.button.text('📋 Мои записи')],
        [Markup.button.text('💆 Услуги'), Markup.button.text('👤 Профиль')],
        [Markup.button.text('ℹ️ Помощь')],
      ])
        .resize()
        .persistent()
        .oneTime(false);

      await ctx.reply(
        `✅ Спасибо! Ваш номер телефона сохранен: ${normalizedPhone}\n\n` +
        `Теперь вы можете записаться на массаж. Используйте кнопки ниже:`,
        keyboard,
      );

      this.logger.log(`Контакт пользователя ${telegramId} сохранен: ${contact.phone_number}`);
    });
  }

  private setupCommands() {
    // Команда /start - должна быть первой и иметь приоритет
    this.bot.command('start', async (ctx) => {
      this.logger.debug(`Команда /start получена от пользователя ${ctx.from.id} в чате ${ctx.chat.type}`);
      
      const telegramId = ctx.from.id.toString();
      let user = await this.usersService.findByTelegramId(telegramId);

      if (!user) {
        // Создание нового пользователя
        this.logger.debug(`Создание нового пользователя ${telegramId}`);
        user = this.userRepository.create({
          telegramId,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          username: ctx.from.username,
          role: 'client' as any,
        });
        await this.userRepository.save(user);
      }

      // Определяем контекст чата
      const isGroup = this.isGroupChat(ctx.chat);

      // В групповом чате показываем упрощенное меню с inline-кнопками (приватно)
      if (isGroup) {
        const botInfo = await this.bot.telegram.getMe();
        const botUsername = botInfo.username;
        const keyboard = Markup.inlineKeyboard([
          [{ text: '📅 Записаться', switch_inline_query: 'book' }],
          [{ text: '📋 Мои записи', switch_inline_query: 'appointments' }],
          [Markup.button.url('💬 Перейти в личный чат', `https://t.me/${botUsername}?start=group_${ctx.chat.id}`)],
        ]);

        // Загружаем настраиваемое сообщение для /start
        const customStartMessage = await this.settingsService.get('telegramStartMessage', null);
        let groupMessage = customStartMessage || 
          `👋 Привет, ${ctx.from.first_name}!\n\n` +
          `Я бот салона красоты "Афродита". Для работы со мной используйте кнопки ниже или перейдите в личный чат.`;

        // Заменяем переменные в сообщении
        if (customStartMessage) {
          groupMessage = this.replaceMessageVariables(groupMessage, user, ctx.chat);
        }

        // Отправляем приватно через sendPrivateReply
        await this.sendPrivateReply(ctx, groupMessage, { 
          reply_markup: keyboard.reply_markup,
        });
        return;
      }

      // В личном чате показываем полное меню
      // Загружаем настраиваемое сообщение для /start
      const customStartMessage = await this.settingsService.get('telegramStartMessage', null);
      
      // Если у пользователя нет телефона, запрашиваем контакт
      if (!user.phone) {
        const contactKeyboard = Markup.keyboard([
          [Markup.button.contactRequest('📱 Поделиться контактом')],
        ])
          .resize()
          .oneTime(true);

        let startMessage = customStartMessage || 
          `Привет, ${ctx.from.first_name}! 👋\n\n` +
          `Для записи на массаж нам нужен ваш номер телефона.\n\n` +
          `Пожалуйста, поделитесь контактом, нажав кнопку ниже:`;
        
        // Заменяем переменные в сообщении
        if (customStartMessage) {
          startMessage = this.replaceMessageVariables(startMessage, user, ctx.chat);
        }
        
        const parseMode = this.detectParseMode(startMessage);
        await ctx.reply(startMessage, { 
          ...contactKeyboard,
          parse_mode: parseMode,
        });
        return;
      }

      // Создаем reply клавиатуру для личного чата
      const keyboard = this.getPrivateChatMenuKeyboard();

      let welcomeMessage = customStartMessage || 
        `Добро пожаловать в массажный салон Афродита! 👋\n\n` +
        `Привет, ${ctx.from.first_name}! Я помогу вам записаться на массаж.\n\n` +
        `Используйте кнопки ниже или команды для навигации.`;

      // Заменяем переменные в сообщении
      if (customStartMessage) {
        welcomeMessage = this.replaceMessageVariables(welcomeMessage, user, ctx.chat);
      }

      try {
        const parseMode = this.detectParseMode(welcomeMessage);
        await ctx.reply(welcomeMessage, { 
          ...keyboard,
          parse_mode: parseMode,
        });
        this.logger.log(`✅ Команда /start обработана, клавиатура отправлена пользователю ${ctx.from.id}`);
      } catch (error: any) {
        this.logger.error(`❌ Ошибка при отправке клавиатуры: ${error.message}`, error.stack);
        // Fallback - отправка без клавиатуры
        await ctx.reply(
          welcomeMessage + `\n\nИспользуйте команды: /book, /appointments, /services, /profile`,
        );
      }
    });

    // Команда /help
    this.bot.command('help', async (ctx) => {
      const isGroup = this.isGroupChat(ctx.chat);
      
      let helpText = `
📖 *Доступные команды:*

/start - Главное меню
/help - Справка
/book - Записаться на услугу
/appointments - Мои записи
/services - Список услуг
/profile - Мой профиль
/reschedule - Перенести запись
/cancel - Отменить запись
      `;

      // В группах добавляем информацию о публичных командах
      if (isGroup) {
        const settings = await this.getGroupSettings(ctx.chat.id.toString());
        helpText += `\n\n📢 *Публичные команды (работают в группах):*\n`;
        
        if (settings.enabledCommands.schedule !== false) {
          helpText += `/schedule - Свободные слоты на сегодня/завтра\n`;
        }
        if (settings.enabledCommands.masters !== false) {
          helpText += `/masters - Информация о мастерах\n`;
        }
        if (settings.enabledCommands.promotions !== false) {
          helpText += `/promotions - Акции и скидки\n`;
        }
        if (settings.enabledCommands.faq !== false) {
          helpText += `/faq - Часто задаваемые вопросы\n`;
        }
      }

      helpText += `\n💡 *Совет:* Используйте кнопки меню для быстрого доступа к функциям.`;

      if (isGroup) {
        await ctx.reply(helpText, { parse_mode: 'Markdown' });
      } else {
        await this.sendPrivateReply(ctx, helpText, { parse_mode: 'Markdown' });
      }
    });

    // Команда /book - запись
    this.bot.command('book', async (ctx) => {
      await this.showServices(ctx);
    });

    // Команда /appointments - мои записи
    this.bot.command('appointments', async (ctx) => {
      await this.showAppointments(ctx);
    });

    // Команда /services - услуги
    this.bot.command('services', async (ctx) => {
      await this.showServices(ctx);
    });

    // Команда /profile - профиль
    this.bot.command('profile', async (ctx) => {
      await this.showProfile(ctx);
    });

    // Команда /bonus - баланс бонусов с детальной информацией
    this.bot.command('bonus', async (ctx) => {
      await this.showBonusInfo(ctx);
    });

    // Команда /cancel - отмена записи или отмена текущей операции
    this.bot.command('cancel', async (ctx) => {
      const session = this.getSession(ctx.from.id);
      
      // Если есть активная операция (например, рассылка), отменяем её
      if (session.step && session.step.startsWith('broadcast:')) {
        session.step = undefined;
        session.broadcastMessage = undefined;
        await ctx.reply('❌ Операция отменена.');
        return;
      }
      
      // Иначе показываем записи для отмены
      await this.showAppointmentsForCancellation(ctx);
    });

    // Команда /reschedule - перенос записи
    this.bot.command('reschedule', async (ctx) => {
      await this.showAppointmentsForReschedule(ctx);
    });

    // Обработка текстовых команд через кнопки
    this.bot.hears('📅 Записаться', async (ctx) => {
      if (this.isGroupChat(ctx.chat)) {
        await this.sendPrivateReply(ctx, '❌ Эта команда доступна только в личном чате. Используйте кнопку "Перейти в личный чат" или напишите мне в личные сообщения.');
        return;
      }
      await this.showServices(ctx);
    });

    this.bot.hears('📋 Мои записи', async (ctx) => {
      if (this.isGroupChat(ctx.chat)) {
        await this.sendPrivateReply(ctx, '❌ Эта команда доступна только в личном чате. Используйте кнопку "Перейти в личный чат" или напишите мне в личные сообщения.');
        return;
      }
      await this.showAppointments(ctx);
    });

    this.bot.hears('💆 Услуги', async (ctx) => {
      if (this.isGroupChat(ctx.chat)) {
        await this.sendPrivateReply(ctx, '❌ Эта команда доступна только в личном чате. Используйте кнопку "Перейти в личный чат" или напишите мне в личные сообщения.');
        return;
      }
      await this.showServices(ctx);
    });

    this.bot.hears('👤 Профиль', async (ctx) => {
      if (this.isGroupChat(ctx.chat)) {
        await this.sendPrivateReply(ctx, '❌ Эта команда доступна только в личном чате. Используйте кнопку "Перейти в личный чат" или напишите мне в личные сообщения.');
        return;
      }
      await this.showProfile(ctx);
    });

    this.bot.hears('ℹ️ Помощь', async (ctx) => {
      await this.sendPrivateReply(ctx, 'Используйте команду /help для получения справки');
    });

    // ========== Админские команды ==========
    
    // Команда /admin - админская панель (только для админов)
    this.bot.command('admin', async (ctx) => {
      await this.handleAdminCommand(ctx);
    });

    // Команда /stats - статистика бота (только для админов)
    this.bot.command('stats', async (ctx) => {
      await this.handleStatsCommand(ctx);
    });

    // Команда /broadcast - массовая рассылка (только для админов)
    this.bot.command('broadcast', async (ctx) => {
      await this.handleBroadcastCommand(ctx);
    });

    // ========== Публичные команды для групп ==========
    
    // Команда /schedule - показать свободные слоты (работает в группах)
    this.bot.command('schedule', async (ctx) => {
      await this.handleScheduleCommand(ctx);
    });

    // Команда /masters - показать информацию о мастерах (работает в группах)
    this.bot.command('masters', async (ctx) => {
      await this.handleMastersCommand(ctx);
    });

    // Команда /promotions - показать акции и скидки (работает в группах)
    this.bot.command('promotions', async (ctx) => {
      await this.handlePromotionsCommand(ctx);
    });

    // Команда /faq - ответы на частые вопросы (работает в группах)
    this.bot.command('faq', async (ctx) => {
      await this.handleFaqCommand(ctx);
    });
  }

  // Проверка, является ли пользователь админом
  private async isAdmin(telegramId: string): Promise<boolean> {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      return user?.role === 'admin';
    } catch (error) {
      return false;
    }
  }

  // Обработка админской команды
  private async handleAdminCommand(ctx: any) {
    const telegramId = ctx.from.id.toString();
    
    if (!(await this.isAdmin(telegramId))) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    const adminKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Статистика', 'admin:stats')],
      [Markup.button.callback('📢 Рассылка', 'admin:broadcast')],
      [Markup.button.callback('👥 Пользователи', 'admin:users')],
      [Markup.button.callback('📅 Записи', 'admin:appointments')],
      [Markup.button.callback('📋 Актуальные записи', 'admin:upcoming')],
    ]);

    await ctx.reply(
      '🔐 *Админская панель*\n\n' +
      'Выберите действие:',
      { parse_mode: 'Markdown', ...adminKeyboard },
    );
  }

  // Обработка команды статистики
  private async handleStatsCommand(ctx: any) {
    const telegramId = ctx.from.id.toString();
    
    if (!(await this.isAdmin(telegramId))) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    try {
      // Получаем статистику
      const totalUsers = await this.userRepository.count();
      const activeUsers = await this.userRepository.count({ where: { isActive: true } });
      const totalAppointments = await this.appointmentRepository.count();
      const pendingAppointments = await this.appointmentRepository.count({
        where: { status: AppointmentStatus.PENDING },
      });
      const confirmedAppointments = await this.appointmentRepository.count({
        where: { status: AppointmentStatus.CONFIRMED },
      });
      const totalServices = await this.serviceRepository.count({ where: { isActive: true } });
      const totalMasters = await this.masterRepository.count({ where: { isActive: true } });

      const statsMessage = 
        `📊 *Статистика бота*\n\n` +
        `👥 *Пользователи:*\n` +
        `   Всего: ${totalUsers}\n` +
        `   Активных: ${activeUsers}\n\n` +
        `📅 *Записи:*\n` +
        `   Всего: ${totalAppointments}\n` +
        `   Ожидают: ${pendingAppointments}\n` +
        `   Подтверждены: ${confirmedAppointments}\n\n` +
        `💆 *Услуги:* ${totalServices}\n` +
        `👤 *Мастера:* ${totalMasters}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад', 'admin:menu')],
      ]);

      await ctx.reply(statsMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при получении статистики: ${error.message}`);
      await ctx.reply('❌ Ошибка при получении статистики.');
    }
  }

  // Обработка команды рассылки
  private async handleBroadcastCommand(ctx: any) {
    const telegramId = ctx.from.id.toString();
    
    if (!(await this.isAdmin(telegramId))) {
      await ctx.reply('❌ У вас нет прав для выполнения этой команды.');
      return;
    }

    // Сохраняем состояние для рассылки
    const session = this.getSession(ctx.from.id);
    session.step = 'broadcast:message';
    this.sessions.set(ctx.from.id, session);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Назад', 'admin:menu')],
    ]);

    await ctx.reply(
      '📢 *Массовая рассылка*\n\n' +
      'Отправьте сообщение, которое хотите разослать всем пользователям.\n\n' +
      'Используйте /cancel для отмены.',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      },
    );
  }

  // Обработка сообщения для рассылки
  private async handleBroadcastMessage(ctx: any) {
    const message = ctx.message.text;
    const session = this.getSession(ctx.from.id);
    
    // Сохраняем сообщение и запрашиваем подтверждение
    session.broadcastMessage = message;
    session.step = 'broadcast:confirm';
    
    // Получаем количество пользователей для рассылки
    const totalUsers = await this.userRepository.count({
      where: { isActive: true, telegramId: Not(null) },
    });

    await ctx.reply(
      `📢 *Подтверждение рассылки*\n\n` +
      `Сообщение:\n${message}\n\n` +
      `Будет отправлено ${totalUsers} пользователям.\n\n` +
      `Отправьте "да" для подтверждения или любое другое сообщение для отмены.`,
      { parse_mode: 'Markdown' },
    );
  }

  // Выполнение рассылки
  private async executeBroadcast(ctx: any, message: string) {
    try {
      await ctx.reply('⏳ Начинаю рассылку...');
      
      // Проверяем, что NotificationsService доступен
      if (!this.notificationsService) {
        this.logger.error('NotificationsService не доступен');
        await ctx.reply('❌ Ошибка: сервис уведомлений недоступен.');
        return;
      }
      
      // Используем NotificationsService для сохранения истории рассылки
      const result = await this.notificationsService.sendBroadcast(
        'Рассылка через Telegram бота',
        message,
        NotificationChannel.TELEGRAM,
        {
          role: undefined, // Рассылка всем пользователям с Telegram ID
        },
      );

      // Очищаем сессию
      const session = this.getSession(ctx.from.id);
      session.step = undefined;
      session.broadcastMessage = undefined;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад', 'admin:menu')],
      ]);

      await ctx.reply(
        `✅ *Рассылка завершена*\n\n` +
        `Всего: ${result.total}\n` +
        `Успешно: ${result.sent}\n` +
        `Ошибок: ${result.failed}`,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        },
      );
    } catch (error: any) {
      this.logger.error(`Ошибка при выполнении рассылки: ${error.message}`, error.stack);
      await ctx.reply('❌ Ошибка при выполнении рассылки.');
    }
  }

  // Обработка админских функций - пользователи
  private async handleAdminUsers(ctx: any) {
    const telegramId = ctx.from.id.toString();
    
    if (!(await this.isAdmin(telegramId))) {
      await ctx.answerCbQuery('Нет прав');
      return;
    }

    try {
      const totalUsers = await this.userRepository.count();
      const activeUsers = await this.userRepository.count({ where: { isActive: true } });
      const clients = await this.userRepository.count({ where: { role: UserRole.CLIENT } });
      const admins = await this.userRepository.count({ where: { role: UserRole.ADMIN } });
      const masters = await this.userRepository.count({ where: { role: UserRole.MASTER } });

      const message = 
        `👥 *Пользователи*\n\n` +
        `Всего: ${totalUsers}\n` +
        `Активных: ${activeUsers}\n\n` +
        `По ролям:\n` +
        `   Клиенты: ${clients}\n` +
        `   Админы: ${admins}\n` +
        `   Мастера: ${masters}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад', 'admin:menu')],
      ]);

      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при получении информации о пользователях: ${error.message}`);
      await ctx.answerCbQuery('Ошибка');
    }
  }

  // Обработка админских функций - записи
  private async handleAdminAppointments(ctx: any) {
    const telegramId = ctx.from.id.toString();
    
    if (!(await this.isAdmin(telegramId))) {
      await ctx.answerCbQuery('Нет прав');
      return;
    }

    try {
      const total = await this.appointmentRepository.count();
      const pending = await this.appointmentRepository.count({
        where: { status: AppointmentStatus.PENDING },
      });
      const confirmed = await this.appointmentRepository.count({
        where: { status: AppointmentStatus.CONFIRMED },
      });
      const completed = await this.appointmentRepository.count({
        where: { status: AppointmentStatus.COMPLETED },
      });
      const cancelled = await this.appointmentRepository.count({
        where: { status: AppointmentStatus.CANCELLED },
      });

      const message = 
        `📅 *Записи*\n\n` +
        `Всего: ${total}\n\n` +
        `По статусам:\n` +
        `   Ожидают: ${pending}\n` +
        `   Подтверждены: ${confirmed}\n` +
        `   Завершены: ${completed}\n` +
        `   Отменены: ${cancelled}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Актуальные записи', 'admin:upcoming')],
        [Markup.button.callback('◀️ Назад', 'admin:menu')],
      ]);

      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при получении информации о записях: ${error.message}`);
      await ctx.answerCbQuery('Ошибка');
    }
  }

  /**
   * Обработка inline-запросов (для switch_inline_query кнопок)
   */
  private setupInlineQuery() {
    this.bot.on('inline_query', async (ctx) => {
      const query = ctx.inlineQuery.query.toLowerCase();

      try {
        // Если запрос пустой или "book", показываем услуги
        if (!query || query === 'book' || query.startsWith('book')) {
          const services = await this.servicesService.findServicesForBot(true);
          const mainServices = services.filter(s => !s.parentServiceId && s.isActive);

          const results = mainServices.slice(0, 10).map((service, index) => ({
            type: 'article' as const,
            id: `service_${service.id}_${index}`,
            title: service.name,
            description: `${service.price}₽ • ${service.duration} мин`,
            input_message_content: {
              message_text: `📅 Запись на услугу: ${service.name}\n\n` +
                `💰 Цена: ${service.price}₽\n` +
                `⏱ Длительность: ${service.duration} минут\n\n` +
                `Используйте /book для записи.`,
            },
            reply_markup: {
              inline_keyboard: [[
                { text: '📅 Записаться', url: `https://t.me/${ctx.botInfo.username}?start=book` }
              ]]
            }
          }));

          await ctx.answerInlineQuery(results, {
            cache_time: 300,
          });
          return;
        }

        // Если запрос "appointments", показываем информацию о записях
        if (query === 'appointments' || query.startsWith('appointments')) {
          const telegramId = ctx.from.id.toString();
          const user = await this.usersService.findByTelegramId(telegramId);

          if (user) {
            const appointments = await this.appointmentsService.findAll(user.id);
            const upcoming = appointments
              .filter(apt => 
                apt.status === AppointmentStatus.CONFIRMED || 
                apt.status === AppointmentStatus.PENDING
              )
              .slice(0, 5);

            if (upcoming.length > 0) {
              // Получаем таймзону из настроек для правильного отображения времени
              const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
              
              const results = upcoming.map((apt, index) => {
                const date = new Date(apt.startTime);
                return {
                  type: 'article' as const,
                  id: `appointment_${apt.id}_${index}`,
                  title: `${date.toLocaleDateString('ru-RU', { timeZone: timezone })} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}`,
                  description: `${(apt.service as any)?.name || 'Услуга'} • ${(apt.master as any)?.name || 'Мастер'}`,
                  input_message_content: {
                    message_text: `📋 Ваша запись:\n\n` +
                      `📅 ${date.toLocaleString('ru-RU', { timeZone: timezone })}\n` +
                      `💆 ${(apt.service as any)?.name || 'Услуга'}\n` +
                      `👤 ${(apt.master as any)?.name || 'Мастер'}\n\n` +
                      `Используйте /appointments для управления записями.`,
                  },
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '📋 Мои записи', url: `https://t.me/${ctx.botInfo.username}?start=appointments` }
                    ]]
                  }
                };
              });

              await ctx.answerInlineQuery(results, {
                cache_time: 60,
              });
              return;
            }
          }

          // Если нет записей, показываем сообщение
          await ctx.answerInlineQuery([{
            type: 'article' as const,
            id: 'no_appointments',
            title: 'Нет предстоящих записей',
            description: 'Используйте /book для записи',
            input_message_content: {
              message_text: 'У вас пока нет предстоящих записей.\n\nИспользуйте /book для записи на услугу.',
            },
            reply_markup: {
              inline_keyboard: [[
                { text: '📅 Записаться', url: `https://t.me/${ctx.botInfo.username}?start=book` }
              ]]
            }
          }], {
            cache_time: 60,
          });
          return;
        }

        // По умолчанию показываем услуги
        const services = await this.servicesService.findServicesForBot(true);
        const mainServices = services.filter(s => !s.parentServiceId && s.isActive);

        const results = mainServices
          .filter(s => s.name.toLowerCase().includes(query))
          .slice(0, 10)
          .map((service, index) => ({
            type: 'article' as const,
            id: `service_${service.id}_${index}`,
            title: service.name,
            description: `${service.price}₽ • ${service.duration} мин`,
            input_message_content: {
              message_text: `📅 Запись на услугу: ${service.name}\n\n` +
                `💰 Цена: ${service.price}₽\n` +
                `⏱ Длительность: ${service.duration} минут\n\n` +
                `Используйте /book для записи.`,
            },
            reply_markup: {
              inline_keyboard: [[
                { text: '📅 Записаться', url: `https://t.me/${ctx.botInfo.username}?start=book` }
              ]]
            }
          }));

        await ctx.answerInlineQuery(results.length > 0 ? results : [{
          type: 'article' as const,
          id: 'no_results',
          title: 'Ничего не найдено',
          description: 'Попробуйте другой запрос',
          input_message_content: {
            message_text: 'По вашему запросу ничего не найдено.\n\nИспользуйте /book для записи.',
          },
        }], {
          cache_time: 300,
        });
      } catch (error: any) {
        this.logger.error(`Ошибка при обработке inline-запроса: ${error.message}`, error.stack);
        await ctx.answerInlineQuery([], {
          cache_time: 0,
        });
      }
    });
  }

  private setupCallbacks() {
    // Обработка callback query для inline кнопок
    this.bot.on('callback_query', async (ctx) => {
      const data = (ctx.callbackQuery as any).data;
      const [action, ...params] = data.split(':');

      try {
        switch (action) {
          case 'service':
            if (params[0] === 'list') {
              await this.showServices(ctx);
            } else if (params[0] === 'select') {
              await this.handleServiceSelect(ctx, params[1]);
            } else {
              await this.handleServiceSelect(ctx, params[0]);
            }
            break;
          case 'subcategory':
            if (params[0] === 'toggle') {
              await this.handleSubcategoryToggle(ctx, params[1]);
            } else if (params[0] === 'confirm') {
              await this.handleSubcategoryConfirm(ctx);
            }
            break;
          case 'calendar':
            // Обработка пустых ячеек и заголовков (игнорируем)
            if (params[0] === 'empty' || params[0] === 'day' || params[0] === 'header') {
              await ctx.answerCbQuery(); // Просто подтверждаем нажатие без действия
              break;
            }
            // Обработка выбора даты - формат: calendar:year:month:day
            if (params.length >= 3) {
              await this.handleCalendarSelect(ctx, params[0], params[1], params[2]);
            } else {
              await ctx.answerCbQuery(); // Подтверждаем нажатие
            }
            break;
          case 'time':
            if (params[0] === 'back') {
              // Возврат к выбору даты
              const session = this.getSession(ctx.from!.id);
              if (session.selectedDate) {
                const date = new Date(session.selectedDate);
                await this.showCalendar(ctx, session.selectedServiceId!, session.selectedMasterId!, date.getFullYear(), date.getMonth());
              } else {
                await ctx.answerCbQuery('Ошибка: дата не выбрана');
              }
            } else {
              // params[0] теперь индекс слота
              await this.handleTimeSelect(ctx, params[0]);
            }
            break;
          case 'confirm':
            // Данные берутся из сессии
            await this.handleConfirmAppointment(ctx);
            break;
          case 'confirm_reschedule':
            // params[0] - appointmentId, timeIso в сессии
            await this.handleConfirmReschedule(ctx, params[0]);
            break;
          case 'cancel_appt':
            await this.handleCancelAppointment(ctx, params[0]);
            break;
          case 'reschedule':
            await this.handleRescheduleStart(ctx, params[0]);
            break;
          case 'reason':
            // Формат: reason:reason_type
            await this.handleRescheduleReasonSelect(ctx, params[0]);
            break;
          case 'review_rating':
            // Формат: review_rating:1-5
            await this.handleReviewRating(ctx, parseInt(params[0], 10));
            break;
          case 'review':
            // Формат: review:appointmentId
            await this.handleReviewRequest(ctx, params[0]);
            break;
          case 'calendar_nav':
            // Формат: calendar_nav:prev/next:year:month
            await this.handleCalendarNavigation(ctx, params[0], params[1], params[2]);
            break;
          case 'admin':
            if (params[0] === 'stats') {
              await this.handleStatsCommand(ctx);
            } else if (params[0] === 'broadcast') {
              await this.handleBroadcastCommand(ctx);
            } else if (params[0] === 'users') {
              await this.handleAdminUsers(ctx);
            } else if (params[0] === 'appointments') {
              await this.handleAdminAppointments(ctx);
            } else if (params[0] === 'upcoming') {
              await this.handleAdminUpcomingAppointments(ctx);
            } else if (params[0] === 'menu') {
              await this.handleAdminCommand(ctx);
            }
            await ctx.answerCbQuery();
            break;
          case 'master':
            if (params[0] === 'back') {
              // Возврат к выбору мастера
              const session = this.getSession(ctx.from!.id);
              if (session.selectedServiceId) {
                await this.handleServiceSelect(ctx, session.selectedServiceId);
              } else {
                await this.showServices(ctx);
              }
            } else {
              // params[0] теперь индекс мастера
              await this.handleMasterSelect(ctx, params[0]);
            }
            break;
          case 'appointments':
            if (params[0] === 'list') {
              await this.showAppointments(ctx);
            }
            break;
          case 'bonus':
            if (params[0] === 'history') {
              await this.showBonusHistory(ctx);
            } else if (params[0] === 'info') {
              await this.showBonusInfo(ctx);
            }
            break;
          case 'profile':
            if (params[0] === 'show') {
              await this.showProfile(ctx);
            }
            break;
          default:
            await ctx.answerCbQuery('Неизвестное действие');
        }
      } catch (error: any) {
        await ctx.answerCbQuery('Произошла ошибка. Попробуйте еще раз.');
        this.logger.error(`Ошибка в callback обработчике: ${error.message}`, error.stack);
      }
    });
  }

  // Показ списка основных услуг (без подкатегорий)
  private async showServices(ctx: Context) {
    try {
      // Получаем услуги для бота (самостоятельные + категории, без подкатегорий)
      const services = await this.servicesService.findServicesForBot(true);
      
      this.logger.log(`[showServices] Загружено услуг для бота: ${services.length}`);
      services.forEach((s) => {
        this.logger.log(`[showServices] - ${s.name} (isCategory: ${s.isCategory}, parentServiceId: ${s.parentServiceId})`);
      });
      
      if (services.length === 0) {
        await this.sendPrivateCallbackReply(ctx, 'К сожалению, услуги временно недоступны.');
        return;
      }

      // Фильтруем услуги: только самостоятельные услуги и категории (без подкатегорий)
      const filteredServices = services.filter((service) => {
        // Самостоятельная услуга: не категория и нет родителя
        const isMainService = !service.isCategory && !service.parentServiceId;
        // Категория: isCategory = true
        const isCategory = service.isCategory === true;
        return isMainService || isCategory;
      });

      this.logger.log(`[showServices] Отфильтровано услуг: ${filteredServices.length}`);

      const keyboard = Markup.inlineKeyboard([
        ...filteredServices.map((service) => [
          Markup.button.callback(
            // Для категорий показываем без цены и времени, с иконкой
            service.isCategory
              ? `📁 ${service.name}`
              : `${service.name} - ${service.price}₽ (${service.duration} мин)`,
            `service:select:${service.id}`,
          ),
        ]),
        [Markup.button.callback('❌ Отмена', 'cancel')],
      ]);

      const message = 'Выберите услугу:';

      await this.sendPrivateCallbackReply(ctx, message, keyboard);
    } catch (error) {
      this.logger.error(`Ошибка при показе услуг: ${error.message}`, error.stack);
      await this.sendPrivateCallbackReply(ctx, 'Произошла ошибка при загрузке услуг. Попробуйте позже.');
    }
  }

  // Показ подкатегорий для выбранной категории
  private async showSubcategories(ctx: Context, parentServiceId: string) {
    try {
      this.logger.log(`[showSubcategories] Загрузка подкатегорий для категории ${parentServiceId}`);
      
      const parentService = await this.servicesService.findById(parentServiceId);
      
      // Проверяем, что это действительно категория
      if (!parentService.isCategory) {
        this.logger.warn(`[showSubcategories] Услуга ${parentServiceId} не является категорией`);
        await ctx.answerCbQuery('Выбранная услуга не является категорией');
        return;
      }
      
      const subcategories = await this.servicesService.findSubcategories(parentServiceId);
      this.logger.log(`[showSubcategories] Найдено подкатегорий: ${subcategories.length}`);

      if (subcategories.length === 0) {
        // Если подкатегорий нет, показываем сообщение
        await ctx.answerCbQuery('У этой категории пока нет подкатегорий');
        return;
      }

      const session = this.getSession(ctx.from!.id);
      session.selectedServiceId = parentServiceId;
      if (!session.selectedSubcategoryIds) {
        session.selectedSubcategoryIds = [];
      }

      const allowMultiple = parentService.allowMultipleSubcategories || false;

      const keyboard = Markup.inlineKeyboard([
        ...subcategories.map((sub) => {
          const isSelected = session.selectedSubcategoryIds?.includes(sub.id);
          return [
            Markup.button.callback(
              `${isSelected ? '✅ ' : ''}${sub.name} - ${sub.price}₽ (${sub.duration} мин)`,
              `subcategory:toggle:${sub.id}`,
            ),
          ];
        }),
        [
          Markup.button.callback('✅ Продолжить', 'subcategory:confirm'),
          Markup.button.callback('◀️ Назад к услугам', 'service:list'),
        ],
      ]);

      const selectedCount = session.selectedSubcategoryIds?.length || 0;
      
      // Вычисляем суммарную цену и время для выбранных подкатегорий
      let totalPrice = 0;
      let totalDuration = 0;
      if (selectedCount > 0 && session.selectedSubcategoryIds) {
        for (const subId of session.selectedSubcategoryIds) {
          const sub = subcategories.find(s => s.id === subId);
          if (sub) {
            totalPrice += Number(sub.price);
            totalDuration += sub.duration;
          }
        }
      }
      
      let message = `*${parentService.name}*\n\n`;
      if (allowMultiple) {
        if (selectedCount > 0) {
          message += `Выбрано подкатегорий: *${selectedCount}*\n`;
          message += `💰 Общая стоимость: *${totalPrice}₽*\n`;
          message += `⏱ Общая длительность: *${totalDuration} мин*\n\n`;
          message += `Нажмите на подкатегорию еще раз, чтобы убрать из выбора.`;
        } else {
          message += 'Выберите подкатегории (можно выбрать несколько):';
        }
      } else {
        message += 'Выберите подкатегорию:';
      }

      await this.sendPrivateCallbackReply(ctx, message, keyboard, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error(`Ошибка при показе подкатегорий: ${error.message}`, error.stack);
      await this.sendPrivateCallbackReply(ctx, 'Произошла ошибка при загрузке подкатегорий. Попробуйте позже.');
    }
  }

  // Обработка переключения подкатегории
  private async handleSubcategoryToggle(ctx: Context, subcategoryId: string) {
    const session = this.getSession(ctx.from!.id);
    if (!session.selectedServiceId) {
      await ctx.answerCbQuery('Ошибка: основная услуга не выбрана');
      return;
    }

    const parentService = await this.servicesService.findById(session.selectedServiceId);
    const allowMultiple = parentService.allowMultipleSubcategories || false;

    if (!session.selectedSubcategoryIds) {
      session.selectedSubcategoryIds = [];
    }

    // Если множественный выбор не разрешен, заменяем выбор
    if (!allowMultiple) {
      session.selectedSubcategoryIds = [subcategoryId];
      await ctx.answerCbQuery();
      // Сразу переходим к выбору мастера
      await this.handleSubcategoryConfirm(ctx);
      return;
    }

    // Множественный выбор разрешен
    const index = session.selectedSubcategoryIds.indexOf(subcategoryId);
    if (index > -1) {
      session.selectedSubcategoryIds.splice(index, 1);
    } else {
      session.selectedSubcategoryIds.push(subcategoryId);
    }

    await ctx.answerCbQuery();
    await this.showSubcategories(ctx, session.selectedServiceId);
  }

  // Обработка подтверждения выбора подкатегорий
  private async handleSubcategoryConfirm(ctx: Context) {
    const session = this.getSession(ctx.from!.id);
    if (!session.selectedServiceId) {
      await ctx.answerCbQuery('Ошибка: основная услуга не выбрана');
      return;
    }

    const parentService = await this.servicesService.findById(session.selectedServiceId);
    const allowMultiple = parentService.allowMultipleSubcategories || false;

    if (!session.selectedSubcategoryIds || session.selectedSubcategoryIds.length === 0) {
      if (allowMultiple) {
        await ctx.answerCbQuery('Выберите хотя бы одну подкатегорию');
      } else {
        await ctx.answerCbQuery('Выберите подкатегорию');
      }
      return;
    }

    // Переходим к выбору мастера, используя первую подкатегорию для определения мастеров
    const subcategoryId = session.selectedSubcategoryIds[0];
    if (!subcategoryId) {
      await ctx.answerCbQuery('Ошибка: подкатегория не выбрана');
      return;
    }
    
    const subcategory = await this.servicesService.findById(subcategoryId);
    session.step = 'select_master';
    
    // Получаем мастеров для подкатегории
    let availableMasters: any[] = [];
    if (subcategory.masters && subcategory.masters.length > 0) {
      availableMasters = subcategory.masters.filter((master) => master.isActive);
    } else {
      const allMastersResult = await this.mastersService.findAll();
      availableMasters = allMastersResult.data || [];
    }

    if (availableMasters.length === 0) {
      await ctx.answerCbQuery('Нет доступных мастеров для этой услуги');
      return;
    }

    session.selectedMasterId = undefined;
    session.availableMasters = availableMasters.map((m) => ({ 
      id: m.id, 
      name: m.name,
      rating: m.rating || m.averageRating || '5.0'
    }));

      const keyboard = Markup.inlineKeyboard([
        ...availableMasters.map((master, index) => {
          const masterInfo = session.availableMasters?.[index];
          const rating = masterInfo?.rating || master.rating || master.averageRating || '5.0';
          return [
            Markup.button.callback(
              `${master.name} ⭐${rating}`,
              `master:${index}`,
            ),
          ];
        }),
        [Markup.button.callback('◀️ Назад к подкатегориям', `service:select:${session.selectedServiceId}`)],
      ]);

    const message = `Выберите мастера для услуги:\n${subcategory.name}`;

    try {
      await ctx.editMessageText(message, keyboard);
    } catch (error) {
      await ctx.reply(message, keyboard);
    }
    await ctx.answerCbQuery();
  }

  // Обработка выбора услуги (самостоятельной, категории или подкатегории)
  private async handleServiceSelect(ctx: Context, serviceId: string) {
    try {
      if (!serviceId) {
        await ctx.answerCbQuery('Неверный ID услуги');
        return;
      }

      const service = await this.servicesService.findById(serviceId);
      const session = this.getSession(ctx.from!.id);
      
      this.logger.log(`[handleServiceSelect] Выбрана услуга: ${service.name}, isCategory: ${service.isCategory}, parentServiceId: ${service.parentServiceId}`);
      
      // Если это категория, показываем подкатегории
      if (service.isCategory) {
        this.logger.log(`[handleServiceSelect] Это категория, показываем подкатегории для ${serviceId}`);
        await this.showSubcategories(ctx, serviceId);
        return;
      }
      
      // Если это самостоятельная услуга (не подкатегория), переходим к выбору мастера
      if (!service.parentServiceId) {
        session.selectedServiceId = serviceId;
        session.selectedSubcategoryIds = [];
      } else {
        // Это подкатегория - сохраняем родительскую категорию и выбранную подкатегорию
        session.selectedServiceId = service.parentServiceId;
        session.selectedSubcategoryIds = [serviceId];
      }

      session.step = 'select_master';

      // Получаем мастеров, которые предоставляют эту услугу
      // Сначала пытаемся получить мастеров через связь с услугой
      let availableMasters: any[] = [];
      
      if (service.masters && service.masters.length > 0) {
        // Используем мастеров, связанных с услугой
        availableMasters = service.masters.filter((master) => master.isActive);
      } else {
        // Если для услуги нет связанных мастеров, показываем всех активных мастеров
        // Это временное решение, пока не настроена связь мастер-услуга в админке
        const allMastersResult = await this.mastersService.findAll();
        availableMasters = allMastersResult.data || [];
      }

      if (availableMasters.length === 0) {
        await ctx.answerCbQuery('Нет доступных мастеров для этой услуги');
        return;
      }

      // Сохраняем список мастеров в сессии для использования индексов вместо UUID
      session.availableMasters = availableMasters.map((m) => ({ 
        id: m.id, 
        name: m.name,
        rating: m.rating || m.averageRating || '5.0'
      }));

      // Используем короткие индексы вместо UUID для callback_data (лимит Telegram: 64 байта)
      const keyboard = Markup.inlineKeyboard([
        ...availableMasters.map((master, index) => [
          Markup.button.callback(
            `${master.name} ⭐${master.rating || '5.0'}`,
            `master:${index}`, // Используем индекс вместо UUID
          ),
        ]),
        [Markup.button.callback('◀️ Назад к услугам', 'service:list')],
      ]);

      const message = `*${service.name}*\n\n` +
        `Описание: ${service.description || 'Описание отсутствует'}\n` +
        `Длительность: ${service.duration} минут\n` +
        `Цена: ${service.price}₽\n\n` +
        `Выберите мастера:`;

      await this.sendPrivateCallbackReply(ctx, message, keyboard, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error(`Ошибка при выборе услуги: ${error.message}`, error.stack);
      await ctx.answerCbQuery('Ошибка при загрузке услуги');
    }
  }

  // Обработка выбора мастера
  private async handleMasterSelect(ctx: Context, masterIndex: string) {
    const session = this.getSession(ctx.from!.id);
    
    if (!session.selectedServiceId) {
      await ctx.answerCbQuery('Ошибка: услуга не выбрана');
      return;
    }

    const index = parseInt(masterIndex, 10);
    if (!session.availableMasters || index < 0 || index >= session.availableMasters.length) {
      await ctx.answerCbQuery('Ошибка: неверный индекс мастера');
      return;
    }

    const masterId = session.availableMasters[index].id;
    const master = await this.mastersService.findById(masterId);
    session.selectedMasterId = masterId;
    session.step = 'select_date';

    // Показываем календарь
    const today = new Date();
    await this.showCalendar(ctx, session.selectedServiceId, masterId, today.getFullYear(), today.getMonth());
  }

  // Показать календарь
  private async showCalendar(
    ctx: Context,
    serviceId: string,
    masterId: string,
    year: number,
    month: number,
  ) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();

    const keyboard: any[] = [];
    // Сохраняем год и месяц в сессии для навигации
    const session = this.getSession(ctx.from!.id);
    
    const header = Markup.button.callback(
      `${this.getMonthName(month)} ${year}`,
      `calendar:header`, // Упрощенный callback_data
    );
    keyboard.push([header]);

    // Навигация по месяцам - используем только год и месяц (serviceId и masterId в сессии)
    const navRow = [
      Markup.button.callback('◀️', `calendar_nav:prev:${year}:${month}`),
      Markup.button.callback('▶️', `calendar_nav:next:${year}:${month}`),
    ];
    keyboard.push(navRow);

    // Дни недели
    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    keyboard.push(weekDays.map((day) => Markup.button.callback(day, 'calendar:day')));

    // Дни месяца
    const today = new Date();
    let currentRow: any[] = [];
    
    // Пустые ячейки до первого дня
    for (let i = 1; i < startDay; i++) {
      currentRow.push(Markup.button.callback(' ', 'calendar:empty'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isPast = date < today && date.toDateString() !== today.toDateString();
      const isToday = date.toDateString() === today.toDateString();

      if (isPast) {
        currentRow.push(Markup.button.callback(' ', 'calendar:empty'));
      } else {
        const label = isToday ? `[${day}]` : day.toString();
        // Используем только дату в callback_data (serviceId и masterId в сессии)
        currentRow.push(
          Markup.button.callback(
            label,
            `calendar:${year}:${month}:${day}`, // Упрощенный формат
          ),
        );
      }

      if (currentRow.length === 7 || day === daysInMonth) {
        keyboard.push(currentRow);
        currentRow = [];
      }
    }

    keyboard.push([Markup.button.callback('◀️ Назад', 'master:back')]);

    try {
      await ctx.editMessageText('Выберите дату:', Markup.inlineKeyboard(keyboard));
    } catch (error) {
      // Если не можем отредактировать, отправляем новое сообщение
      await ctx.reply('Выберите дату:', Markup.inlineKeyboard(keyboard));
    }
  }

  // Обработка навигации по календарю
  private async handleCalendarNavigation(
    ctx: Context,
    direction: string,
    year: string,
    month: string,
  ) {
    const session = this.getSession(ctx.from!.id);
    if (!session.selectedServiceId || !session.selectedMasterId) {
      await ctx.answerCbQuery('Ошибка: сессия не найдена');
      return;
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    let newYear = yearNum;
    let newMonth = monthNum;

    if (direction === 'prev') {
      newMonth--;
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
    } else {
      newMonth++;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
    }

    await this.showCalendar(ctx, session.selectedServiceId, session.selectedMasterId, newYear, newMonth);
    await ctx.answerCbQuery();
  }

  // Обработка выбора даты
  private async handleCalendarSelect(
    ctx: Context,
    year: string,
    month: string,
    day: string,
  ) {
    const session = this.getSession(ctx.from!.id);
    if (!session.selectedServiceId || !session.selectedMasterId) {
      await ctx.answerCbQuery('Ошибка: сессия не найдена');
      return;
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    
    if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
      await ctx.answerCbQuery('Неверный формат даты');
      return;
    }

    const selectedDate = new Date(yearNum, monthNum, dayNum);
    session.selectedDate = selectedDate.toISOString();

    // Получаем доступные слоты
    const slots = await this.appointmentsService.getAvailableSlots(
      session.selectedMasterId,
      session.selectedServiceId,
      selectedDate,
    );

    if (slots.length === 0) {
      await ctx.answerCbQuery('На эту дату нет свободных слотов');
      return;
    }

    // Получаем таймзону из настроек для правильного отображения времени
    const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
    
    // Группируем слоты по часам
    const timeSlots = slots.map((slot: Date) => {
      return {
        time: slot.toLocaleTimeString('ru-RU', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: timezone, // Используем таймзону из настроек
        }),
        iso: slot.toISOString(),
      };
    });

    // Используем индекс слота вместо полного ISO времени для экономии места
    const keyboard = Markup.inlineKeyboard([
      ...timeSlots.map((slot, index) => [
        Markup.button.callback(
          slot.time,
          `time:${index}`, // Используем индекс, ISO время храним в сессии
        ),
      ]),
      [
        Markup.button.callback(
          '◀️ Выбрать другую дату',
          'master:back',
        ),
      ],
    ]);
    
    // Сохраняем слоты в сессии для получения по индексу
    session.timeSlots = timeSlots.map(s => s.iso);

    // Форматируем дату правильно из selectedDate (используем реальную дату, а не парсированные значения)
    const formattedDate = selectedDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    try {
      await ctx.editMessageText(
        `Выберите время на ${formattedDate}:`,
        keyboard,
      );
    } catch (error) {
      await ctx.reply(
        `Выберите время на ${formattedDate}:`,
        keyboard,
      );
    }
    await ctx.answerCbQuery();
  }

  // Обработка выбора времени
  private async handleTimeSelect(
    ctx: Context,
    slotIndex: string,
  ) {
    const session = this.getSession(ctx.from!.id);
    
    if (!session.selectedServiceId || !session.selectedMasterId || !session.timeSlots) {
      await ctx.answerCbQuery('Ошибка: сессия не найдена');
      return;
    }

    const index = parseInt(slotIndex, 10);
    if (index < 0 || index >= session.timeSlots.length) {
      await ctx.answerCbQuery('Ошибка: неверный индекс слота');
      return;
    }

    const timeIso = session.timeSlots[index];
    session.selectedTime = timeIso;

    const master = await this.mastersService.findById(session.selectedMasterId);
    const date = new Date(timeIso);

    // Проверяем, является ли это переносом записи
    const isReschedule = session.step === 'reschedule_date' && session.selectedAppointmentId;
    
    // Получаем информацию об услугах (основная + подкатегории)
    const mainService = await this.servicesService.findById(session.selectedServiceId);
    let selectedServices: any[] = [];
    let totalPrice = 0;
    let totalDuration = 0;

    if (session.selectedSubcategoryIds && session.selectedSubcategoryIds.length > 0) {
      // Есть выбранные подкатегории
      for (const subId of session.selectedSubcategoryIds) {
        const subService = await this.servicesService.findById(subId);
        selectedServices.push(subService);
        totalPrice += Number(subService.price);
        totalDuration += subService.duration;
      }
    } else {
      // Нет подкатегорий, используем основную услугу
      selectedServices = [mainService];
      totalPrice = Number(mainService.price);
      totalDuration = mainService.duration;
    }

    // Проверяем, является ли это первым визитом пользователя
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);
    let isFirstVisit = false;
    let discountInfo = '';
    let finalPrice = totalPrice;

    if (user) {
      const existingAppointments = await this.appointmentsService.findAll(user.id);
      isFirstVisit = existingAppointments.length === 0;

      if (isFirstVisit) {
        // Получаем настройки скидки на первый визит
        const discountSettings = await this.settingsService.getFirstVisitDiscountSettings();
        
        if (discountSettings.enabled) {
          let discount = 0;
          if (discountSettings.type === 'percent') {
            discount = (totalPrice * discountSettings.value) / 100;
          } else {
            discount = discountSettings.value;
          }
          discount = Math.min(discount, totalPrice);
          finalPrice = totalPrice - discount;
          
          if (discount > 0) {
            discountInfo = `\n🎉 *Скидка на первый визит:* ${discountSettings.type === 'percent' ? `${discountSettings.value}%` : `${discount}₽`}\n` +
              `💰 *Итоговая стоимость:* ${finalPrice.toFixed(2)}₽ (было ${totalPrice}₽)`;
          }
        }
      }
    }
    
    // Используем короткие callback_data
    const confirmCallback = isReschedule
      ? `confirm_reschedule:${session.selectedAppointmentId}` // timeIso уже в сессии
      : `confirm`; // serviceId, masterId, timeIso уже в сессии

    const buttonText = isReschedule ? '✅ Подтвердить перенос' : '✅ Подтвердить запись';
    const messageTitle = isReschedule ? '*Подтверждение переноса записи*' : '*Подтверждение записи*';

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          buttonText,
          confirmCallback,
        ),
      ],
      [Markup.button.callback('◀️ Назад', 'time:back')],
    ]);

    // Получаем таймзону из настроек для правильного отображения времени
    const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
    
    // Форматируем дату и время правильно
    const dateStr = date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      timeZone: timezone, // Используем таймзону из настроек
    });
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: timezone, // Используем таймзону из настроек
    });
    
    // Формируем список услуг
    let servicesList = '';
    if (selectedServices.length === 1) {
      servicesList = selectedServices[0].name;
    } else {
      // Если выбрано несколько подкатегорий, показываем категорию и подкатегории
      servicesList = `${mainService.name}:\n` + 
        selectedServices.map(s => `  • ${s.name} - ${s.price}₽ (${s.duration} мин)`).join('\n') +
        `\n\n*Общая стоимость:* ${totalPrice}₽\n*Общая длительность:* ${totalDuration} мин`;
    }
    
    const message = `${messageTitle}\n\n` +
      `Услуга${selectedServices.length > 1 ? 'и' : ''}: ${servicesList}\n` +
      `Мастер: ${master.name}\n` +
      `Дата и время: ${dateStr} ${timeStr}\n` +
      `Стоимость: ${discountInfo ? `${finalPrice.toFixed(2)}₽` : `${totalPrice}₽`}${discountInfo ? '' : `\nДлительность: ${totalDuration} мин`}${discountInfo}${discountInfo ? `\nДлительность: ${totalDuration} мин` : ''}\n\n` +
      `${isReschedule ? 'Подтвердите перенос записи:' : 'Подтвердите запись:'}`;

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    } catch (error) {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      });
    }
    await ctx.answerCbQuery();
  }

  // Подтверждение записи
  private async handleConfirmAppointment(ctx: Context) {
    const session = this.getSession(ctx.from!.id);
    
    if (!session.selectedServiceId || !session.selectedMasterId || !session.selectedTime) {
      await ctx.answerCbQuery('Ошибка: данные не выбраны');
      return;
    }

    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден. Используйте /start');
      return;
    }

    try {
      // Получаем настройки подтверждения записей
      this.logger.log(`[handleConfirmAppointment] Загрузка настроек bookingSettings...`);
      const bookingSettings = await this.settingsService.getBookingSettings();
      this.logger.log(`[handleConfirmAppointment] Загружены настройки: ${JSON.stringify(bookingSettings)}`);
      
      const manualConfirmation = bookingSettings.manualConfirmation ?? false;
      this.logger.log(`[handleConfirmAppointment] Настройка manualConfirmation: ${manualConfirmation} (тип: ${typeof manualConfirmation})`);

      // Определяем, какие услуги нужно записать
      const mainService = await this.servicesService.findById(session.selectedServiceId);
      let servicesToBook: any[] = [];

      if (session.selectedSubcategoryIds && session.selectedSubcategoryIds.length > 0) {
        // Есть выбранные подкатегории - создаем запись для каждой
        for (const subId of session.selectedSubcategoryIds) {
          const subService = await this.servicesService.findById(subId);
          servicesToBook.push(subService);
        }
      } else {
        // Нет подкатегорий - используем основную услугу
        servicesToBook = [mainService];
      }

      this.logger.log(`[handleConfirmAppointment] Создание ${servicesToBook.length} записи(ей) для пользователя ${user.id}...`);
      
      // Проверяем, является ли это первым визитом (для применения скидки к комплексу)
      // Используем прямой запрос к репозиторию для проверки количества записей
      const existingAppointmentsCount = await this.appointmentRepository.count({
        where: { clientId: user.id },
      });
      const isFirstVisit = existingAppointmentsCount === 0;
      
      // Рассчитываем скидку для комплекса услуг (если это первый визит и несколько услуг)
      let complexDiscount = 0;
      let totalComplexPrice = 0;
      
      if (isFirstVisit && servicesToBook.length > 1) {
        // Рассчитываем общую сумму комплекса
        totalComplexPrice = servicesToBook.reduce((sum, service) => sum + Number(service.price), 0);
        
        // Получаем настройки скидки
        const discountSettings = await this.settingsService.getFirstVisitDiscountSettings();
        
        if (discountSettings.enabled) {
          if (discountSettings.type === 'percent') {
            // Скидка в процентах от общей суммы комплекса
            complexDiscount = (totalComplexPrice * discountSettings.value) / 100;
          } else {
            // Скидка в рублях - фиксированная сумма для всего комплекса
            complexDiscount = discountSettings.value;
          }
          // Убеждаемся, что скидка не превышает общую сумму
          complexDiscount = Math.min(complexDiscount, totalComplexPrice);
        }
      }
      
      // Создаем записи для каждой услуги
      const appointments = [];
      let currentTime = new Date(session.selectedTime);

      for (let i = 0; i < servicesToBook.length; i++) {
        const service = servicesToBook[i];
        
        // Рассчитываем пропорциональную скидку для каждой услуги
        let serviceDiscount = 0;
        if (complexDiscount > 0 && totalComplexPrice > 0) {
          // Распределяем скидку пропорционально цене услуги
          const servicePriceRatio = Number(service.price) / totalComplexPrice;
          serviceDiscount = complexDiscount * servicePriceRatio;
        }
        
        const appointment = await this.appointmentsService.create(
          {
            masterId: session.selectedMasterId,
            serviceId: service.id,
            startTime: currentTime.toISOString(),
            notes: servicesToBook.length > 1 
              ? `Часть комплексной услуги "${mainService.name}". Выбрано подкатегорий: ${servicesToBook.length}`
              : undefined,
            discount: serviceDiscount > 0 ? serviceDiscount : undefined,
            totalComplexPrice: servicesToBook.length > 1 ? totalComplexPrice : undefined,
          },
          user.id,
        );
        appointments.push(appointment);
        
        // Для следующей услуги добавляем длительность текущей
        currentTime = new Date(currentTime.getTime() + service.duration * 60000);
      }

      this.logger.log(`[handleConfirmAppointment] Создано ${appointments.length} записи(ей)`);

      let finalAppointments = appointments;

      // Если ручное подтверждение выключено, автоматически подтверждаем все записи
      if (!manualConfirmation) {
        for (let i = 0; i < finalAppointments.length; i++) {
          const appointment = finalAppointments[i];
          if (appointment.status === AppointmentStatus.PENDING) {
            this.logger.log(`[handleConfirmAppointment] ✅ Автоматическое подтверждение записи ${appointment.id} (manualConfirmation=${manualConfirmation})`);
            finalAppointments[i] = await this.appointmentsService.confirm(appointment.id);
            this.logger.log(`[handleConfirmAppointment] Запись ${appointment.id} подтверждена, новый статус: ${finalAppointments[i].status}`);
          }
        }
      } else {
        this.logger.log(`[handleConfirmAppointment] ⏳ Записи остаются в статусе PENDING (manualConfirmation: ${manualConfirmation})`);
      }

      const firstAppointment = finalAppointments[0];

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои записи', 'appointments:list')],
        [Markup.button.callback('📅 Новая запись', 'service:list')],
      ]);

      // Определяем сообщение в зависимости от статуса
      const isConfirmed = firstAppointment.status === AppointmentStatus.CONFIRMED;
      const dateStr = new Date(firstAppointment.startTime).toLocaleString('ru-RU');
      
      let servicesList = '';
      if (servicesToBook.length === 1) {
        servicesList = servicesToBook[0].name;
      } else {
        servicesList = `${mainService.name}:\n` + 
          servicesToBook.map(s => `  • ${s.name}`).join('\n');
      }
      
      const successMessage = isConfirmed
        ? `✅ *Запись${finalAppointments.length > 1 ? 'и' : ''} успешно создана${finalAppointments.length > 1 ? 'ы' : ''} и подтверждена${finalAppointments.length > 1 ? 'ы' : ''} автоматически!*\n\n` +
          `Услуга${finalAppointments.length > 1 ? 'и' : ''}: ${servicesList}\n` +
          `Дата начала: ${dateStr}\n\n` +
          `Мы отправили вам уведомление с деталями.`
        : `⏳ *Запись${finalAppointments.length > 1 ? 'и' : ''} успешно создана${finalAppointments.length > 1 ? 'ы' : ''}!*\n\n` +
          `Услуга${finalAppointments.length > 1 ? 'и' : ''}: ${servicesList}\n` +
          `Дата начала: ${dateStr}\n\n` +
          `Ваша запись${finalAppointments.length > 1 ? 'и' : ''} ожидает${finalAppointments.length > 1 ? 'ют' : ''} подтверждения администратором.\n\n` +
          `Мы уведомим вас, когда запись${finalAppointments.length > 1 ? 'и' : ''} будет${finalAppointments.length > 1 ? 'ут' : ''} подтверждена${finalAppointments.length > 1 ? 'ы' : ''}.`;

      try {
        await ctx.editMessageText(successMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        });
      } catch (error) {
        await ctx.reply(successMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        });
      }

      // Очищаем сессию
      this.sessions.delete(ctx.from!.id);
      await ctx.answerCbQuery('✅ Запись создана!');
    } catch (error: any) {
      this.logger.error(`Ошибка при создании записи: ${error.message}`, error.stack);
      await ctx.answerCbQuery(`Ошибка: ${error.message || 'Не удалось создать запись'}`);
    }
  }

  // Подтверждение переноса записи
  private async handleConfirmReschedule(ctx: Context, appointmentId: string) {
    const session = this.getSession(ctx.from!.id);
    
    if (!session.selectedTime) {
      await ctx.answerCbQuery('Ошибка: время не выбрано');
      return;
    }

    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден. Используйте /start');
      return;
    }

    try {
      const appointment = await this.appointmentsService.reschedule(
        appointmentId,
        new Date(session.selectedTime),
        user.id,
        'Перенесено через бота',
      );

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои записи', 'appointments:list')],
        [Markup.button.callback('📅 Новая запись', 'service:list')],
      ]);

      const successMessage = `✅ *Запись успешно перенесена!*\n\n` +
        `Новая дата: ${new Date(appointment.startTime).toLocaleString('ru-RU')}\n\n` +
        `Мы отправили вам уведомление с деталями.`;

      try {
        await ctx.editMessageText(successMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        });
      } catch (error) {
        await ctx.reply(successMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        });
      }

      // Очищаем сессию
      this.sessions.delete(ctx.from!.id);
      await ctx.answerCbQuery('✅ Запись перенесена!');
    } catch (error: any) {
      this.logger.error(`Ошибка при переносе записи: ${error.message}`, error.stack);
      await ctx.answerCbQuery(`Ошибка: ${error.message || 'Не удалось перенести запись'}`);
    }
  }

  // Показ выбора причины переноса
  private async showRescheduleReasonSelection(ctx: Context, appointmentId: string) {
    const session = this.getSession(ctx.from!.id);
    session.step = 'reschedule_reason';
    session.selectedAppointmentId = appointmentId;

    const reasons = [
      { text: 'Изменение планов', callback: 'reason:change_plans' },
      { text: 'Болезнь', callback: 'reason:illness' },
      { text: 'Срочные дела', callback: 'reason:urgent' },
      { text: 'Другая причина', callback: 'reason:other' },
    ];

    const keyboard = Markup.inlineKeyboard([
      ...reasons.map(r => [Markup.button.callback(r.text, r.callback)]),
      [Markup.button.callback('❌ Отмена', 'cancel')],
    ]);

    await ctx.editMessageText(
      '📝 *Выберите причину переноса записи:*',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      },
    );
    await ctx.answerCbQuery();
  }

  // Обработка выбора причины переноса
  private async handleRescheduleReasonSelect(ctx: Context, reason: string) {
    const session = this.getSession(ctx.from!.id);
    
    const reasonTexts: Record<string, string> = {
      'change_plans': 'Изменение планов',
      'illness': 'Болезнь',
      'urgent': 'Срочные дела',
      'other': 'Другая причина',
    };

    if (reason === 'other') {
      // Запрашиваем текстовую причину
      session.step = 'reschedule_reason_text';
      await ctx.editMessageText(
        '📝 *Напишите причину переноса записи:*',
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отмена', 'cancel')],
          ]).reply_markup,
        },
      );
      await ctx.answerCbQuery();
      return;
    }

    session.rescheduleReason = reasonTexts[reason] || reason;
    
    // Возвращаемся к подтверждению переноса
    if (session.selectedAppointmentId && session.selectedTime) {
      await this.handleConfirmReschedule(ctx, session.selectedAppointmentId);
    }
  }

  // Обработка отзыва через бот
  private async handleReviewRequest(ctx: Context, appointmentId: string) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден');
      return;
    }

    try {
      const appointment = await this.appointmentsService.findById(appointmentId, user.id);
      
      if (appointment.status !== AppointmentStatus.COMPLETED) {
        await ctx.answerCbQuery('Можно оставить отзыв только для завершенных записей');
        return;
      }

      const session = this.getSession(ctx.from!.id);
      session.selectedAppointmentForReview = appointmentId;
      session.step = 'review_rating';

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('⭐ 1', 'review_rating:1'),
          Markup.button.callback('⭐⭐ 2', 'review_rating:2'),
          Markup.button.callback('⭐⭐⭐ 3', 'review_rating:3'),
        ],
        [
          Markup.button.callback('⭐⭐⭐⭐ 4', 'review_rating:4'),
          Markup.button.callback('⭐⭐⭐⭐⭐ 5', 'review_rating:5'),
        ],
        [Markup.button.callback('❌ Отмена', 'cancel')],
      ]);

      await ctx.editMessageText(
        `💬 *Оставьте отзыв о записи*\n\n` +
        `Услуга: ${(appointment.service as any)?.name || 'Услуга'}\n` +
        `Мастер: ${(appointment.master as any)?.name || 'Мастер'}\n\n` +
        `Выберите оценку:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        },
      );
      await ctx.answerCbQuery();
    } catch (error: any) {
      this.logger.error(`Ошибка при запросе отзыва: ${error.message}`, error.stack);
      await ctx.answerCbQuery(`Ошибка: ${error.message || 'Не удалось загрузить запись'}`);
    }
  }

  // Обработка выбора рейтинга
  private async handleReviewRating(ctx: Context, rating: number) {
    const session = this.getSession(ctx.from!.id);
    session.reviewRating = rating;
    session.step = 'review_comment';

    await ctx.editMessageText(
      `⭐ *Оценка: ${rating} из 5*\n\n` +
      `Напишите комментарий к отзыву (или отправьте "пропустить" для пропуска комментария):`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'cancel')],
        ]).reply_markup,
      },
    );
    await ctx.answerCbQuery();
  }

  // Обработка комментария отзыва
  private async handleReviewComment(ctx: Context, comment: string) {
    const session = this.getSession(ctx.from!.id);
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user || !session.selectedAppointmentForReview || !session.reviewRating) {
      await ctx.reply('❌ Ошибка: данные сессии потеряны. Начните заново.');
      session.step = undefined;
      return;
    }

    try {
      const finalComment = comment.toLowerCase() === 'пропустить' ? undefined : comment;
      
      await this.reviewsService.create(
        user.id,
        session.selectedAppointmentForReview,
        session.reviewRating,
        finalComment,
      );

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои записи', 'appointments:list')],
      ]);

      await ctx.reply(
        '✅ *Спасибо за ваш отзыв!*\n\n' +
        'Ваш отзыв отправлен на модерацию.',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        },
      );

      // Очищаем сессию
      session.step = undefined;
      session.selectedAppointmentForReview = undefined;
      session.reviewRating = undefined;
    } catch (error: any) {
      this.logger.error(`Ошибка при создании отзыва: ${error.message}`, error.stack);
      await ctx.reply(`❌ Ошибка: ${error.message || 'Не удалось создать отзыв'}`);
    }
  }

  // Показать записи пользователя
  private async showAppointments(ctx: Context) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('Пользователь не найден. Используйте /start');
      return;
    }

    const appointments = await this.appointmentsService.findAll(user.id);

    if (appointments.length === 0) {
      await this.sendPrivateCallbackReply(ctx, 'У вас пока нет записей. Используйте /book для записи.');
      return;
    }

    // Фильтруем только актуальные записи (исключая прошедшие)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const upcoming = appointments.filter(
      (apt) => {
        const aptDate = new Date(apt.startTime);
        const aptDateOnly = new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate());
        // Показываем только записи, которые еще не прошли (дата >= сегодня)
        return apt.status === AppointmentStatus.CONFIRMED && aptDateOnly >= today;
      }
    );

    if (upcoming.length === 0) {
      await this.sendPrivateCallbackReply(ctx, 'У вас нет предстоящих записей.');
      return;
    }

    let message = '*Ваши предстоящие записи:*\n\n';
    const keyboard: any[] = [];

    for (const apt of upcoming.slice(0, 10)) {
      const date = new Date(apt.startTime);
      message += `📅 ${date.toLocaleString('ru-RU')}\n`;
      message += `💆 ${(apt.service as any)?.name || 'Услуга'}\n`;
      message += `👤 ${(apt.master as any)?.name || 'Мастер'}\n`;
      message += `💰 ${apt.price}₽\n\n`;

      keyboard.push([
        Markup.button.callback(
          `❌ Отменить ${date.toLocaleDateString('ru-RU')}`,
          `cancel_appt:${apt.id}`,
        ),
      ]);
    }

    keyboard.push([Markup.button.callback('📅 Новая запись', 'service:list')]);

    await this.sendPrivateCallbackReply(ctx, message, Markup.inlineKeyboard(keyboard), { parse_mode: 'Markdown' });
  }

  // Показать записи для отмены
  private async showAppointmentsForCancellation(ctx: Context) {
    await this.showAppointments(ctx);
  }

  // Показать записи для переноса
  private async showAppointmentsForReschedule(ctx: Context) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('Пользователь не найден. Используйте /start');
      return;
    }

    const appointments = await this.appointmentsService.findAll(user.id);

    // Фильтруем только актуальные записи (исключая прошедшие)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const upcoming = appointments.filter(
      (apt) => {
        const aptDate = new Date(apt.startTime);
        const aptDateOnly = new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate());
        // Показываем только записи, которые еще не прошли (дата >= сегодня)
        return apt.status === AppointmentStatus.CONFIRMED && aptDateOnly >= today;
      }
    );

    if (upcoming.length === 0) {
      await ctx.reply('У вас нет записей для переноса.');
      return;
    }

    let message = '*Выберите запись для переноса:*\n\n';
    const keyboard: any[] = [];

    for (const apt of upcoming.slice(0, 10)) {
      const date = new Date(apt.startTime);
      message += `📅 ${date.toLocaleString('ru-RU')}\n`;
      message += `💆 ${(apt.service as any)?.name || 'Услуга'}\n`;
      message += `👤 ${(apt.master as any)?.name || 'Мастер'}\n\n`;

      keyboard.push([
        Markup.button.callback(
          `🔄 Перенести ${date.toLocaleDateString('ru-RU')}`,
          `reschedule:${apt.id}`,
        ),
      ]);
    }

    keyboard.push([Markup.button.callback('◀️ Назад', 'appointments:list')]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard(keyboard).reply_markup,
    });
  }

  // Начало переноса записи
  private async handleRescheduleStart(ctx: Context, appointmentId: string) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден');
      return;
    }

    try {
      const appointment = await this.appointmentsService.findById(appointmentId, user.id);
      const service = await this.servicesService.findById(appointment.serviceId);
      const master = await this.mastersService.findById(appointment.masterId);

      const session = this.getSession(ctx.from!.id);
      session.selectedServiceId = appointment.serviceId;
      session.selectedMasterId = appointment.masterId;
      session.selectedAppointmentId = appointmentId;
      session.step = 'reschedule_date';

      // Показываем календарь для выбора новой даты
      const today = new Date();
      await this.showCalendar(ctx, appointment.serviceId, appointment.masterId, today.getFullYear(), today.getMonth());
      await ctx.answerCbQuery();
    } catch (error: any) {
      this.logger.error(`Ошибка при начале переноса: ${error.message}`, error.stack);
      await ctx.answerCbQuery(`Ошибка: ${error.message || 'Не удалось начать перенос'}`);
    }
  }

  // Отмена записи
  private async handleCancelAppointment(ctx: Context, appointmentId: string) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден');
      return;
    }

    try {
      await this.appointmentsService.cancel(appointmentId, user.id, 'Отменено через бота');
      await ctx.answerCbQuery('✅ Запись отменена');
      
      try {
        await ctx.editMessageText('✅ Запись успешно отменена.');
      } catch (error) {
        await ctx.reply('✅ Запись успешно отменена.');
      }
      
      // Показываем обновленный список записей
      setTimeout(() => this.showAppointments(ctx), 500);
    } catch (error: any) {
      this.logger.error(`Ошибка при отмене записи: ${error.message}`, error.stack);
      await ctx.answerCbQuery(`Ошибка: ${error.message || 'Не удалось отменить запись'}`);
    }
  }

  // Показать профиль
  private async showProfile(ctx: Context) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('Пользователь не найден. Используйте /start');
      return;
    }

    const appointments = await this.appointmentsService.findAll(user.id);
    const totalAppointments = appointments.filter(
      (apt) => apt.status === AppointmentStatus.COMPLETED,
    ).length;

    const message = `
*Ваш профиль* 👤

Имя: ${user.firstName} ${user.lastName || ''}
Бонусы: ${user.bonusPoints} баллов
Всего посещений: ${totalAppointments}

Используйте команды для управления записями.
    `;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📅 Мои записи', 'appointments:list')],
      [Markup.button.callback('📅 Новая запись', 'service:list')],
      [Markup.button.callback('🎁 История бонусов', 'bonus:history')],
    ]);

    await this.sendPrivateCallbackReply(ctx, message, keyboard, { parse_mode: 'Markdown' });
  }

  /**
   * Показать детальную информацию о бонусах
   */
  private async showBonusInfo(ctx: Context) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('Пользователь не найден. Используйте /start');
      return;
    }

    // Получаем статистику по транзакциям
    const transactions = await this.financialService.getUserTransactions(user.id);
    const bonusTransactions = transactions.filter(
      (t) => t.type === TransactionType.BONUS_EARNED || t.type === TransactionType.BONUS_USED || t.type === TransactionType.REFUND,
    );

    const totalEarned = bonusTransactions
      .filter((t) => t.type === TransactionType.BONUS_EARNED || t.type === TransactionType.REFUND)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalUsed = bonusTransactions
      .filter((t) => t.type === TransactionType.BONUS_USED)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const recentTransactions = bonusTransactions.slice(0, 5);

    let message = `🎁 *Ваши бонусы*\n\n`;
    message += `💰 *Текущий баланс:* ${user.bonusPoints} баллов\n\n`;
    message += `📊 *Статистика:*\n`;
    message += `   • Всего начислено: ${totalEarned} баллов\n`;
    message += `   • Всего использовано: ${totalUsed} баллов\n`;
    message += `   • Доступно: ${user.bonusPoints} баллов\n\n`;

    // Получаем таймзону из настроек для правильного отображения времени
    const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
    
    if (recentTransactions.length > 0) {
      message += `📋 *Последние операции:*\n`;
      recentTransactions.forEach((transaction, index) => {
        const date = new Date(transaction.createdAt);
        const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: timezone });
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
        
        let emoji = '';
        let sign = '';
        if (transaction.type === TransactionType.BONUS_EARNED) {
          emoji = '➕';
          sign = '+';
        } else if (transaction.type === TransactionType.BONUS_USED) {
          emoji = '➖';
          sign = '-';
        } else if (transaction.type === TransactionType.REFUND) {
          emoji = '↩️';
          sign = '+';
        }

        const description = transaction.description || 
          (transaction.type === TransactionType.BONUS_EARNED ? 'Начисление бонусов' :
           transaction.type === TransactionType.BONUS_USED ? 'Использование бонусов' :
           'Возврат бонусов');

        message += `${emoji} ${sign}${transaction.amount} баллов\n`;
        message += `   ${description}\n`;
        message += `   ${dateStr} ${timeStr}\n\n`;
      });
    } else {
      message += `📋 История операций пуста.\n\n`;
    }

    message += `💡 1 балл = 1 рубль при оплате услуг.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Полная история', 'bonus:history')],
      [Markup.button.callback('◀️ Назад к профилю', 'profile:show')],
    ]);

    await this.sendPrivateCallbackReply(ctx, message, keyboard, { parse_mode: 'Markdown' });
  }

  /**
   * Показать полную историю бонусов
   */
  private async showBonusHistory(ctx: Context) {
    const telegramId = ctx.from!.id.toString();
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      await ctx.reply('Пользователь не найден. Используйте /start');
      return;
    }

    // Получаем все транзакции по бонусам
    const transactions = await this.financialService.getUserTransactions(user.id);
    const bonusTransactions = transactions.filter(
      (t) => t.type === TransactionType.BONUS_EARNED || t.type === TransactionType.BONUS_USED || t.type === TransactionType.REFUND,
    );

    if (bonusTransactions.length === 0) {
      const message = `📋 *История бонусов*\n\n` +
        `У вас пока нет операций с бонусами.\n\n` +
        `💡 Бонусы начисляются после завершения записей.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад', 'bonus:info')],
      ]);

      await this.sendPrivateCallbackReply(ctx, message, keyboard, { parse_mode: 'Markdown' });
      return;
    }

    // Группируем по датам
    const groupedByDate = new Map<string, typeof bonusTransactions>();
    bonusTransactions.forEach((transaction) => {
      const date = new Date(transaction.createdAt);
      const dateKey = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, []);
      }
      groupedByDate.get(dateKey)!.push(transaction);
    });

    let message = `📋 *История бонусов*\n\n`;
    message += `💰 *Текущий баланс:* ${user.bonusPoints} баллов\n\n`;

    // Показываем последние 20 транзакций (по 10 на сообщение, если нужно)
    const transactionsToShow = bonusTransactions.slice(0, 20);
    
    transactionsToShow.forEach((transaction, index) => {
      const date = new Date(transaction.createdAt);
      const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      
      let emoji = '';
      let sign = '';
      if (transaction.type === TransactionType.BONUS_EARNED) {
        emoji = '➕';
        sign = '+';
      } else if (transaction.type === TransactionType.BONUS_USED) {
        emoji = '➖';
        sign = '-';
      } else if (transaction.type === TransactionType.REFUND) {
        emoji = '↩️';
        sign = '+';
      }

      const description = transaction.description || 
        (transaction.type === TransactionType.BONUS_EARNED ? 'Начисление бонусов' :
         transaction.type === TransactionType.BONUS_USED ? 'Использование бонусов' :
         'Возврат бонусов');

      // Если это первая транзакция дня или первая транзакция вообще, показываем дату
      const prevTransaction = index > 0 ? transactionsToShow[index - 1] : null;
      const prevDate = prevTransaction ? new Date(prevTransaction.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
      
      if (dateStr !== prevDate) {
        message += `\n📅 *${dateStr}*\n`;
      }

      message += `${emoji} ${sign}${transaction.amount} баллов - ${description}\n`;
      message += `   ${timeStr}\n`;
    });

    if (bonusTransactions.length > 20) {
      message += `\n\n... и еще ${bonusTransactions.length - 20} операций`;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('◀️ Назад', 'bonus:info')],
    ]);

    await this.sendPrivateCallbackReply(ctx, message, keyboard, { parse_mode: 'Markdown' });
  }

  // Вспомогательные методы
  private getSession(userId: number): BotSession {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {});
    }
    return this.sessions.get(userId)!;
  }

  private getMonthName(month: number): string {
    const months = [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ];
    return months[month];
  }

  async sendMessage(chatId: string, message: string, options?: any): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.telegram.sendMessage(chatId, message, options);
      } catch (error: any) {
        this.logger.error(`Ошибка при отправке сообщения: ${error.message}`);
      }
    }
  }

  /**
   * Отправка уведомления админам о новой записи
   */
  async notifyAdminsAboutNewAppointment(appointment: Appointment): Promise<void> {
    try {
      if (!this.bot) {
        this.logger.debug('Telegram бот не инициализирован');
        return;
      }

      // Находим всех админов с Telegram ID
      const admins = await this.userRepository.find({
        where: {
          role: UserRole.ADMIN,
          telegramId: Not(null),
        },
      });

      if (admins.length === 0) {
        this.logger.debug('Нет админов с Telegram ID для отправки уведомления');
        return;
      }

      // Загружаем связанные данные
      const appointmentWithRelations = await this.appointmentRepository.findOne({
        where: { id: appointment.id },
        relations: ['client', 'master', 'service'],
      });

      if (!appointmentWithRelations) {
        return;
      }

      const client = appointmentWithRelations.client as any;
      const master = appointmentWithRelations.master as any;
      const service = appointmentWithRelations.service as any;
      const date = new Date(appointmentWithRelations.startTime);

      // Получаем таймзону из настроек для правильного отображения времени
      const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
      
      const message = 
        `🔔 *Новая запись*\n\n` +
        `📅 Дата: ${date.toLocaleDateString('ru-RU', { timeZone: timezone })}\n` +
        `⏰ Время: ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}\n\n` +
        `👤 *Клиент:*\n` +
        `   Имя: ${client?.firstName || 'Не указано'} ${client?.lastName || ''}\n` +
        `   Телефон: ${client?.phone || 'Не указан'}\n\n` +
        `💆 *Услуга:* ${service?.name || 'Неизвестно'}\n` +
        `💰 Цена: ${appointmentWithRelations.price}₽\n\n` +
        `👨‍💼 *Мастер:* ${master?.name || 'Неизвестно'}\n\n` +
        `📊 Статус: ⏳ Ожидает подтверждения`;

      // Отправляем уведомление всем админам
      const sendPromises = admins.map(admin => 
        this.sendMessage(admin.telegramId!, message, { parse_mode: 'Markdown' })
          .catch(error => {
            this.logger.error(`Ошибка при отправке уведомления админу ${admin.id}: ${error.message}`);
          })
      );

      await Promise.allSettled(sendPromises);
      this.logger.log(`Уведомления о новой записи отправлены ${admins.length} админам`);
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомлений админам о новой записи: ${error.message}`);
    }
  }

  /**
   * Отправка уведомления админам об отмене записи
   */
  async notifyAdminsAboutCancelledAppointment(appointment: Appointment, reason?: string): Promise<void> {
    try {
      if (!this.bot) {
        this.logger.debug('Telegram бот не инициализирован');
        return;
      }

      // Находим всех админов с Telegram ID
      const admins = await this.userRepository.find({
        where: {
          role: UserRole.ADMIN,
          telegramId: Not(null),
        },
      });

      if (admins.length === 0) {
        this.logger.debug('Нет админов с Telegram ID для отправки уведомления');
        return;
      }

      // Загружаем связанные данные
      const appointmentWithRelations = await this.appointmentRepository.findOne({
        where: { id: appointment.id },
        relations: ['client', 'master', 'service'],
      });

      if (!appointmentWithRelations) {
        return;
      }

      const client = appointmentWithRelations.client as any;
      const master = appointmentWithRelations.master as any;
      const service = appointmentWithRelations.service as any;
      const date = new Date(appointmentWithRelations.startTime);

      // Получаем таймзону из настроек для правильного отображения времени
      const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
      
      let message = 
        `❌ *Запись отменена*\n\n` +
        `📅 Дата: ${date.toLocaleDateString('ru-RU', { timeZone: timezone })}\n` +
        `⏰ Время: ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}\n\n` +
        `👤 *Клиент:*\n` +
        `   Имя: ${client?.firstName || 'Не указано'} ${client?.lastName || ''}\n` +
        `   Телефон: ${client?.phone || 'Не указан'}\n\n` +
        `💆 *Услуга:* ${service?.name || 'Неизвестно'}\n` +
        `👨‍💼 *Мастер:* ${master?.name || 'Неизвестно'}\n`;

      if (reason) {
        message += `\n📝 Причина: ${reason}`;
      }

      // Отправляем уведомление всем админам
      const sendPromises = admins.map(admin => 
        this.sendMessage(admin.telegramId!, message, { parse_mode: 'Markdown' })
          .catch(error => {
            this.logger.error(`Ошибка при отправке уведомления админу ${admin.id}: ${error.message}`);
          })
      );

      await Promise.allSettled(sendPromises);
      this.logger.log(`Уведомления об отмене записи отправлены ${admins.length} админам`);
    } catch (error: any) {
      this.logger.error(`Ошибка при отправке уведомлений админам об отмене записи: ${error.message}`);
    }
  }

  async sendMessageWithKeyboard(
    chatId: string,
    message: string,
    keyboard: any,
  ): Promise<void> {
    if (this.bot) {
      await this.bot.telegram.sendMessage(chatId, message, keyboard);
    }
  }

  // Публичный метод для доступа к боту из TelegramService
  getBot(): Telegraf | null {
    return this.bot || null;
  }

  /**
   * Заменяет переменные в тексте сообщения
   */
  /**
   * Заменяет переменные в тексте сообщения
   * Поддерживает переменные: {first_name}, {last_name}, {username}, {user_id}, {chat_id}, {chat_title}, {date}, {time}
   * Публичный метод для использования в других сервисах
   */
  public replaceMessageVariables(
    text: string,
    user?: any,
    chat?: any,
  ): string {
    if (!text) return text;

    // Используем дефолтную таймзону (MSK), так как метод синхронный
    // Для точной таймзоны нужно использовать асинхронный вариант
    const timezone = 'Europe/Moscow';
    
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU', { timeZone: timezone });
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

    let result = text;

    // Заменяем переменные пользователя
    // Поддерживаем как ctx.from (snake_case: first_name, last_name, id), так и User entity (camelCase: firstName, lastName, telegramId)
    if (user) {
      const firstName = user.first_name || user.firstName || '';
      const lastName = user.last_name || user.lastName || '';
      const username = user.username || '';
      const userId = user.id?.toString() || user.telegramId?.toString() || user.user_id?.toString() || '';

      result = result.replace(/{first_name}/g, firstName);
      result = result.replace(/{last_name}/g, lastName);
      result = result.replace(/{username}/g, username ? (username.startsWith('@') ? username : `@${username}`) : '');
      result = result.replace(/{user_id}/g, userId);
    }

    // Заменяем переменные чата
    // Поддерживаем как ctx.chat (snake_case: id, title, first_name), так и TelegramChat entity
    if (chat) {
      const chatId = chat.id?.toString() || chat.chatId?.toString() || '';
      const chatTitle = chat.title || chat.first_name || chat.name || '';

      result = result.replace(/{chat_id}/g, chatId);
      result = result.replace(/{chat_title}/g, chatTitle);
    }

    // Заменяем общие переменные
    result = result.replace(/{date}/g, date);
    result = result.replace(/{time}/g, time);

    return result;
  }

  /**
   * Определяет parse_mode на основе содержимого сообщения
   * Если в сообщении есть HTML теги - использует HTML
   * Если есть MarkdownV2 синтаксис (подчеркивание, зачеркивание, спойлер) - использует MarkdownV2
   * Если есть старый Markdown синтаксис - использует Markdown
   * По умолчанию - HTML
   */
  private detectParseMode(text: string): 'HTML' | 'Markdown' | 'MarkdownV2' {
    if (!text) return 'HTML';

    // Проверяем наличие HTML тегов (исключаем случаи, когда это может быть частью Markdown)
    const htmlTags = /<[a-zA-Z][^>]*>/g;
    const hasHtmlTags = htmlTags.test(text);

    // Проверяем наличие старого Markdown синтаксиса (имеет приоритет)
    // Старый Markdown: **bold**, ~~strike~~, `code`, [link](url)
    const hasDoubleStar = /\*\*[^*]+\*\*/.test(text);  // **bold**
    const hasDoubleTilde = /~~[^~]+~~/.test(text);    // ~~strike~~
    const hasCode = /`[^`]+`/.test(text);              // `code`
    const hasLink = /\[[^\]]+\]\([^)]+\)/.test(text);  // [link](url)
    const hasOldMarkdown = hasDoubleStar || hasDoubleTilde || hasCode || hasLink;
    
    // Проверяем наличие MarkdownV2 специфичных синтаксисов
    // MarkdownV2: *bold*, _italic_, __underline__, ~strike~, ||spoiler||
    const hasUnderline = /__[^_]+__/.test(text);        // __underline__ - только MarkdownV2
    const hasSpoiler = /\|\|[^|]+\|\|/.test(text);      // ||spoiler|| - только MarkdownV2
    const hasSingleTilde = /~[^~\s\n]+~/.test(text);   // ~strike~ - только MarkdownV2
    
    // Проверяем одиночные звездочки и подчеркивания
    // В MarkdownV2: *bold*, _italic_
    // В старом Markdown: *italic*, _italic_ (но приоритет у **bold**)
    const hasSingleStar = /\*[^*\s\n]+\*/.test(text);
    const hasSingleUnderscore = /_[^_\s\n]+_/.test(text);
    
    // MarkdownV2 если есть специфичные синтаксисы (__underline__, ||spoiler||, ~strike~)
    // или одиночные символы без двойных (если нет старого Markdown)
    const hasMarkdownV2 = hasUnderline || hasSpoiler || hasSingleTilde || 
                          (hasSingleStar && !hasDoubleStar) || 
                          (hasSingleUnderscore && !hasUnderline && !hasOldMarkdown);

    // Если есть HTML теги, используем HTML
    if (hasHtmlTags) {
      return 'HTML';
    }

    // Если есть старый Markdown синтаксис (двойные символы), используем старый Markdown
    // Это имеет приоритет над MarkdownV2
    if (hasOldMarkdown) {
      return 'Markdown';
    }

    // Если есть MarkdownV2 специфичные синтаксисы, используем MarkdownV2
    if (hasMarkdownV2) {
      return 'MarkdownV2';
    }

    // По умолчанию HTML
    return 'HTML';
  }

  /**
   * Отправляет приветственное сообщение новому участнику группы индивидуально
   */
  private async sendWelcomeMessageToNewMember(userId: number, chat: any): Promise<void> {
    if (!this.bot) {
      this.logger.warn('Бот не инициализирован, невозможно отправить приветственное сообщение');
      return;
    }

    try {
      // Получаем информацию о пользователе
      let user: any = null;
      try {
        user = await this.userRepository.findOne({ where: { telegramId: userId.toString() } });
      } catch (error) {
        // Пользователь может не быть в базе
      }

      // Получаем настраиваемое приветственное сообщение из настроек
      const customWelcomeMessage = await this.settingsService.get('telegramGroupWelcomeMessage', null);
      
      // Формируем приветственное сообщение
      let welcomeText: string;
      if (customWelcomeMessage && customWelcomeMessage.trim()) {
        welcomeText = this.replaceMessageVariables(customWelcomeMessage, user, chat);
      } else {
        // Дефолтное приветственное сообщение
        welcomeText = 
          `👋 Привет! Я бот салона красоты "Афродита".\n\n` +
          `Я могу помочь вам:\n` +
          `• Записаться на услуги\n` +
          `• Узнать о наших услугах\n` +
          `• Управлять вашими записями\n\n` +
          `Для начала работы нажмите кнопку ниже, чтобы перейти в личный чат со мной.`;
      }

      // Создаем inline-кнопки для перехода в личный чат и записи
      const botInfo = await this.bot.telegram.getMe();
      const botUsername = botInfo.username;
      const keyboard = Markup.inlineKeyboard([
        [{ text: '📅 Записаться', switch_inline_query: 'book' }],
        [Markup.button.url('💬 Перейти в личный чат', `https://t.me/${botUsername}?start=group_${chat.id}`)],
      ]);

      // Отправляем сообщение индивидуально через личные сообщения
      const parseMode = this.detectParseMode(welcomeText);
      await this.bot.telegram.sendMessage(userId, welcomeText, {
        reply_markup: keyboard.reply_markup,
        parse_mode: parseMode,
      });

      this.logger.log(`Приветственное сообщение отправлено пользователю ${userId}`);
    } catch (error: any) {
      // Если не удалось отправить личное сообщение (пользователь заблокировал бота или не начал диалог)
      if (error.code === 403 || error.description?.includes('bot was blocked') || error.description?.includes('chat not found')) {
        this.logger.debug(`Пользователь ${userId} заблокировал бота или не начал диалог`);
      } else {
        this.logger.error(`Ошибка при отправке приветственного сообщения пользователю ${userId}: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Определяет, является ли чат группой
   */
  private isGroupChat(chat: any): boolean {
    return chat.type === 'group' || chat.type === 'supergroup';
  }

  /**
   * Получить настройки группы или создать дефолтные
   */
  private async getGroupSettings(chatId: string): Promise<GroupSettings> {
    let settings = await this.groupSettingsRepository.findOne({
      where: { chatId },
    });

    if (!settings) {
      settings = this.groupSettingsRepository.create({
        chatId,
        language: 'ru',
        enabledCommands: {
          schedule: true,
          masters: true,
          promotions: true,
          faq: true,
        },
        notifications: {
          welcomeEnabled: true,
          newMemberEnabled: true,
        },
      });
      await this.groupSettingsRepository.save(settings);
    }

    return settings;
  }

  /**
   * Проверить, включена ли команда для группы
   */
  private async isCommandEnabled(chatId: string, command: 'schedule' | 'masters' | 'promotions' | 'faq'): Promise<boolean> {
    if (!this.isGroupChat({ type: 'group' })) {
      return true; // В личных чатах все команды доступны
    }

    const settings = await this.getGroupSettings(chatId);
    return settings.enabledCommands[command] !== false; // По умолчанию включено
  }

  /**
   * Обработка команды /schedule - показать свободные слоты
   */
  private async handleScheduleCommand(ctx: Context) {
    const isGroup = this.isGroupChat(ctx.chat);
    
    if (isGroup) {
      // Проверяем, включена ли команда для группы
      const enabled = await this.isCommandEnabled(ctx.chat.id.toString(), 'schedule');
      if (!enabled) {
        await ctx.reply('❌ Команда /schedule отключена для этой группы.');
        return;
      }
    }

    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Получаем все активные мастера
      const mastersResult = await this.mastersService.findAll(1, 100, undefined, true);
      const activeMasters = mastersResult.data || [];

      if (activeMasters.length === 0) {
        await ctx.reply('❌ Нет доступных мастеров.');
        return;
      }

      let message = `📅 *Свободные слоты на ближайшие дни*\n\n`;

      // Проверяем слоты на сегодня и завтра
      for (const master of activeMasters.slice(0, 5)) { // Показываем только первых 5 мастеров
        const todaySlots = await this.getAvailableSlots(master.id, now, tomorrow);
        const tomorrowSlots = await this.getAvailableSlots(master.id, tomorrow, dayAfterTomorrow);

        if (todaySlots > 0 || tomorrowSlots > 0) {
          message += `👤 *${master.name}*\n`;
          
          if (todaySlots > 0) {
            message += `  Сегодня: ${todaySlots} свободных слотов\n`;
          }
          if (tomorrowSlots > 0) {
            message += `  Завтра: ${tomorrowSlots} свободных слотов\n`;
          }
          message += '\n';
        }
      }

      if (message === `📅 *Свободные слоты на ближайшие дни*\n\n`) {
        message += '❌ На ближайшие дни нет свободных слотов.\n\n';
        message += '💡 Используйте /book для записи на другие даты.';
      } else {
        message += '💡 Для записи используйте /book или перейдите в личный чат.';
      }

      const botInfo = await this.bot.telegram.getMe();
      const botUsername = botInfo.username;
      const keyboard = Markup.inlineKeyboard([
        [{ text: '📅 Записаться', switch_inline_query: 'book' }],
        [Markup.button.url('💬 Личный чат', `https://t.me/${botUsername}?start=book`)],
      ]);

      if (isGroup) {
        await ctx.reply(message, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      } else {
        await ctx.reply(message, {
          reply_markup: keyboard.reply_markup,
          parse_mode: 'Markdown',
        });
      }
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке /schedule: ${error.message}`, error.stack);
      await ctx.reply('❌ Произошла ошибка при получении расписания. Попробуйте позже.');
    }
  }

  /**
   * Получить количество доступных слотов для мастера в указанном диапазоне
   */
  private async getAvailableSlots(masterId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      // Получаем расписание мастера
      const master = await this.masterRepository.findOne({
        where: { id: masterId },
        relations: ['workSchedules'],
      });

      if (!master || !master.isActive) {
        return 0;
      }

      // Получаем существующие записи в диапазоне
      const appointmentsInRange = await this.appointmentRepository.find({
        where: {
          masterId,
          startTime: MoreThanOrEqual(startDate),
          status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING, AppointmentStatus.RESCHEDULED]),
        },
      });

      // Фильтруем только те, что попадают в диапазон endDate
      const filteredCount = appointmentsInRange.filter(apt => {
        const aptDate = new Date(apt.startTime);
        return aptDate >= startDate && aptDate < endDate;
      }).length;

      // Упрощенный расчет: предполагаем среднюю длительность услуги 60 минут
      // и рабочий день 9:00-21:00 (12 часов = 12 слотов)
      const hoursInRange = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const estimatedSlots = Math.floor(hoursInRange * 0.8); // 80% от часов (учитываем перерывы)
      const availableSlots = Math.max(0, estimatedSlots - filteredCount);

      return availableSlots;
    } catch (error: any) {
      this.logger.error(`Ошибка при расчете доступных слотов: ${error.message}`);
      return 0;
    }
  }

  /**
   * Обработка команды /masters - показать информацию о мастерах
   */
  private async handleMastersCommand(ctx: Context) {
    const isGroup = this.isGroupChat(ctx.chat);
    
    if (isGroup) {
      const enabled = await this.isCommandEnabled(ctx.chat.id.toString(), 'masters');
      if (!enabled) {
        await ctx.reply('❌ Команда /masters отключена для этой группы.');
        return;
      }
    }

    try {
      const mastersResult = await this.mastersService.findAll(1, 10, undefined, true);
      const masters = mastersResult.data || [];

      if (masters.length === 0) {
        await ctx.reply('❌ Нет доступных мастеров.');
        return;
      }

      let message = `👤 *Наши мастера*\n\n`;

      masters.forEach((master, index) => {
        message += `${index + 1}. *${master.name}*\n`;
        if (master.bio) {
          message += `   ${master.bio.substring(0, 100)}${master.bio.length > 100 ? '...' : ''}\n`;
        }
        if (master.rating > 0) {
          message += `   ⭐ Рейтинг: ${master.rating.toFixed(1)}\n`;
        }
        if (master.experience > 0) {
          message += `   💼 Опыт: ${master.experience} ${master.experience === 1 ? 'год' : master.experience < 5 ? 'года' : 'лет'}\n`;
        }
        message += '\n';
      });

      message += '💡 Для записи к мастеру используйте /book или перейдите в личный чат.';

      const botInfo = await this.bot.telegram.getMe();
      const botUsername = botInfo.username;
      const keyboard = Markup.inlineKeyboard([
        [{ text: '📅 Записаться', switch_inline_query: 'book' }],
        [Markup.button.url('💬 Личный чат', `https://t.me/${botUsername}?start=book`)],
      ]);

      await ctx.reply(message, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке /masters: ${error.message}`, error.stack);
      await ctx.reply('❌ Произошла ошибка при получении информации о мастерах. Попробуйте позже.');
    }
  }

  /**
   * Обработка команды /promotions - показать акции и скидки
   */
  private async handlePromotionsCommand(ctx: Context) {
    const isGroup = this.isGroupChat(ctx.chat);
    
    if (isGroup) {
      const enabled = await this.isCommandEnabled(ctx.chat.id.toString(), 'promotions');
      if (!enabled) {
        await ctx.reply('❌ Команда /promotions отключена для этой группы.');
        return;
      }
    }

    try {
      // Получаем настройки скидки на первый визит
      const firstVisitDiscount = await this.settingsService.getFirstVisitDiscountSettings();

      let message = `🎁 *Акции и скидки*\n\n`;

      if (firstVisitDiscount.enabled) {
        message += `✨ *Скидка на первый визит*\n`;
        if (firstVisitDiscount.type === 'percent') {
          message += `   Скидка ${firstVisitDiscount.value}% для новых клиентов!\n\n`;
        } else {
          message += `   Скидка ${firstVisitDiscount.value}₽ для новых клиентов!\n\n`;
        }
      }

      // Можно добавить другие акции из настроек
      const promotions = await this.settingsService.get('promotions', []);
      if (Array.isArray(promotions) && promotions.length > 0) {
        promotions.forEach((promo: any) => {
          message += `🎯 ${promo.title || 'Акция'}\n`;
          if (promo.description) {
            message += `   ${promo.description}\n`;
          }
          message += '\n';
        });
      }

      if (message === `🎁 *Акции и скидки*\n\n`) {
        message += 'На данный момент нет активных акций.\n\n';
        message += '💡 Следите за обновлениями!';
      } else {
        message += '💡 Для записи используйте /book или перейдите в личный чат.';
      }

      const botInfo = await this.bot.telegram.getMe();
      const botUsername = botInfo.username;
      const keyboard = Markup.inlineKeyboard([
        [{ text: '📅 Записаться', switch_inline_query: 'book' }],
        [Markup.button.url('💬 Личный чат', `https://t.me/${botUsername}?start=book`)],
      ]);

      await ctx.reply(message, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке /promotions: ${error.message}`, error.stack);
      await ctx.reply('❌ Произошла ошибка при получении акций. Попробуйте позже.');
    }
  }

  /**
   * Обработка команды /faq - ответы на частые вопросы
   */
  private async handleFaqCommand(ctx: Context) {
    const isGroup = this.isGroupChat(ctx.chat);
    
    if (isGroup) {
      const enabled = await this.isCommandEnabled(ctx.chat.id.toString(), 'faq');
      if (!enabled) {
        await ctx.reply('❌ Команда /faq отключена для этой группы.');
        return;
      }
    }

    try {
      // Получаем FAQ из настроек или используем дефолтный
      const faq = await this.settingsService.get('faq', [
        {
          question: 'Как записаться на услугу?',
          answer: 'Используйте команду /book или кнопку "Записаться" в меню. Выберите услугу, мастера, дату и время.',
        },
        {
          question: 'Можно ли отменить запись?',
          answer: 'Да, используйте команду /cancel или выберите запись в списке и нажмите "Отменить".',
        },
        {
          question: 'Как перенести запись?',
          answer: 'Используйте команду /reschedule или выберите запись в списке и нажмите "Перенести".',
        },
        {
          question: 'Есть ли скидки для новых клиентов?',
          answer: 'Да! Для новых клиентов действует специальная скидка на первый визит. Используйте /promotions для подробностей.',
        },
        {
          question: 'Как посмотреть мои записи?',
          answer: 'Используйте команду /appointments или кнопку "Мои записи" в меню.',
        },
      ]);

      let message = `❓ *Часто задаваемые вопросы*\n\n`;

      if (Array.isArray(faq)) {
        faq.forEach((item: any, index: number) => {
          message += `${index + 1}. *${item.question || 'Вопрос'}*\n`;
          message += `   ${item.answer || 'Ответ'}\n\n`;
        });
      }

      message += '💡 Для записи используйте /book или перейдите в личный чат.';

      const botInfo = await this.bot.telegram.getMe();
      const botUsername = botInfo.username;
      const keyboard = Markup.inlineKeyboard([
        [{ text: '📅 Записаться', switch_inline_query: 'book' }],
        [Markup.button.url('💬 Личный чат', `https://t.me/${botUsername}?start=book`)],
      ]);

      await ctx.reply(message, {
        reply_markup: keyboard.reply_markup,
        parse_mode: 'Markdown',
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке /faq: ${error.message}`, error.stack);
      await ctx.reply('❌ Произошла ошибка при получении FAQ. Попробуйте позже.');
    }
  }

  /**
   * Отправляет приватный ответ пользователю в групповом чате
   * Если команда вызвана в группе, ответ отправляется через личные сообщения
   * Если в личном чате - обычным способом
   */
  private async sendPrivateReply(ctx: any, message: string, options?: any): Promise<void> {
    const isGroup = this.isGroupChat(ctx.chat);
    
    // Определяем parse_mode автоматически, если не указан явно в options
    const parseMode = options?.parse_mode || this.detectParseMode(message);
    
    const finalOptions = {
      parse_mode: parseMode,
      ...options, // options перезаписывает parse_mode, если он указан явно
    };
    
    if (isGroup) {
      // В групповом чате отправляем ответ через личные сообщения
      try {
        await this.bot.telegram.sendMessage(ctx.from.id, message, finalOptions);
      } catch (error: any) {
        // Если не удалось отправить личное сообщение (пользователь заблокировал бота)
        if (error.code === 403 || error.description?.includes('bot was blocked') || error.description?.includes('chat not found')) {
          // Отправляем ответ в группу с reply_to_message_id (видно только отправителю и в контексте его сообщения)
          await ctx.reply(message, {
            ...finalOptions,
            reply_to_message_id: ctx.message?.message_id,
          });
        } else {
          throw error;
        }
      }
    } else {
      // В личном чате отправляем обычным способом
      await ctx.reply(message, finalOptions);
    }
  }

  /**
   * Отправляет приватный ответ для callback-запросов
   * Если callback вызван из группы, ответ отправляется через личные сообщения
   * Если из личного чата - редактирует сообщение или отправляет новое
   */
  private async sendPrivateCallbackReply(ctx: any, message: string, keyboard?: any, options?: any): Promise<void> {
    const isGroup = this.isGroupChat(ctx.chat);
    
    if (isGroup) {
      // В групповом чате отправляем ответ через личные сообщения
      const isCallbackQuery = !!ctx.callbackQuery || 'callback_query' in ctx.update;
      try {
        // Подтверждаем нажатие кнопки только если это callback query
        if (isCallbackQuery) {
          await ctx.answerCbQuery();
        }
        await this.bot.telegram.sendMessage(ctx.from.id, message, {
          ...options,
          reply_markup: keyboard?.reply_markup,
        });
      } catch (error: any) {
        // Если не удалось отправить личное сообщение
        if (error.code === 403 || error.description?.includes('bot was blocked') || error.description?.includes('chat not found')) {
          if (isCallbackQuery) {
            await ctx.answerCbQuery('Пожалуйста, начните диалог с ботом в личных сообщениях');
          }
        } else {
          if (isCallbackQuery) {
            await ctx.answerCbQuery('Ошибка при отправке сообщения');
          }
          throw error;
        }
      }
    } else {
      // В личном чате пытаемся отредактировать сообщение или отправить новое
      const isCallbackQuery = !!ctx.callbackQuery || 'callback_query' in ctx.update;
      if (isCallbackQuery) {
        try {
          await ctx.editMessageText(message, {
            ...options,
            reply_markup: keyboard?.reply_markup,
          });
          await ctx.answerCbQuery();
        } catch (error) {
          // Если не можем отредактировать, отправляем новое сообщение
          await ctx.reply(message, {
            ...options,
            reply_markup: keyboard?.reply_markup,
          });
          await ctx.answerCbQuery();
        }
      } else {
        // Если это не callback query, отправляем новое сообщение
        await ctx.reply(message, {
          ...options,
          reply_markup: keyboard?.reply_markup,
        });
      }
    }
  }

  /**
   * Получает меню для группового чата (упрощенное)
   */
  private getGroupMenuKeyboard() {
    // В групповом чате не показываем reply-клавиатуру, только inline-кнопки
    return null;
  }

  /**
   * Получает меню для личного чата (полное)
   */
  private getPrivateChatMenuKeyboard() {
    return Markup.keyboard([
      [Markup.button.text('📅 Записаться'), Markup.button.text('📋 Мои записи')],
      [Markup.button.text('💆 Услуги'), Markup.button.text('👤 Профиль')],
      [Markup.button.text('ℹ️ Помощь')],
    ])
      .resize()
      .persistent()
      .oneTime(false);
  }

  /**
   * Просмотр актуальных (ближайших) записей для админа
   */
  private async handleAdminUpcomingAppointments(ctx: Context) {
    const telegramId = ctx.from!.id.toString();
    
    if (!(await this.isAdmin(telegramId))) {
      await ctx.answerCbQuery('Нет прав');
      return;
    }

    try {
      const now = new Date();
      
      // Получаем актуальные записи (не отмененные, не завершенные, начиная с текущего момента)
      const upcomingAppointments = await this.appointmentRepository.find({
        where: {
          status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED]),
          startTime: MoreThanOrEqual(now),
        },
        relations: ['client', 'master', 'service'],
        order: { startTime: 'ASC' },
        take: 20, // Показываем до 20 ближайших записей
      });

      if (upcomingAppointments.length === 0) {
        const message = '📋 *Актуальные записи*\n\nНет предстоящих записей.';
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Назад', 'admin:appointments')],
          [Markup.button.callback('🏠 Главное меню', 'admin:menu')],
        ]);

        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup,
        });
        return;
      }

      let message = `📋 *Актуальные записи*\n\nВсего: ${upcomingAppointments.length}\n\n`;
      
      upcomingAppointments.forEach((apt, index) => {
        const date = new Date(apt.startTime);
        const statusEmoji = apt.status === AppointmentStatus.PENDING 
          ? '⏳' 
          : apt.status === AppointmentStatus.CONFIRMED 
          ? '✅' 
          : '🔄';
        
        const statusText = apt.status === AppointmentStatus.PENDING 
          ? 'Ожидает' 
          : apt.status === AppointmentStatus.CONFIRMED 
          ? 'Подтверждена' 
          : 'Перенесена';

        message += `${index + 1}. ${statusEmoji} ${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}\n`;
        message += `   👤 ${(apt.client as any)?.firstName || 'Неизвестно'} ${(apt.client as any)?.lastName || ''}\n`;
        message += `   💆 ${(apt.service as any)?.name || 'Услуга'}\n`;
        message += `   👨‍💼 ${(apt.master as any)?.name || 'Мастер'}\n`;
        message += `   📊 ${statusText}\n\n`;
      });

      if (upcomingAppointments.length >= 20) {
        message += '\n... показаны первые 20 записей';
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'admin:upcoming')],
        [Markup.button.callback('◀️ Назад к записям', 'admin:appointments')],
        [Markup.button.callback('🏠 Главное меню', 'admin:menu')],
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
        link_preview_options: { is_disabled: true },
      });
    } catch (error: any) {
      this.logger.error(`Ошибка при получении актуальных записей: ${error.message}`);
      await ctx.answerCbQuery('Ошибка');
    }
  }
}
