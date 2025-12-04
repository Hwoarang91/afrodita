# UI Resources Guide

## Инструкции по запуску

Этот документ содержит информацию о ресурсах для разработки пользовательского интерфейса. Для использования этих ресурсов следуйте инструкциям в соответствующих разделах.

## Общая информация

Назначение проекта: Справочник по современным инструментам и принципам разработки пользовательского интерфейса.

Технологический стек:
- Lucide Icons — библиотека иконок
- Tailwind CSS — utility-first CSS фреймворк
- shadcn/ui — компоненты на базе Radix UI и Tailwind CSS
- Next.js — React фреймворк
- Vite — инструмент сборки

Архитектура: Документация организована по категориям инструментов и принципов дизайна.

Важные детали: Все инструменты поддерживают tree-shaking, доступность и кастомизацию.

## FRONTEND

### Lucide Icons

#### Описание
Lucide — open-source библиотека иконок для веб-приложений. Поддерживает множество фреймворков и vanilla JavaScript.

#### Установка

Package Managers:
```bash
pnpm add lucide
# или
npm install lucide
# или
yarn add lucide
```

CDN:
```html
<!-- Development version -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>

<!-- Production version -->
<script src="https://unpkg.com/lucide@latest"></script>
```

#### Использование

Vanilla JavaScript:
```javascript
import { createIcons, Menu, ArrowRight, Globe } from 'lucide';

createIcons({
  icons: {
    Menu,
    ArrowRight,
    Globe
  }
});
```

HTML с data-атрибутами:
```html
<i data-lucide="menu"></i>
<i data-lucide="arrow-right"></i>
```

React:
```typescript
import { Menu, ArrowRight } from 'lucide-react'

function MyComponent() {
  return (
    <div>
      <Menu className="h-6 w-6" />
      <ArrowRight className="h-4 w-4" />
    </div>
  )
}
```

#### Особенности
- Tree-shakable — импортируйте только нужные иконки
- Поддержка React, Vue, Angular, Svelte, Solid
- Настраиваемые размеры, цвета, stroke-width
- Доступность (accessibility) встроена
- Более 1000 иконок

#### Пакеты для фреймворков
- `lucide-react` — для React
- `lucide-vue-next` — для Vue 3
- `lucide-angular` — для Angular
- `lucide-svelte` — для Svelte
- `lucide-solid` — для SolidJS
- `lucide-react-native` — для React Native

#### Документация
- Официальный сайт: https://lucide.dev
- Иконки: https://lucide.dev/icons/
- Руководство: https://lucide.dev/guide/packages/lucide

### Tailwind CSS

#### Описание
Utility-first CSS фреймворк для быстрой разработки интерфейсов. Генерирует только используемые стили.

#### Установка с Vite

1. Создание проекта:
```bash
npm create vite@latest my-project
cd my-project
```

2. Установка Tailwind CSS:
```bash
npm install tailwindcss @tailwindcss/vite
```

3. Настройка Vite:
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
})
```

4. Импорт в CSS:
```css
@import "tailwindcss";
```

5. Запуск:
```bash
npm run dev
```

#### Основные концепции
- Utility-first подход
- Responsive design с префиксами (sm:, md:, lg:, xl:, 2xl:)
- Dark mode поддержка
- Кастомизация через конфигурацию
- Zero-runtime — стили генерируются на этапе сборки
- JIT (Just-In-Time) компиляция

#### UI Blocks
Tailwind Plus предоставляет готовые UI блоки для разработки приложений.

**Application UI — полная структура:**

**Application Shells (23 компонента):**
- Stacked Layouts — 9 компонентов
- Sidebar Layouts — 8 компонентов
- Multi-Column Layouts — 6 компонентов

**Headings (25 компонентов):**
- Page Headings — 9 компонентов
- Card Headings — 6 компонентов
- Section Headings — 10 компонентов

**Data Display (19 компонентов):**
- Description Lists — 6 компонентов
- Stats — 5 компонентов
- Calendars — 8 компонентов

**Lists (50 компонентов):**
- Stacked Lists — 15 компонентов
- Tables — 19 компонентов
- Grid Lists — 7 компонентов
- Feeds — 3 компонента

**Forms (70 компонентов):**
- Form Layouts — 4 компонента
- Input Groups — 21 компонент
- Select Menus — 7 компонентов
- Sign-in and Registration — 4 компонента
- Textareas — 5 компонентов
- Radio Groups — 12 компонентов
- Checkboxes — 4 компонента
- Toggles — 5 компонентов
- Action Panels — 8 компонентов
- Comboboxes — 4 компонента

**Feedback (12 компонентов):**
- Alerts — 6 компонентов
- Empty States — 6 компонентов

**Navigation (52 компонента):**
- Navbars — 11 компонентов
- Pagination — 3 компонента
- Tabs — 9 компонентов
- Vertical Navigation — 6 компонентов
- Sidebar Navigation — 5 компонентов
- Breadcrumbs — 4 компонента
- Progress Bars — 8 компонентов
- Command Palettes — 8 компонентов

**Overlays (24 компонента):**
- Modal Dialogs — 6 компонентов
- Drawers — 12 компонентов
- Notifications — 6 компонентов

**Elements (50 компонентов):**
- Avatars — 11 компонентов
- Badges — 16 компонентов
- Dropdowns — 5 компонентов
- Buttons — 8 компонентов
- Button Groups — 5 компонентов

**Layout (38 компонентов):**
- Containers — 5 компонентов
- Cards — 10 компонентов
- List containers — 7 компонентов
- Media Objects — 8 компонентов
- Dividers — 8 компонентов

**Page Examples (6 примеров):**
- Home Screens — 2 примера
- Detail Screens — 2 примера
- Settings Screens — 2 примера

**Всего:** более 360 готовых компонентов и примеров для разработки приложений.

#### Breakpoints
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px
- 2xl: 1536px

#### Документация
- Официальный сайт: https://tailwindcss.com
- Документация: https://tailwindcss.com/docs
- Установка с Vite: https://tailwindcss.com/docs/installation/using-vite
- UI Blocks: https://tailwindcss.com/plus/ui-blocks/application-ui

### shadcn/ui

#### Описание
Коллекция переиспользуемых компонентов, построенных на Radix UI и Tailwind CSS. Компоненты копируются в проект, а не устанавливаются как зависимость.

#### Установка для Next.js

1. Инициализация:
```bash
pnpm dlx shadcn@latest init
# или
npx shadcn@latest init
```

2. Добавление компонентов:
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add input
```

3. Использование:
```typescript
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div>
      <Button>Click me</Button>
    </div>
  )
}
```

#### Конфигурация

components.json:
Файл конфигурации для настройки путей и стилей компонентов. Содержит настройки:
- Пути к компонентам
- Стили (default, new-york)
- Цветовая схема
- CSS переменные

Theming:

**CSS Variables (рекомендуется):**
- Использование CSS переменных для темизации
- Настройка через `tailwind.cssVariables: true` в `components.json`
- Использование классов `bg-background`, `text-foreground`
- Переменные доступны через `var(--variable-name)`

**Utility Classes (альтернатива):**
- Использование utility классов Tailwind
- Настройка через `tailwind.cssVariables: false` в `components.json`
- Использование классов `bg-zinc-950`, `dark:bg-white`

**Convention:**
- Простая конвенция `background` и `foreground` для цветов
- Переменная `background` используется для фона компонента
- Переменная `foreground` используется для цвета текста
- Суффикс `background` опускается при использовании для фона компонента

**Список переменных:**
- `--radius` — радиус скругления
- `--background` / `--foreground` — основной фон и текст
- `--card` / `--card-foreground` — фон и текст карточек
- `--popover` / `--popover-foreground` — фон и текст всплывающих окон
- `--primary` / `--primary-foreground` — основной цвет и текст
- `--secondary` / `--secondary-foreground` — вторичный цвет и текст
- `--muted` / `--muted-foreground` — приглушенный цвет и текст
- `--accent` / `--accent-foreground` — акцентный цвет и текст
- `--destructive` / `--destructive-foreground` — цвет ошибок и текст
- `--border` — цвет границ
- `--input` — цвет полей ввода
- `--ring` — цвет фокуса
- `--chart-1` до `--chart-5` — цвета для графиков
- `--sidebar-*` — переменные для боковой панели (sidebar, foreground, primary, accent, border, ring)

**Добавление новых цветов:**
- Добавление в `:root` и `.dark` псевдоклассы в CSS файле
- Использование директивы `@theme inline` для доступности как CSS переменных
- Пример: `--warning` и `--warning-foreground` с использованием `@theme inline`

**Форматы цветов:**
- Поддержка OKLCH цветовой модели (рекомендуется)
- Поддержка других форматов через документацию Tailwind CSS

**Базовые цвета:**
- Neutral — нейтральная палитра
- Stone — каменная палитра
- Zinc — цинковая палитра
- Gray — серая палитра
- Slate — сланцевая палитра

Dark Mode:
- Встроенная поддержка темной темы через Next.js
- Использование next-themes
- Автоматическое переключение
- Поддержка системной темы

#### Компоненты
Доступно более 60 компонентов:

**Основные компоненты:**
- Accordion — вертикально сложенные интерактивные заголовки с раскрывающимся контентом
- Alert Dialog — диалоговое окно для подтверждения действий
- Alert — уведомления и предупреждения
- Aspect Ratio — поддержание соотношения сторон
- Avatar — изображения профилей пользователей
- Badge — метки и теги
- Breadcrumb — навигационные цепочки
- Button Group — группы кнопок (новый)
- Button — кнопки с различными вариантами
- Calendar — календарь для выбора дат
- Card — карточки для контента
- Carousel — карусель изображений
- Chart — графики и диаграммы
- Checkbox — чекбоксы
- Collapsible — раскрывающиеся секции
- Combobox — комбинированный ввод с автодополнением
- Command — командная палитра
- Context Menu — контекстное меню
- Data Table — таблицы данных
- Date Picker — выбор даты
- Dialog — модальные окна
- Drawer — выдвижные панели
- Dropdown Menu — выпадающие меню
- Empty — пустые состояния (новый)
- Field — поля форм (новый)
- Form — управление формами
- Hover Card — карточки при наведении
- Input Group — группы полей ввода (новый)
- Input OTP — ввод OTP кодов
- Input — поля ввода текста
- Item — элементы списков (новый)
- Kbd — отображение клавиш (новый)
- Label — метки для полей
- Menubar — панель меню
- Native Select — нативный select (новый)
- Navigation Menu — навигационное меню
- Pagination — пагинация
- Popover — всплывающие окна
- Progress — индикаторы прогресса
- Radio Group — группы радиокнопок
- Resizable — изменяемые размеры панелей
- Scroll Area — области прокрутки
- Select — выпадающие списки
- Separator — разделители
- Sheet — боковые панели
- Sidebar — боковая панель навигации
- Skeleton — скелетоны загрузки
- Slider — слайдеры значений
- Sonner — уведомления (toast)
- Spinner — индикаторы загрузки (новый)
- Switch — переключатели
- Table — таблицы
- Tabs — вкладки
- Textarea — многострочные поля ввода
- Toast — уведомления
- Toggle Group — группы переключателей
- Toggle — переключатели
- Tooltip — всплывающие подсказки
- Typography — типографика

#### Charts
Интеграция с Recharts для создания графиков:
- Line charts
- Bar charts
- Pie charts
- Area charts
- Настраиваемые темы

#### Blocks
Готовые блоки интерфейса для быстрой разработки:
- Dashboard layouts
- Landing pages
- Forms
- Navigation
- Authentication pages

#### Directory
Каталог компонентов с примерами использования и вариантами стилей.

#### Документация
- Официальный сайт: https://ui.shadcn.com
- Установка: https://ui.shadcn.com/docs/installation/next
- Компоненты: https://ui.shadcn.com/docs/components
- Theming: https://ui.shadcn.com/docs/theming
- Dark Mode: https://ui.shadcn.com/docs/dark-mode/next
- Charts: https://ui.shadcn.com/docs/components/chart
- Blocks: https://ui.shadcn.com/docs/blocks
- Directory: https://ui.shadcn.com/docs/directory
- components.json: https://ui.shadcn.com/docs/components-json

### Can I Use

#### Описание
Сервис для проверки совместимости веб-технологий с различными браузерами. Предоставляет таблицы поддержки для HTML5, CSS3, JavaScript API и других веб-технологий.

#### Основные функции
- Проверка поддержки CSS свойств
- Проверка поддержки JavaScript API
- Проверка поддержки HTML5 функций
- Статистика использования браузеров
- Сравнение браузеров
- Индекс функций

#### Использование
1. Поиск функции по названию
2. Просмотр таблицы поддержки браузерами
3. Проверка статистики использования
4. Сравнение версий браузеров

#### Браузеры
Поддерживает проверку для:
- Chrome
- Firefox
- Safari
- Edge
- Opera
- Mobile браузеры

#### Особенности
- Актуальные данные о поддержке
- Информация о частичной поддержке
- Примечания и известные проблемы
- Ссылки на спецификации
- Интеграция с BrowserStack для тестирования

#### Документация
- Официальный сайт: https://caniuse.com
- Индекс функций: https://caniuse.com/ciu/index
- Сравнение браузеров: https://caniuse.com/ciu/comparison

### Refactoring UI

#### Описание
Книга и ресурсы о дизайне пользовательских интерфейсов от создателей Tailwind CSS (Adam Wathan и Steve Schoger). Фокус на практических тактиках, а не на таланте.

#### Основные принципы

Design with tactics, not talent:
- Конкретные тактики вместо абстрактных принципов
- Практические советы для разработчиков
- Примеры до и после

Основные разделы книги:

1. Starting from Scratch
- Start with a feature, not a layout
- Detail comes later
- Don't design too much
- Choose a personality
- Limit your choices

2. Hierarchy is Everything
- Not all elements are equal
- Size isn't everything
- Don't use grey text on colored backgrounds
- De-emphasize to emphasize
- Labels are a last resort
- Separate visual hierarchy from document hierarchy
- Balance weight and contrast
- Semantics are secondary

3. Layout and Spacing
- Start with too much white space
- Establish a spacing and sizing system
- You don't have to fill the whole screen
- Grids are overrated
- Relative sizing doesn't scale
- Avoid ambiguous spacing

4. Designing Text
- Establish a type scale
- Use good fonts
- Keep your line length in check
- Baseline, not center
- Line-height is proportional
- Not every link needs a color
- Align with readability in mind
- Use letter-spacing effectively

5. Working with Color
- Ditch hex for HSL
- You need more colors than you think
- Define your shades up front
- Don't let lightness kill your saturation
- Greys don't have to be grey
- Accessible doesn't have to mean ugly
- Don't rely on color alone

6. Creating Depth
- Emulate a light source
- Use shadows to convey elevation
- Shadows can have two parts
- Even flat designs can have depth
- Overlap elements to create layers

7. Working with Images
- Use good photos
- Text needs consistent contrast
- Everything has an intended size
- Beware user-uploaded content

8. Finishing Touches
- Supercharge the defaults
- Add color with accent borders
- Decorate your backgrounds
- Don't overlook empty states
- Use fewer borders
- Think outside the box

#### Ресурсы в комплекте
- 218-страничная книга в PDF формате
- Видео туториалы (3 видео)
- Component Gallery (200+ компонентов)
- Color Palettes (12+ палитр)
- Font Suggestions (30+ шрифтов)
- Custom Icons (200 SVG иконок)

#### Ключевые тактики

Use fewer borders:
Бордеры — хороший способ различать элементы, но слишком много бордеров делает дизайн перегруженным. Вместо этого используйте:
- Box shadows
- Контрастные цвета фона
- Больше пространства между элементами

#### Документация
- Официальный сайт: https://www.refactoringui.com
- Блог: https://medium.com/@refactoringui
- Twitter tips: https://twitter.com/i/moments/994601867987619840

### Laws of UX

#### Описание
Собрание принципов и законов UX дизайна. Основано на психологии и когнитивной науке.

#### Основные законы
- Закон Якоба — пользователи предпочитают знакомые интерфейсы
- Закон Миллера — ограничение рабочей памяти (7±2 элемента)
- Закон Фиттса — время достижения цели зависит от расстояния и размера
- Закон Хика — время принятия решения увеличивается с количеством вариантов
- Закон Паркинсона — работа заполняет доступное время
- Эстетико-практический эффект — красивые интерфейсы воспринимаются как более удобные
- Эффект последовательности позиций — пользователи лучше запоминают первый и последний элементы
- Правило пика и конца — пользователи судят об опыте по пиковому моменту и концу

#### Onboarding для активных пользователей

Парадокс активного пользователя:
Тенденция пользователей не читать инструкции, а сразу начинать использовать программное обеспечение. Определен Mary Beth Rosson и John Carroll в 1987 году.

Проблемы традиционного онбординга:
- Product tours мешают активным пользователям
- Пользователи не читают информацию заранее
- Принудительное прохождение тура блокирует использование продукта

Решения для активных пользователей:

1. Tooltips (Всплывающие подсказки):
- Легковесный способ предоставления информации
- Контекстно-релевантная помощь
- Низкое трение
- Помогают в обнаружении новых функций
- Примеры: Uber, Zomato, Spotify

2. Progressive Onboarding (Прогрессивный онбординг):
- Постепенное знакомство с платформой
- Раскрытие функций в нужное время
- Создание уверенности при навигации
- Пример: Slack с Slackbot

3. Getting Started Templates (Шаблоны для начала):
- Чеклисты для изучения основных функций
- Безопасная среда для обучения
- Активное обучение через использование
- Защита от перегрузки
- Пример: Notion

Принципы:
- Делайте руководство доступным на протяжении всего опыта
- Проектируйте руководство в контексте использования
- Не создавайте продукты для идеализированного пользователя
- Учитывайте парадокс активного пользователя

#### Документация
- Официальный сайт: https://lawsofux.com
- Статья об онбординге: https://lawsofux.com/articles/2024/onboarding-for-active-users/
- Книга: https://lawsofux.com/book/
- Карточки: https://lawsofux.com/cards/

## Интеграция инструментов

### Lucide + Tailwind + shadcn/ui

Пример интеграции:
```typescript
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

export function SearchButton() {
  return (
    <Button className="flex items-center gap-2">
      <Search className="h-4 w-4" />
      Search
    </Button>
  )
}
```

### Полный пример компонента

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, Settings, User } from "lucide-react"

export function UserCard() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          User Profile
        </CardTitle>
        <CardDescription>User information and settings</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" className="flex-1">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        <Button variant="outline">
          <Settings className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
```

## Best Practices

### Производительность
1. Используйте tree-shaking для иконок — импортируйте только нужные
2. Tailwind генерирует только используемые стили
3. shadcn/ui компоненты копируются в проект (не зависимость)
4. Проверяйте размер бандла

### Доступность
1. Lucide иконки поддерживают accessibility
2. shadcn/ui построен на Radix UI (accessibility-first)
3. Tailwind предоставляет утилиты для accessibility
4. Используйте семантический HTML
5. Добавляйте ARIA атрибуты где нужно

### Кастомизация
1. Tailwind — через конфигурацию (tailwind.config.ts)
2. shadcn/ui — через CSS переменные в globals.css
3. Lucide — через props компонентов (size, color, strokeWidth)
4. Создавайте переиспользуемые компоненты

### Дизайн
1. Следуйте принципам из Refactoring UI
2. Применяйте законы из Laws of UX
3. Проверяйте совместимость браузеров через Can I Use
4. Используйте систему дизайна (цвета, spacing, типографика)
5. Тестируйте на реальных устройствах

## Рекомендуемый стек для UI разработки

1. **Иконки**: Lucide Icons (lucide-react)
2. **Стилизация**: Tailwind CSS
3. **Компоненты**: shadcn/ui
4. **Фреймворк**: Next.js (App Router)
5. **Сборка**: Vite или Next.js встроенная
6. **Проверка совместимости**: Can I Use
7. **Дизайн-принципы**: Refactoring UI, Laws of UX

## Важные детали

### Производительность
- Lucide поддерживает tree-shaking
- Tailwind генерирует только используемые стили (JIT)
- shadcn/ui компоненты копируются в проект (не зависимость)
- Next.js оптимизирует сборку автоматически

### Доступность
- Lucide иконки поддерживают accessibility атрибуты
- shadcn/ui построен на Radix UI (accessibility-first подход)
- Tailwind предоставляет утилиты для accessibility (sr-only, focus-visible)
- Все компоненты поддерживают клавиатурную навигацию

### Кастомизация
- Все инструменты легко кастомизируются
- Tailwind — через конфигурацию (tailwind.config.ts)
- shadcn/ui — через CSS переменные в globals.css
- Lucide — через props компонентов (className, size, color, strokeWidth)

### Онбординг пользователей
- Избегайте принудительных product tours
- Используйте tooltips для контекстной помощи
- Реализуйте progressive onboarding
- Предоставляйте getting started templates
- Делайте руководство доступным на протяжении всего опыта
