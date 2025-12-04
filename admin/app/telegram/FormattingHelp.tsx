'use client';

import { useState } from 'react';

export default function FormattingHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors rounded-lg"
      >
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <span>📝</span>
          <span>Форматирование текста и переменные Telegram</span>
        </h3>
        <span className="text-blue-600 dark:text-blue-400 text-lg">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 text-sm text-blue-800 dark:text-blue-300">
        {/* HTML теги */}
        <div>
          <p className="font-semibold mb-1">HTML теги:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;b&gt;жирный&lt;/b&gt;</code> или <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;strong&gt;жирный&lt;/strong&gt;</code></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;i&gt;курсив&lt;/i&gt;</code> или <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;em&gt;курсив&lt;/em&gt;</code></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;code&gt;код&lt;/code&gt;</code> - моноширинный текст</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;s&gt;зачеркнутый&lt;/s&gt;</code> или <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;strike&gt;зачеркнутый&lt;/strike&gt;</code> или <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;del&gt;зачеркнутый&lt;/del&gt;</code></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;u&gt;подчеркнутый&lt;/u&gt;</code></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;pre language="c++"&gt;код&lt;/pre&gt;</code> - блок кода</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">&lt;a href="https://example.com"&gt;ссылка&lt;/a&gt;</code> - ссылка</li>
          </ul>
        </div>

        {/* MarkdownV2 синтаксис (современный) */}
        <div>
          <p className="font-semibold mb-1">MarkdownV2 (рекомендуется):</p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">*жирный*</code> - жирный текст</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">_курсив_</code> - курсив</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">__подчеркнутый__</code> - подчеркнутый</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">~зачеркнутый~</code> - зачеркнутый</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">||спойлер||</code> - скрытый текст</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">`код`</code> - моноширинный текст</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">```код```</code> - блок кода</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">[текст](https://example.com)</code> - ссылка</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">[упоминание](tg://user?id=123456789)</code> - упоминание пользователя</li>
          </ul>
          <p className="text-xs mt-2 text-orange-600 dark:text-orange-400">
            ⚠️ <strong>Важно:</strong> В MarkdownV2 нужно экранировать спецсимволы: <code className="bg-orange-100 dark:bg-orange-900/40 px-1 rounded">_ * [ ] ( ) ~ ` > # + - = | { } . !</code>
          </p>
        </div>

        {/* Старый Markdown синтаксис */}
        <div>
          <p className="font-semibold mb-1">Старый Markdown (устаревший):</p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">**жирный**</code> - жирный текст</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">*курсив*</code> - курсив</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">_курсив_</code> - курсив</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">`код`</code> - моноширинный текст</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">~~зачеркнутый~~</code> - зачеркнутый</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">[текст](https://example.com)</code> - ссылка</li>
          </ul>
          <p className="text-xs mt-2 text-muted-foreground">
            💡 Рекомендуется использовать MarkdownV2 для лучшей поддержки всех форматов
          </p>
        </div>

        {/* Переменные */}
        <div>
          <p className="font-semibold mb-1">Доступные переменные:</p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{first_name}'}</code> - имя пользователя <span className="text-orange-600 dark:text-orange-400">(только в личных сообщениях)</span></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{last_name}'}</code> - фамилия пользователя <span className="text-orange-600 dark:text-orange-400">(только в личных сообщениях)</span></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{username}'}</code> - username пользователя <span className="text-orange-600 dark:text-orange-400">(только в личных сообщениях)</span></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{user_id}'}</code> - ID пользователя <span className="text-orange-600 dark:text-orange-400">(только в личных сообщениях)</span></li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{chat_id}'}</code> - ID чата</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{chat_title}'}</code> - название чата (для групп)</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{date}'}</code> - текущая дата</li>
            <li><code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{'{time}'}</code> - текущее время</li>
          </ul>
        </div>

        <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
          <p className="text-xs italic">
            💡 <strong>Совет:</strong> Вы можете комбинировать форматирование, например: 
            <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded mx-1">&lt;b&gt;&lt;i&gt;жирный курсив&lt;/i&gt;&lt;/b&gt;</code>
          </p>
        </div>
        </div>
      )}
    </div>
  );
}

