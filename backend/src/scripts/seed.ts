import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';
import { User, UserRole } from '../entities/user.entity';
import { Service } from '../entities/service.entity';
import { Master } from '../entities/master.entity';
import { WorkSchedule, DayOfWeek } from '../entities/work-schedule.entity';
import * as bcrypt from 'bcrypt';

// Загружаем переменные окружения
config({ path: resolve(__dirname, '../../../.env') });

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'afrodita',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Подключение к базе данных установлено');

    // Очистка существующих данных (опционально)
    // await dataSource.getRepository(WorkSchedule).delete({});
    // await dataSource.getRepository(Master).delete({});
    // await dataSource.getRepository(Service).delete({});
    // await dataSource.getRepository(User).delete({});

    // Создание администратора
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin';
    
    let admin = await dataSource.getRepository(User).findOne({
      where: { email: adminEmail },
    });

    if (!admin) {
      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      admin = dataSource.getRepository(User).create({
        telegramId: `admin_${Date.now()}`, // Фиктивный telegramId для админа
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Администратор',
        lastName: 'Системы',
        phone: '+79999999999',
        role: UserRole.ADMIN,
        isActive: true,
      });
      admin = await dataSource.getRepository(User).save(admin);
      console.log('✅ Администратор создан');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Пароль: ${adminPassword}`);
    } else {
      // Всегда обновляем пароль для админа, чтобы гарантировать правильный пароль
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      admin.password = hashedPassword;
      admin.email = adminEmail; // Убеждаемся, что email правильный
      admin.role = UserRole.ADMIN; // Убеждаемся, что роль правильная
      admin.isActive = true;
      admin = await dataSource.getRepository(User).save(admin);
      console.log('✅ Администратор обновлен');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Пароль: ${adminPassword}`);
    }

    // Создание услуг
    const servicesData = [
      {
        name: 'Классический массаж',
        description: 'Классический массаж всего тела для расслабления и снятия напряжения. Подходит для всех возрастов.',
        duration: 60,
        price: 2500,
        category: 'Расслабляющий',
        bonusPointsPercent: 5,
      },
      {
        name: 'Лечебный массаж',
        description: 'Специализированный массаж для лечения и профилактики заболеваний опорно-двигательного аппарата.',
        duration: 60,
        price: 3000,
        category: 'Лечебный',
        bonusPointsPercent: 5,
      },
      {
        name: 'Антицеллюлитный массаж',
        description: 'Интенсивный массаж проблемных зон для улучшения состояния кожи и уменьшения целлюлита.',
        duration: 90,
        price: 3500,
        category: 'Коррекционный',
        bonusPointsPercent: 7,
      },
      {
        name: 'Спортивный массаж',
        description: 'Массаж для спортсменов: разминка перед тренировкой или восстановление после нагрузок.',
        duration: 60,
        price: 2800,
        category: 'Спортивный',
        bonusPointsPercent: 5,
      },
      {
        name: 'Релакс-массаж',
        description: 'Расслабляющий массаж с ароматерапией для полного снятия стресса и напряжения.',
        duration: 90,
        price: 4000,
        category: 'Расслабляющий',
        bonusPointsPercent: 7,
      },
      {
        name: 'Массаж спины',
        description: 'Специализированный массаж спины для снятия напряжения и болей в мышцах.',
        duration: 45,
        price: 2000,
        category: 'Лечебный',
        bonusPointsPercent: 5,
      },
      {
        name: 'Массаж ног',
        description: 'Массаж ног для снятия усталости и улучшения кровообращения.',
        duration: 45,
        price: 1800,
        category: 'Расслабляющий',
        bonusPointsPercent: 5,
      },
      {
        name: 'Массаж головы и шеи',
        description: 'Расслабляющий массаж головы и шеи для снятия головных болей и напряжения.',
        duration: 30,
        price: 1500,
        category: 'Расслабляющий',
        bonusPointsPercent: 5,
      },
    ];

    const services: Service[] = [];
    for (const serviceData of servicesData) {
      let service = await dataSource.getRepository(Service).findOne({
        where: { name: serviceData.name },
      });

      if (!service) {
        service = dataSource.getRepository(Service).create(serviceData);
        service = await dataSource.getRepository(Service).save(service);
        console.log(`✅ Услуга создана: ${service.name}`);
      } else {
        console.log(`ℹ️  Услуга уже существует: ${service.name}`);
      }
      services.push(service);
    }

    // Создание мастеров
    const mastersData = [
      {
        name: 'Анна Петрова',
        bio: 'Опытный мастер с медицинским образованием. Специализируется на лечебном массаже и работе с проблемами опорно-двигательного аппарата.',
        experience: 8,
        specialties: ['Классический массаж', 'Лечебный массаж'],
        serviceNames: ['Классический массаж', 'Лечебный массаж', 'Массаж спины'],
        rating: 4.8,
        breakDuration: 15,
      },
      {
        name: 'Мария Иванова',
        bio: 'Мастер премиум-класса с сертификатами по антицеллюлитному и релакс-массажу. Использует ароматерапию и премиум масла.',
        experience: 5,
        specialties: ['Антицеллюлитный массаж', 'Релакс-массаж'],
        serviceNames: ['Антицеллюлитный массаж', 'Релакс-массаж', 'Массаж ног'],
        rating: 4.9,
        breakDuration: 20,
      },
      {
        name: 'Елена Смирнова',
        bio: 'Профессиональный спортивный массажист. Работала с профессиональными спортсменами. Специализируется на восстановлении после тренировок.',
        experience: 10,
        specialties: ['Спортивный массаж', 'Массаж спины'],
        serviceNames: ['Спортивный массаж', 'Массаж спины', 'Лечебный массаж'],
        rating: 4.7,
        breakDuration: 15,
      },
      {
        name: 'Ольга Козлова',
        bio: 'Специалист по снятию головных болей и напряжения. Использует техники точечного массажа и ароматерапию.',
        experience: 6,
        specialties: ['Массаж головы и шеи', 'Релакс-массаж'],
        serviceNames: ['Массаж головы и шеи', 'Релакс-массаж', 'Классический массаж'],
        rating: 4.6,
        breakDuration: 15,
      },
    ];

    const masters: Master[] = [];
    for (let i = 0; i < mastersData.length; i++) {
      const masterData = mastersData[i];
      // Проверяем, существует ли пользователь для мастера
      const phoneNumber = `+7999${i}0000000`;
      let user = await dataSource.getRepository(User).findOne({
        where: { phone: phoneNumber },
      });

      if (!user) {
        user = dataSource.getRepository(User).create({
          telegramId: `master_${i}_${Date.now()}`,
          firstName: masterData.name.split(' ')[0],
          lastName: masterData.name.split(' ')[1] || '',
          phone: phoneNumber,
          role: UserRole.MASTER,
          isActive: true,
        });
        user = await dataSource.getRepository(User).save(user);
        console.log(`✅ Пользователь создан для мастера: ${masterData.name}`);
      }

      // Создаем или обновляем мастера
      let master = await dataSource.getRepository(Master).findOne({
        where: { userId: user.id },
      });

      if (!master) {
        master = dataSource.getRepository(Master).create({
          userId: user.id,
          name: masterData.name,
          bio: masterData.bio,
          experience: masterData.experience,
          specialties: masterData.specialties,
          rating: masterData.rating,
          breakDuration: masterData.breakDuration,
          isActive: true,
        });
        master = await dataSource.getRepository(Master).save(master);
        console.log(`✅ Мастер создан: ${master.name}`);
      } else {
        console.log(`ℹ️  Мастер уже существует: ${master.name}`);
      }

      // Связываем мастера с услугами
      const masterServices = services.filter((s) =>
        masterData.serviceNames.includes(s.name),
      );
      master.services = masterServices;
      await dataSource.getRepository(Master).save(master);

      masters.push(master);
    }

    // Создание расписания для мастеров
    const defaultSchedule = [
      { day: DayOfWeek.MONDAY, start: '09:00', end: '18:00' },
      { day: DayOfWeek.TUESDAY, start: '09:00', end: '18:00' },
      { day: DayOfWeek.WEDNESDAY, start: '09:00', end: '18:00' },
      { day: DayOfWeek.THURSDAY, start: '09:00', end: '18:00' },
      { day: DayOfWeek.FRIDAY, start: '09:00', end: '18:00' },
      { day: DayOfWeek.SATURDAY, start: '10:00', end: '16:00' },
    ];

    for (const master of masters) {
      const existingSchedule = await dataSource
        .getRepository(WorkSchedule)
        .find({ where: { masterId: master.id } });

      if (existingSchedule.length === 0) {
        for (const scheduleData of defaultSchedule) {
          const schedule = dataSource.getRepository(WorkSchedule).create({
            masterId: master.id,
            dayOfWeek: scheduleData.day,
            startTime: scheduleData.start,
            endTime: scheduleData.end,
            isActive: true,
          });
          await dataSource.getRepository(WorkSchedule).save(schedule);
        }
        console.log(`✅ Расписание создано для мастера: ${master.name}`);
      } else {
        console.log(`ℹ️  Расписание уже существует для мастера: ${master.name}`);
      }
    }

    console.log('\n✅ Seed выполнен успешно!');
    console.log('\n📊 Статистика:');
    console.log(`   - Услуг: ${services.length}`);
    console.log(`   - Мастеров: ${masters.length}`);
    console.log(`   - Расписаний: ${masters.length * defaultSchedule.length}`);

    console.log('\n📝 Примечание:');
    console.log('   Система использует Telegram авторизацию');
    console.log('   Пользователи входят через Telegram WebApp');
  } catch (error) {
    console.error('❌ Ошибка при выполнении seed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Запуск seed скрипта
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Скрипт завершен');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

export { seed };

