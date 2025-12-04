import { format } from 'date-fns';

// Утилита для экспорта данных в различных форматах

/**
 * Экспорт данных в CSV
 */
export function exportToCSV(data: any[][], filename: string) {
  const csv = data.map((row) => 
    row.map((cell) => {
      // Экранируем кавычки и запятые
      const cellStr = String(cell || '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');

  // Добавляем BOM для корректного отображения кириллицы в Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Экспорт данных в Excel (XLSX)
 */
export async function exportToExcel(data: any[][], filename: string, sheetName: string = 'Sheet1') {
  try {
    // Динамически импортируем xlsx только при необходимости
    const XLSX = await import('xlsx');
    
    // Создаем рабочую книгу
    const wb = XLSX.utils.book_new();
    
    // Создаем рабочий лист из данных
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Настраиваем ширину колонок
    const colWidths = data[0]?.map((_, colIndex) => {
      const maxLength = Math.max(
        ...data.map((row) => String(row[colIndex] || '').length)
      );
      return { wch: Math.min(Math.max(maxLength, 10), 50) };
    });
    ws['!cols'] = colWidths;
    
    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    // Сохраняем файл
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  } catch (error) {
    console.error('Ошибка при экспорте в Excel:', error);
    throw new Error('Не удалось экспортировать в Excel. Убедитесь, что библиотека xlsx установлена.');
  }
}

/**
 * Экспорт данных в PDF
 */
export async function exportToPDF(
  data: any[][],
  filename: string,
  title: string = 'Отчет',
  headers?: string[]
) {
  try {
    // Динамически импортируем jspdf только при необходимости
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // Настройки
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const startY = 20;
    let currentY = startY;
    
    // Заголовок
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, currentY);
    currentY += 10;
    
    // Дата
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Дата: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, margin, currentY);
    currentY += 10;
    
    // Таблица
    const cellHeight = 7;
    const colCount = data[0]?.length || 0;
    const colWidth = (pageWidth - 2 * margin) / colCount;
    
    // Заголовки (если есть)
    if (headers && headers.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      let x = margin;
      headers.forEach((header, index) => {
        doc.text(header, x + colWidth / 2, currentY, {
          align: 'center',
          maxWidth: colWidth - 2,
        });
        x += colWidth;
      });
      currentY += cellHeight;
    }
    
    // Данные
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    data.forEach((row, rowIndex) => {
      // Проверяем, нужно ли создать новую страницу
      if (currentY + cellHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
      }
      
      let x = margin;
      row.forEach((cell, colIndex) => {
        const cellText = String(cell || '');
        doc.text(cellText, x + colWidth / 2, currentY, {
          align: 'center',
          maxWidth: colWidth - 2,
        });
        x += colWidth;
      });
      currentY += cellHeight;
    });
    
    // Сохраняем файл
    doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Ошибка при экспорте в PDF:', error);
    throw new Error('Не удалось экспортировать в PDF. Убедитесь, что библиотека jspdf установлена.');
  }
}

/**
 * Экспорт записей
 */
export function exportAppointments(appointments: any[]) {
  const data = [
    ['ID', 'Клиент', 'Телефон', 'Услуга', 'Мастер', 'Дата и время', 'Статус', 'Цена', 'Создано'],
    ...appointments.map((apt) => [
      apt.id,
      `${apt.client?.firstName || ''} ${apt.client?.lastName || ''}`.trim(),
      apt.client?.phone || '',
      apt.service?.name || '',
      apt.master?.name || '',
      apt.startTime ? format(new Date(apt.startTime), 'dd.MM.yyyy HH:mm') : '',
      apt.status || '',
      apt.price || 0,
      apt.createdAt ? format(new Date(apt.createdAt), 'dd.MM.yyyy HH:mm') : '',
    ]),
  ];
  return data;
}

/**
 * Экспорт клиентов
 */
export function exportClients(clients: any[]) {
  const data = [
    ['ID', 'Имя', 'Фамилия', 'Телефон', 'Email', 'Бонусы', 'Telegram ID', 'Дата регистрации'],
    ...clients.map((client) => [
      client.id,
      client.firstName || '',
      client.lastName || '',
      client.phone || '',
      client.email || '',
      client.bonusPoints || 0,
      client.telegramId || '',
      client.createdAt ? format(new Date(client.createdAt), 'dd.MM.yyyy HH:mm') : '',
    ]),
  ];
  return data;
}

/**
 * Экспорт мастеров
 */
export function exportMasters(masters: any[]) {
  const data = [
    ['ID', 'Имя', 'Специализация', 'Опыт (лет)', 'Рейтинг', 'Активен', 'Образование', 'Услуги'],
    ...masters.map((master) => [
      master.id,
      master.name || '',
      master.specialization || (master.specialties?.join(', ') || ''),
      master.experience || 0,
      master.rating || 0,
      master.isActive ? 'Да' : 'Нет',
      master.education || '',
      master.services?.map((s: any) => s.name).join(', ') || '',
    ]),
  ];
  return data;
}

/**
 * Экспорт услуг
 */
export function exportServices(services: any[]) {
  const data = [
    ['ID', 'Название', 'Описание', 'Цена', 'Длительность (мин)', 'Активна', 'Мастера'],
    ...services.map((service) => [
      service.id,
      service.name || '',
      service.description || '',
      service.price || 0,
      service.duration || 0,
      service.isActive ? 'Да' : 'Нет',
      service.masters?.map((m: any) => m.name).join(', ') || '',
    ]),
  ];
  return data;
}

