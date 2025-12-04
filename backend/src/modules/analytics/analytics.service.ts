import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Master } from '../../entities/master.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
  ) {}

  async getDashboardStats(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(new Date().setDate(1));
    const end = endDate || new Date();

    const [appointments, revenue, masters] = await Promise.all([
      this.appointmentRepository.find({
        where: {
          startTime: Between(start, end),
        },
        relations: ['service', 'master'],
      }),
      this.transactionRepository
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amount)', 'total')
        .where('transaction.type = :type', { type: TransactionType.PAYMENT })
        .andWhere('transaction.createdAt BETWEEN :start AND :end', { start, end })
        .getRawOne(),
      this.masterRepository.find({
        where: { isActive: true },
      }),
    ]);

    const completed = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
    const cancelled = appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length;
    const pending = appointments.filter((a) => a.status === AppointmentStatus.PENDING).length;
    const confirmed = appointments.filter((a) => a.status === AppointmentStatus.CONFIRMED).length;

    // Данные для графика по дням (последние 7 дней)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(end);
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const appointmentsByDay = last7Days.map((day) => {
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      return appointments.filter(
        (apt) => apt.startTime >= day && apt.startTime <= dayEnd,
      ).length;
    });

    const revenueByDay = last7Days.map((day) => {
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      return appointments
        .filter((apt) => apt.startTime >= day && apt.startTime <= dayEnd && apt.status === AppointmentStatus.COMPLETED)
        .reduce((sum, apt) => sum + Number(apt.price || 0), 0);
    });

    // Статистика по мастерам
    const masterStats = masters.map((master) => {
      const masterAppointments = appointments.filter((apt) => apt.masterId === master.id);
      const masterCompleted = masterAppointments.filter((apt) => apt.status === AppointmentStatus.COMPLETED);
      const masterRevenue = masterCompleted.reduce((sum, apt) => sum + Number(apt.price || 0), 0);
      return {
        masterId: master.id,
        masterName: master.name,
        masterPhotoUrl: master.photoUrl,
        totalAppointments: masterAppointments.length,
        completedAppointments: masterCompleted.length,
        revenue: masterRevenue,
      };
    });

    // Статистика по услугам
    const serviceStatsMap = new Map<string, { name: string; count: number; revenue: number }>();
    appointments
      .filter((apt) => apt.status === AppointmentStatus.COMPLETED)
      .forEach((apt) => {
        const serviceId = apt.serviceId;
        const serviceName = apt.service?.name || 'Неизвестная услуга';
        const existing = serviceStatsMap.get(serviceId) || { name: serviceName, count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += Number(apt.price || 0);
        serviceStatsMap.set(serviceId, existing);
      });

    const serviceStats = Array.from(serviceStatsMap.values()).sort((a, b) => b.revenue - a.revenue);

    return {
      totalAppointments: appointments.length,
      completedAppointments: completed,
      cancelledAppointments: cancelled,
      pendingAppointments: pending,
      confirmedAppointments: confirmed,
      revenue: Math.abs(revenue?.total || 0),
      activeMasters: masters.length,
      completionRate: appointments.length > 0 ? (completed / appointments.length) * 100 : 0,
      // Данные для графиков
      appointmentsByDay: {
        labels: last7Days.map((d) => d.toLocaleDateString('ru-RU', { weekday: 'short' })),
        data: appointmentsByDay,
      },
      revenueByDay: {
        labels: last7Days.map((d) => d.toLocaleDateString('ru-RU', { weekday: 'short' })),
        data: revenueByDay,
      },
      statusDistribution: {
        completed,
        cancelled,
        pending,
        confirmed,
      },
      masterStats: masterStats.sort((a, b) => b.revenue - a.revenue).slice(0, 10), // Топ 10 мастеров
      serviceStats: serviceStats.slice(0, 10), // Топ 10 услуг
    };
  }

  async getMasterLoad(masterId: string, startDate: Date, endDate: Date) {
    const appointments = await this.appointmentRepository.find({
      where: {
        masterId,
        startTime: Between(startDate, endDate),
        status: AppointmentStatus.COMPLETED,
      },
    });

    const totalMinutes = appointments.reduce((sum, apt) => {
      const duration = (new Date(apt.endTime).getTime() - new Date(apt.startTime).getTime()) / 60000;
      return sum + duration;
    }, 0);

    return {
      totalAppointments: appointments.length,
      totalMinutes,
      totalHours: totalMinutes / 60,
    };
  }
}

