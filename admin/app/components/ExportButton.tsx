'use client';

import { useState } from 'react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import { toast } from '@/lib/toast';

interface ExportButtonProps {
  data: any[][];
  filename: string;
  title?: string;
  headers?: string[];
  disabled?: boolean;
}

export function ExportButton({ data, filename, title, headers, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!data || data.length === 0) {
      toast.warning('Нет данных для экспорта');
      return;
    }

    setIsExporting(true);
    setShowMenu(false);

    try {
      switch (format) {
        case 'csv':
          exportToCSV(data, filename);
          break;
        case 'excel':
          await exportToExcel(data, filename);
          break;
        case 'pdf':
          await exportToPDF(data, filename, title || 'Отчет', headers);
          break;
      }
      toast.success('Экспорт выполнен успешно');
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Ошибка экспорта:', error);
      }
      toast.error(`Ошибка при экспорте: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled || isExporting || !data || data.length === 0}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Экспорт...
          </>
        ) : (
          <>
            📥 Экспорт
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-popover rounded-lg shadow-lg z-20 border border-border">
            <button
              onClick={() => handleExport('csv')}
              className="w-full text-left px-4 py-2 hover:bg-accent flex items-center gap-2"
            >
              📄 CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="w-full text-left px-4 py-2 hover:bg-accent flex items-center gap-2"
            >
              📊 Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="w-full text-left px-4 py-2 hover:bg-accent flex items-center gap-2"
            >
              📑 PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

