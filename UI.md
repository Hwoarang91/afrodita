изучи и примини это можешь использовать mcp chrome-devtools
https://lucide.dev/guide/packages/lucide
используй иконки https://lucide.dev/icons/
можешь использовать mcp chrome-devtools чтобы перейти на https://lucide.dev/icons/ настроить и скачать нужные иконки
изучи https://tailwindcss.com/docs/installation/using-vite  и используй для дизайна https://tailwindcss.com/plus/ui-blocks/application-ui
изучи https://ui.shadcn.com/docs/installation/next
изучи https://ui.shadcn.com/docs/components-json
изучи https://ui.shadcn.com/docs/theming
изучи https://ui.shadcn.com/docs/dark-mode/next
изучи https://ui.shadcn.com/docs/components
изучи https://ui.shadcn.com/docs/theming
изучи https://ui.shadcn.com/docs/theming
изучи https://ui.shadcn.com/docs/directory
изучи https://ui.shadcn.com/docs/components/chart
изучи https://ui.shadcn.com/docs/blocks
изучи https://caniuse.com/
изучи https://www.refactoringui.com/
изучи https://lawsofux.com/articles/2024/onboarding-for-active-users/

# Полный гайд: Современный адаптивный дизайн с shadcn/ui и Tailwind CSS

## 📚 Содержание

1. [Основы современного дизайна](#основы-современного-дизайна)
2. [Настройка проекта](#настройка-проекта)
3. [Система дизайна](#система-дизайна)
4. [Компоненты shadcn/ui](#компоненты-shadcnui)
5. [Адаптивный дизайн](#адаптивный-дизайн)
6. [Современные паттерны](#современные-паттерны)
7. [Анимации и переходы](#анимации-и-переходы)
8. [Accessibility](#accessibility)
9. [Темная тема](#темная-тема)
10. [Продвинутые техники](#продвинутые-техники)

---

## Основы современного дизайна

### Принципы современного UI/UX

#### 1. Минимализм и чистота
- Используйте больше whitespace (пустого пространства)
- Ограничивайте количество цветов (2-3 основных + оттенки)
- Простые, четкие формы

#### 2. Иерархия и структура
- Четкая визуальная иерархия через размер, цвет, вес шрифта
- Группировка связанных элементов
- Логичные flow и навигация

#### 3. Микроинтеракции
- Плавные transitions при наведении
- Feedback на действия пользователя
- Skeleton loaders вместо спиннеров

#### 4. Glassmorphism и современные эффекты
```jsx
<div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl">
  {/* Стеклянный эффект */}
</div>
```

### Тренды 2024-2025
- **Bento Grid** - карточный макет в стиле iOS
- **Gradient Mesh** - сложные градиенты
- **3D элементы** - subtle 3D эффекты
- **Темная тема по умолчанию** - dark mode first
- **Крупная типографика** - bold headers

📖 **Ресурсы:**
- [Laws of UX](https://lawsofux.com/) - принципы UX дизайна
- [Refactoring UI](https://www.refactoringui.com/) - практические советы
- [Can I use](https://caniuse.com/) - совместимость CSS свойств

---

## Настройка проекта

### 1. Установка Next.js + shadcn/ui

```bash
# Создание Next.js проекта
npx create-next-app@latest my-app --typescript --tailwind --app

# Переход в директорию
cd my-app

# Инициализация shadcn/ui
npx shadcn@latest init
```

📖 **Документация:**
- [Next.js Installation](https://nextjs.org/docs/getting-started/installation)
- [shadcn/ui Installation](https://ui.shadcn.com/docs/installation)
- [Tailwind CSS with Next.js](https://tailwindcss.com/docs/guides/nextjs)

### 2. Установка компонентов

```bash
# Установка всех базовых компонентов
npx shadcn@latest add button card input label
npx shadcn@latest add select checkbox switch textarea
npx shadcn@latest add dialog sheet tabs separator
npx shadcn@latest add alert badge toast progress
npx shadcn@latest add dropdown-menu popover
npx shadcn@latest add table avatar skeleton
```

### 3. Настройка Tailwind

Отредактируйте `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... остальные цвета
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

📖 **Документация:**
- [Tailwind Configuration](https://tailwindcss.com/docs/configuration)
- [Tailwind Theme](https://tailwindcss.com/docs/theme)
- [tailwindcss-animate](https://github.com/jamiebuilds/tailwindcss-animate)

### 4. Установка дополнительных библиотек

```bash
# Иконки
npm install lucide-react

# Утилиты
npm install clsx tailwind-merge
npm install class-variance-authority

# Формы
npm install react-hook-form
npm install @hookform/resolvers zod

# Анимации
npm install framer-motion
```

📖 **Документация:**
- [Lucide Icons](https://lucide.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [Framer Motion](https://www.framer.com/motion/)

---

## Система дизайна

### Цветовая палитра

#### Системные цвета shadcn/ui
```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
```

📖 **Документация:**
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind Colors](https://tailwindcss.com/docs/customizing-colors)
- [HSL Color Picker](https://hslpicker.com/)

#### Использование цветов

```jsx
// Фоны
<div className="bg-background">Основной фон</div>
<div className="bg-card">Карточка</div>
<div className="bg-muted">Приглушенный фон</div>
<div className="bg-accent">Акцентный фон</div>

// Текст
<p className="text-foreground">Основной текст</p>
<p className="text-muted-foreground">Вторичный текст</p>
<p className="text-primary">Акцентный текст</p>

// Границы
<div className="border border-border">С границей</div>
<div className="border-2 border-primary">Акцентная граница</div>
```

### Типографика

#### Система шрифтов

```jsx
// Заголовки
<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
  Главный заголовок
</h1>

<h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
  Заголовок секции
</h2>

<h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
  Подзаголовок
</h3>

<h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
  Заголовок карточки
</h4>

// Параграфы
<p className="leading-7 [&:not(:first-child)]:mt-6">
  Основной текст с хорошим межстрочным интервалом
</p>

<p className="text-sm text-muted-foreground">
  Вторичный текст меньшего размера
</p>

<p className="text-lg font-semibold">
  Выделенный текст
</p>

// Списки
<ul className="my-6 ml-6 list-disc [&>li]:mt-2">
  <li>Элемент списка</li>
  <li>Элемент списка</li>
</ul>

// Inline код
<code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
  npm install
</code>

// Блок кода
<pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-black py-4">
  <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">
    {code}
  </code>
</pre>
```

📖 **Документация:**
- [shadcn/ui Typography](https://ui.shadcn.com/docs/components/typography)
- [Tailwind Typography](https://tailwindcss.com/docs/font-family)
- [Google Fonts](https://fonts.google.com/)

### Spacing (Отступы)

#### Система отступов Tailwind

```jsx
// Padding (внутренние отступы)
<div className="p-4">    {/* 16px со всех сторон */}
<div className="px-6">   {/* 24px слева и справа */}
<div className="py-8">   {/* 32px сверху и снизу */}
<div className="pt-2">   {/* 8px сверху */}

// Margin (внешние отступы)
<div className="m-4">    {/* 16px со всех сторон */}
<div className="mx-auto"> {/* автоцентрирование */}
<div className="my-6">   {/* 24px сверху и снизу */}
<div className="-mt-4">  {/* отрицательный margin -16px */}

// Gap (для flex и grid)
<div className="flex gap-4">     {/* 16px между элементами */}
<div className="grid gap-x-4 gap-y-6"> {/* разные gap по осям */}

// Space (расстояние между дочерними элементами)
<div className="space-y-4">     {/* 16px между дочерними по вертикали */}
<div className="space-x-2">     {/* 8px между дочерними по горизонтали */}
```

#### Рекомендуемая шкала
- `2` (8px) - минимальный gap
- `4` (16px) - стандартный gap
- `6` (24px) - средний gap
- `8` (32px) - большой gap
- `12` (48px) - секционный gap
- `16` (64px) - gap между секциями

📖 **Документация:**
- [Tailwind Spacing](https://tailwindcss.com/docs/customizing-spacing)
- [Tailwind Padding](https://tailwindcss.com/docs/padding)
- [Tailwind Gap](https://tailwindcss.com/docs/gap)

### Размеры и Breakpoints

```jsx
// Ширина контейнера
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Адаптивные отступы */}
</div>

// Breakpoints
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px

// Примеры использования
<div className="text-sm md:text-base lg:text-lg">
  Адаптивный размер текста
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Адаптивная сетка */}
</div>
```

📖 **Документация:**
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Tailwind Breakpoints](https://tailwindcss.com/docs/breakpoints)
- [Container Queries](https://tailwindcss.com/docs/hover-focus-and-other-states#container-queries)

---

## Компоненты shadcn/ui

### Button (Кнопки)

```jsx
import { Button } from "@/components/ui/button"

// Варианты
<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Размеры
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">
  <ChevronRight className="h-4 w-4" />
</Button>

// С иконками
<Button>
  <Mail className="mr-2 h-4 w-4" />
  Login with Email
</Button>

// Состояния
<Button disabled>Disabled</Button>
<Button className="w-full">Full Width</Button>

// Кастомные стили
<Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
  Gradient Button
</Button>
```

📖 **Документация:**
- [shadcn/ui Button](https://ui.shadcn.com/docs/components/button)

### Card (Карточки)

```jsx
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

// Базовая карточка
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card Description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card Content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Карточка с hover эффектом
<Card className="hover:shadow-lg transition-shadow duration-300 cursor-pointer">
  <CardContent className="p-6">
    Hover me
  </CardContent>
</Card>

// Карточка с изображением
<Card className="overflow-hidden">
  <img src="/image.jpg" alt="Image" className="w-full h-48 object-cover" />
  <CardHeader>
    <CardTitle>Image Card</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Description</p>
  </CardContent>
</Card>
```

📖 **Документация:**
- [shadcn/ui Card](https://ui.shadcn.com/docs/components/card)

### Form (Формы)

```jsx
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
})

function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="johndoe" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

📖 **Документация:**
- [shadcn/ui Form](https://ui.shadcn.com/docs/components/form)
- [React Hook Form Guide](https://react-hook-form.com/get-started)
- [Zod Schema](https://zod.dev/)

### Dialog (Диалоги)

```jsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here. Click save when you're done.
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">
          Name
        </Label>
        <Input id="name" value="Pedro Duarte" className="col-span-3" />
      </div>
    </div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

📖 **Документация:**
- [shadcn/ui Dialog](https://ui.shadcn.com/docs/components/dialog)
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog)

### Select (Селекты)

```jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
    <SelectItem value="orange">Orange</SelectItem>
  </SelectContent>
</Select>
```

📖 **Документация:**
- [shadcn/ui Select](https://ui.shadcn.com/docs/components/select)

### Tabs (Вкладки)

```jsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="account" className="w-[400px]">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Make changes to your account here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Content */}
      </CardContent>
    </Card>
  </TabsContent>
  <TabsContent value="password">
    {/* Password content */}
  </TabsContent>
</Tabs>
```

📖 **Документация:**
- [shadcn/ui Tabs](https://ui.shadcn.com/docs/components/tabs)

### Toast (Уведомления)

```jsx
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"

function ToastDemo() {
  const { toast } = useToast()

  return (
    <Button
      onClick={() => {
        toast({
          title: "Scheduled: Catch up",
          description: "Friday, February 10, 2023 at 5:57 PM",
        })
      }}
    >
      Show Toast
    </Button>
  )
}

// С вариантами
toast({
  variant: "destructive",
  title: "Uh oh! Something went wrong.",
  description: "There was a problem with your request.",
})
```

📖 **Документация:**
- [shadcn/ui Toast](https://ui.shadcn.com/docs/components/toast)

### Table (Таблицы)

```jsx
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

<Table>
  <TableCaption>A list of your recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[100px]">Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Method</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-medium">INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell>Credit Card</TableCell>
      <TableCell className="text-right">$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

📖 **Документация:**
- [shadcn/ui Table](https://ui.shadcn.com/docs/components/table)

### Skeleton (Загрузка)

```jsx
import { Skeleton } from "@/components/ui/skeleton"

<div className="flex items-center space-x-4">
  <Skeleton className="h-12 w-12 rounded-full" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
</div>
```

📖 **Документация:**
- [shadcn/ui Skeleton](https://ui.shadcn.com/docs/components/skeleton)

---

## Адаптивный дизайн

### Mobile-First подход

```jsx
// ❌ Неправильно: Desktop-first
<div className="text-lg md:text-base sm:text-sm">

// ✅ Правильно: Mobile-first
<div className="text-sm md:text-base lg:text-lg">
```

### Адаптивные сетки

```jsx
// Простая адаптивная сетка
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map((item) => (
    <Card key={item.id}>{/* ... */}</Card>
  ))}
</div>

// Auto-fit grid (автоматическая подстройка)
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
  {items.map((item) => (
    <Card key={item.id}>{/* ... */}</Card>
  ))}
</div>

// Auto-fill grid (заполнение пространства)
<div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
  {items.map((item) => (
    <Card key={item.id}>{/* ... */}</Card>
  ))}
</div>
```

### Адаптивная типографика

```jsx
// Адаптивные заголовки
<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold">
  Responsive Heading
</h1>

// Адаптивный текст
<p className="text-sm sm:text-base md:text-lg leading-relaxed">
  Responsive paragraph text
</p>

// Использование clamp для плавного масштабирования
<h1 className="text-[clamp(2rem,5vw,4rem)] font-bold">
  Fluid Typography
</h1>
```

### Адаптивный Spacing

```jsx
// Адаптивные отступы
<div className="p-4 sm:p-6 md:p-8 lg:p-12">
  <div className="space-y-4 sm:space-y-6 md:space-y-8">
    {/* Content */}
  </div>
</div>

// Адаптивный gap
<div className="grid gap-4 sm:gap-6 md:gap-8">
  {/* Items */}
</div>
```

### Адаптивная навигация

```jsx
// Мобильное меню с Sheet
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"

<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
  <div className="container flex h-16 items-center">
    <div className="mr-4 hidden md:flex">
      <nav className="flex items-center space-x-6 text-sm font-medium">
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/services">Services</a>
      </nav>
    </div>
    
    {/* Mobile menu */}
    <Sheet>
      <SheetTrigger asChild className="md:hidden">
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <nav className="flex flex-col space-y-4">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/services">Services</a>
        </nav>
      </SheetContent>
    </Sheet>
  </div>
</header>
```

### Скрытие элементов на разных экранах

```jsx
// Скрыть на мобильных
<div className="hidden md:block">
  Desktop only content
</div>

// Показать только на мобильных
<div className="block md:hidden">
  Mobile only content
</div>

// Комплексные сценарии
<div className="hidden sm:block lg:hidden xl:block">
  Visible on sm, hidden on md/lg, visible on xl+
</div>
```

### Адаптивные изображения

```jsx
// Responsive images with Next.js Image
import Image from "next/image"

<div className="relative w-full h-48 md:h-64 lg:h-80">
  <Image
    src="/hero.jpg"
    alt="Hero"
    fill
    className="object-cover"
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  />
</div>

// Picture element для art direction
<picture>
  <source media="(min-width: 1024px)" srcSet="/desktop.jpg" />
  <source media="(min-width: 768px)" srcSet="/tablet.jpg" />
  <img src="/mobile.jpg" alt="Responsive image" className="w-full" />
</picture>
```

📖 **Документация:**
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Next.js Image Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/images)
- [MDN Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)

---

## Современные паттерны

### 1. Hero Section

```jsx
// Современный Hero с градиентом
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  {/* Градиентный фон */}
  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
  
  {/* Декоративные элементы */}
  <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
  <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
  <div className="absolute bottom-0 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
  
  {/* Контент */}
  <div className="relative z-10 container mx-auto px-4 text-center">
    <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
      Создайте что-то невероятное
    </h1>
    <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
      Современный дизайн для вашего следующего проекта
    </p>
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Button size="lg" className="text-lg">
        Начать
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <Button size="lg" variant="outline" className="text-lg">
        Узнать больше
      </Button>
    </div>
  </div>
</section>

/* CSS для анимации blob в globals.css */
@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}

.animation-delay-4000 {
  animation-delay: 4s;
}
```

### 2. Bento Grid Layout

```jsx
// Модный Bento Grid (как в iOS)
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[200px]">
  <Card className="md:col-span-2 md:row-span-2 p-6 hover:shadow-xl transition-shadow">
    <CardHeader>
      <CardTitle>Большая карточка</CardTitle>
    </CardHeader>
    <CardContent>
      Основной контент
    </CardContent>
  </Card>
  
  <Card className="md:col-span-2 p-6 hover:shadow-xl transition-shadow">
    <CardHeader>
      <CardTitle>Широкая карточка</CardTitle>
    </CardHeader>
  </Card>
  
  <Card className="md:col-span-1 p-6 hover:shadow-xl transition-shadow">
    <CardHeader>
      <CardTitle>Маленькая</CardTitle>
    </CardHeader>
  </Card>
  
  <Card className="md:col-span-1 md:row-span-2 p-6 hover:shadow-xl transition-shadow">
    <CardHeader>
      <CardTitle>Высокая</CardTitle>
    </CardHeader>
  </Card>
  
  <Card className="md:col-span-2 p-6 hover:shadow-xl transition-shadow">
    <CardHeader>
      <CardTitle>Еще одна</CardTitle>
    </CardHeader>
  </Card>
</div>
```

### 3. Glassmorphism Card

```jsx
// Стеклянная карточка
<Card className="relative overflow-hidden border-white/20 bg-white/10 backdrop-blur-lg shadow-xl">
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
  <CardHeader className="relative">
    <CardTitle className="text-2xl">Glassmorphism</CardTitle>
    <CardDescription className="text-white/80">
      Современный стеклянный эффект
    </CardDescription>
  </CardHeader>
  <CardContent className="relative">
    <p className="text-white/90">
      Контент с красивым эффектом размытия
    </p>
  </CardContent>
</Card>
```

### 4. Pricing Section

```jsx
// Современная секция цен
<section className="py-24 px-4">
  <div className="container mx-auto">
    <div className="text-center mb-16">
      <h2 className="text-4xl font-bold mb-4">Выберите свой план</h2>
      <p className="text-xl text-muted-foreground">
        Простые и прозрачные цены
      </p>
    </div>
    
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {/* Basic Plan */}
      <Card className="relative">
        <CardHeader>
          <CardTitle>Basic</CardTitle>
          <CardDescription>Для начинающих</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <span className="text-4xl font-bold">$9</span>
            <span className="text-muted-foreground">/месяц</span>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>10 проектов</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Базовая поддержка</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="outline">
            Выбрать план
          </Button>
        </CardFooter>
      </Card>
      
      {/* Pro Plan - Featured */}
      <Card className="relative border-2 border-primary shadow-xl scale-105">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-1">
            Популярный
          </Badge>
        </div>
        <CardHeader>
          <CardTitle>Pro</CardTitle>
          <CardDescription>Для профессионалов</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <span className="text-4xl font-bold">$29</span>
            <span className="text-muted-foreground">/месяц</span>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Unlimited проекты</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Приоритетная поддержка</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>API доступ</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button className="w-full">
            Выбрать план
          </Button>
        </CardFooter>
      </Card>
      
      {/* Enterprise Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Enterprise</CardTitle>
          <CardDescription>Для команд</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <span className="text-4xl font-bold">$99</span>
            <span className="text-muted-foreground">/месяц</span>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Все из Pro</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Dedicated support</span>
            </li>
            <li className="flex items-center">
              <Check className="mr-2 h-4 w-4 text-green-500" />
              <span>Custom интеграции</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="outline">
            Связаться с нами
          </Button>
        </CardFooter>
      </Card>
    </div>
  </div>
</section>
```

### 5. Features Grid

```jsx
// Сетка фич с иконками
import { Zap, Shield, Globe, Sparkles } from "lucide-react"

<section className="py-24 px-4">
  <div className="container mx-auto">
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
      {[
        {
          icon: Zap,
          title: "Быстрая работа",
          description: "Мгновенная загрузка и отклик"
        },
        {
          icon: Shield,
          title: "Безопасность",
          description: "Защита данных на высшем уровне"
        },
        {
          icon: Globe,
          title: "Глобальный CDN",
          description: "Быстрая доставка по всему миру"
        },
        {
          icon: Sparkles,
          title: "AI-powered",
          description: "Умные возможности из коробки"
        }
      ].map((feature, index) => (
        <Card key={index} className="text-center hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <feature.icon className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">{feature.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{feature.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
</section>
```

### 6. Dashboard Layout

```jsx
// Современный дашборд
<div className="flex min-h-screen">
  {/* Sidebar */}
  <aside className="hidden lg:flex w-64 flex-col border-r bg-muted/40">
    <div className="flex h-16 items-center border-b px-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>
    </div>
    <nav className="flex-1 space-y-1 p-4">
      <Button variant="ghost" className="w-full justify-start">
        <Home className="mr-2 h-4 w-4" />
        Главная
      </Button>
      <Button variant="ghost" className="w-full justify-start">
        <BarChart className="mr-2 h-4 w-4" />
        Аналитика
      </Button>
      <Button variant="ghost" className="w-full justify-start">
        <Users className="mr-2 h-4 w-4" />
        Пользователи
      </Button>
      <Button variant="ghost" className="w-full justify-start">
        <Settings className="mr-2 h-4 w-4" />
        Настройки
      </Button>
    </nav>
  </aside>
  
  {/* Main Content */}
  <div className="flex-1 flex flex-col">
    {/* Header */}
    <header className="flex h-16 items-center gap-4 border-b bg-background px-6">
      <Sheet>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64">
          {/* Mobile navigation */}
        </SheetContent>
      </Sheet>
      
      <div className="flex-1">
        <Input placeholder="Поиск..." className="max-w-sm" />
      </div>
      
      <Button variant="ghost" size="icon">
        <Bell className="h-5 w-5" />
      </Button>
      
      <Avatar>
        <AvatarImage src="/avatar.jpg" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    </header>
    
    {/* Page Content */}
    <main className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Добро пожаловать</h1>
          <p className="text-muted-foreground">
            Вот обзор вашей активности
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Всего доход
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$45,231.89</div>
              <p className="text-xs text-muted-foreground">
                +20.1% от прошлого месяца
              </p>
            </CardContent>
          </Card>
          
          {/* More stats cards... */}
        </div>
        
        {/* Charts and Tables */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Обзор</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Chart component */}
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Недавние продажи</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Recent sales list */}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
</div>
```

📖 **Документация:**
- [shadcn/ui Examples](https://ui.shadcn.com/examples)
- [UI Patterns](https://ui-patterns.com/)
- [Dribbble Design Inspiration](https://dribbble.com/)

---

## Анимации и переходы

### CSS Transitions с Tailwind

```jsx
// Базовые transitions
<Button className="transition-all duration-300 hover:scale-105">
  Hover me
</Button>

// Множественные свойства
<Card className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
  Hover card
</Card>

// Разные timing functions
<div className="transition-transform duration-500 ease-in-out">
<div className="transition-opacity duration-300 ease-out">
<div className="transition-colors duration-200 ease-linear">

// Group hover
<div className="group">
  <img className="transition-transform duration-300 group-hover:scale-110" />
  <div className="transition-opacity duration-300 opacity-0 group-hover:opacity-100">
    Overlay content
  </div>
</div>
```

### Framer Motion анимации

```jsx
import { motion } from "framer-motion"

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>

// Slide in from left
<motion.div
  initial={{ x: -100, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>

// Stagger children
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }}
  initial="hidden"
  animate="show"
>
  {items.map((item, i) => (
    <motion.div
      key={i}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
    >
      {item}
    </motion.div>
  ))}
</motion.div>

// Scale on tap
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="px-6 py-3 bg-primary text-white rounded-lg"
>
  Click me
</motion.button>

// Scroll-triggered animations
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>
  Appears when scrolled into view
</motion.div>

// Page transitions
import { AnimatePresence } from "framer-motion"

<AnimatePresence mode="wait">
  <motion.div
    key={router.pathname}
    initial={{ opacity: 0, x: -100 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 100 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

### Кастомные CSS анимации

```css
/* globals.css */

/* Pulse animation */
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Bounce in */
@keyframes bounce-in {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-bounce-in {
  animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Slide up fade in */
@keyframes slide-up-fade {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up-fade {
  animation: slide-up-fade 0.5s ease-out;
}

/* Shimmer effect */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    #f0f0f0 0%,
    #e0e0e0 20%,
    #f0f0f0 40%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
}
```

### Skeleton loading с анимацией

```jsx
// Animated skeleton
<div className="space-y-4">
  <Skeleton className="h-12 w-12 rounded-full animate-pulse" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px] animate-pulse" />
    <Skeleton className="h-4 w-[200px] animate-pulse" />
  </div>
</div>

// Shimmer skeleton
<div className="space-y-4">
  <div className="h-12 w-12 rounded-full bg-gray-200 animate-shimmer" />
  <div className="space-y-2">
    <div className="h-4 w-[250px] bg-gray-200 rounded animate-shimmer" />
    <div className="h-4 w-[200px] bg-gray-200 rounded animate-shimmer" />
  </div>
</div>
```

### Scroll animations

```jsx
// Intersection Observer hook
import { useEffect, useRef, useState } from 'react'

function useInView(options = {}) {
  const ref = useRef(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting)
    }, options)

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [options])

  return [ref, isInView]
}

// Использование
function AnimatedCard() {
  const [ref, isInView] = useInView({ threshold: 0.3 })

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isInView 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-10'
      }`}
    >
      <Card>Content</Card>
    </div>
  )
}
```

📖 **Документация:**
- [Framer Motion](https://www.framer.com/motion/)
- [Tailwind Transitions](https://tailwindcss.com/docs/transition-property)
- [CSS Animations MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations)
- [Animate.css](https://animate.style/)

---

## Accessibility

### Семантический HTML

```jsx
// ❌ Неправильно
<div onClick={handleClick}>Click me</div>

// ✅ Правильно
<button onClick={handleClick}>Click me</button>

// Используйте правильные теги
<nav>        {/* Навигация */}
<main>       {/* Основной контент */}
<article>    {/* Статья/пост */}
<section>    {/* Секция */}
<aside>      {/* Боковая панель */}
<header>     {/* Шапка */}
<footer>     {/* Подвал */}
```

### ARIA атрибуты

```jsx
// Labels для форм
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" aria-describedby="email-description" />
  <p id="email-description" className="text-sm text-muted-foreground">
    Мы никогда не передадим ваш email третьим лицам
  </p>
</div>

// ARIA для кнопок
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// ARIA для навигации
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

// Loading состояния
<Button disabled aria-busy="true">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Загрузка...
</Button>

// Live regions для динамического контента
<div aria-live="polite" aria-atomic="true">
  {message}
</div>
```

### Keyboard navigation

```jsx
// Управление фокусом
import { useRef, useEffect } from 'react'

function Dialog({ isOpen }) {
  const firstFocusRef = useRef(null)
  
  useEffect(() => {
    if (isOpen && firstFocusRef.current) {
      firstFocusRef.current.focus()
    }
  }, [isOpen])
  
  return (
    <DialogContent>
      <Input ref={firstFocusRef} />
    </DialogContent>
  )
}

// Focus trap
<Dialog>
  <DialogContent onKeyDown={(e) => {
    if (e.key === 'Escape') {
      closeDialog()
    }
  }}>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Контрастность цветов

```jsx
// ✅ Хороший контраст (WCAG AA)
<p className="text-foreground">Основной текст</p>
<p className="text-muted-foreground">Вторичный текст</p>

// ❌ Плохой контраст
<p className="text-gray-400">Трудночитаемый текст</p>

// Проверка контрастности
// Используйте инструменты:
// - WebAIM Contrast Checker
// - Chrome DevTools Accessibility Panel
```

### Responsive text size

```jsx
// Не используйте px меньше 16px для основного текста
<p className="text-base">  {/* 16px - минимум */}
<p className="text-sm">    {/* 14px - только для второстепенного */}
<p className="text-xs">    {/* 12px - только для меток */}

// Пользователи должны иметь возможность увеличивать текст
// Используйте rem вместо px в кастомных стилях
```

### Skip links

```jsx
// Добавьте skip link для навигации с клавиатуры
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
>
  Skip to main content
</a>

<main id="main-content">
  {/* Основной контент */}
</main>
```

### Focus styles

```jsx
// Всегда показывайте focus indicator
<Button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
  Accessible button
</Button>

// Кастомные focus стили
<input className="focus:border-primary focus:ring-2 focus:ring-primary/20" />
```

📖 **Документация:**
- [WebAIM](https://webaim.org/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)

---

## Темная тема

### Настройка темной темы

```jsx
// app/providers.tsx
"use client"

import { ThemeProvider } from "next-themes"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  )
}

// app/layout.tsx
import { Providers } from "./providers"

export default function RootLayout({ children }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

### Theme Switcher компонент

```jsx
"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Светлая
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Темная
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          Системная
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Использование темных цветов

```jsx
// Цвета автоматически адаптируются
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground">
    <p className="text-muted-foreground">Secondary text</p>
  </Card>
</div>

// Специфичные стили для темной темы
<div className="bg-white dark:bg-gray-900">
<p className="text-gray-900 dark:text-gray-100">

// Границы
<div className="border-gray-200 dark:border-gray-800">

// Тени
<Card className="shadow-lg dark:shadow-2xl dark:shadow-white/5">
```

### Dark mode images

```jsx
// Разные изображения для светлой и темной темы
<div>
  <img
    src="/logo-light.svg"
    alt="Logo"
    className="block dark:hidden"
  />
  <img
    src="/logo-dark.svg"
    alt="Logo"
    className="hidden dark:block"
  />
</div>

// С Next.js Image
import Image from "next/image"

<div className="relative w-40 h-10">
  <Image
    src="/logo-light.svg"
    alt="Logo"
    fill
    className="object-contain dark:hidden"
  />
  <Image
    src="/logo-dark.svg"
    alt="Logo"
    fill
    className="object-contain hidden dark:block"
  />
</div>
```

📖 **Документация:**
- [next-themes](https://github.com/pacocoursey/next-themes)
- [shadcn/ui Dark Mode](https://ui.shadcn.com/docs/dark-mode)
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)

---

## Продвинутые техники

### 1. Infinite Scroll

```jsx
import { useEffect, useRef, useState } from 'react'

function InfiniteScroll() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const observerRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          setPage((prev) => prev + 1)
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [loading])

  useEffect(() => {
    loadMoreItems()
  }, [page])

  const loadMoreItems = async () => {
    setLoading(true)
    // Fetch data
    const newItems = await fetchItems(page)
    setItems((prev) => [...prev, ...newItems])
    setLoading(false)
  }

  return (
    <div>
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>{item.content}</Card>
        ))}
      </div>
      <div ref={observerRef} className="h-10" />
      {loading && <Skeleton className="h-20" />}
    </div>
  )
}
```

### 2. Virtualized List

```jsx
// Для больших списков используйте react-window
import { FixedSizeList } from 'react-window'

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style} className="border-b p-4">
      {items[index].content}
    </div>
  )

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}
```

### 3. Optimistic UI Updates

```jsx
import { useOptimistic } from 'react'

function TodoList({ todos }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, newTodo]
  )

  async function addTodo(formData) {
    const newTodo = { id: Date.now(), text: formData.get('text') }
    
    // Немедленное обновление UI
    addOptimisticTodo(newTodo)
    
    // Отправка на сервер
    await fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify(newTodo)
    })
  }

  return (
    <div>
      {optimisticTodos.map((todo) => (
        <div key={todo.id}>{todo.text}</div>
      ))}
      <form action={addTodo}>
        <Input name="text" />
        <Button type="submit">Add</Button>
      </form>
    </div>
  )
}
```

### 4. Drag and Drop

```jsx
// Используйте @dnd-kit
import { DndContext, closestCenter } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-move">{children}</Card>
    </div>
  )
}

function SortableList() {
  const [items, setItems] = useState(['1', '2', '3', '4'])

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((id) => (
          <SortableItem key={id} id={id}>
            Item {id}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  )
}
```

### 5. Command Palette (⌘K menu)

```jsx
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useEffect, useState } from 'react'

export function CommandMenu() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Введите команду или поиск..." />
      <CommandList>
        <CommandEmpty>Ничего не найдено.</CommandEmpty>
        <CommandGroup heading="Предложения">
          <CommandItem>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Календарь</span>
          </CommandItem>
          <CommandItem>
            <Smile className="mr-2 h-4 w-4" />
            <span>Поиск эмодзи</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### 6. Parallax Scrolling

```jsx
import { useScroll, useTransform, motion } from 'framer-motion'

function ParallaxSection() {
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0])

  return (
    <section className="relative h-screen overflow-hidden">
      <motion.div
        style={{ y, opacity }}
        className="absolute inset-0"
      >
        <img
          src="/background.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
      </motion.div>
      <div className="relative z-10 flex items-center justify-center h-full">
        <h1 className="text-6xl font-bold text-white">
          Parallax Effect
        </h1>
      </div>
    </section>
  )
}
```

### 7. Intersection Observer для lazy loading

```jsx
import { useEffect, useRef, useState } from 'react'

function LazyImage({ src, alt, className }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={className}>
      {isInView && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
      {!isLoaded && <Skeleton className="w-full h-full" />}
    </div>
  )
}
```

📖 **Документация:**
- [react-window](https://react-window.vercel.app/)
- [@dnd-kit](https://dndkit.com/)
- [Framer Motion Scroll](https://www.framer.com/motion/scroll-animations/)

---

## Полезные ресурсы

### Официальная документация
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)

### Инструменты дизайна
- [Figma](https://www.figma.com/) - дизайн интерфейсов
- [Framer](https://www.framer.com/) - прототипирование
- [ColorHunt](https://colorhunt.co/) - цветовые палитры
- [Coolors](https://coolors.co/) - генератор палитр
- [Realtime Colors](https://realtimecolors.com/) - preview цветов
- [Gradient Generator](https://cssgradient.io/) - градиенты

### Иконки и иллюстрации
- [Lucide Icons](https://lucide.dev/)
- [Heroicons](https://heroicons.com/)
- [Feather Icons](https://feathericons.com/)
- [unDraw](https://undraw.co/) - иллюстрации
- [Storyset](https://storyset.com/) - анимированные иллюстрации

### Шрифты
- [Google Fonts](https://fonts.google.com/)
- [Fontshare](https://www.fontshare.com/)
- [Font Pair](https://www.fontpair.co/) - сочетания шрифтов

### Вдохновение
- [Dribbble](https://dribbble.com/)
- [Behance](https://www.behance.net/)
- [Awwwards](https://www.awwwards.com/)
- [UI Movement](https://uimovement.com/)
- [Mobbin](https://mobbin.com/) - мобильные дизайны
- [Land-book](https://land-book.com/) - landing pages

### Accessibility
- [WebAIM](https://webaim.org/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Performance
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [Web Vitals](https://web.dev/vitals/)

### Библиотеки компонентов
- [Aceternity UI](https://ui.aceternity.com/) - современные компоненты
- [Magic UI](https://magicui.design/) - анимированные компоненты
- [Tremor](https://www.tremor.so/) - дашборд компоненты
- [Park UI](https://park-ui.com/) - компоненты на Ark UI

### Tailwind плагины
- [tailwindcss-animate](https://github.com/jamiebuilds/tailwindcss-animate)
- [@tailwindcss/typography](https://tailwindcss.com/docs/typography-plugin)
- [@tailwindcss/forms](https://github.com/tailwindlabs/tailwindcss-forms)
- [@tailwindcss/container-queries](https://github.com/tailwindlabs/tailwindcss-container-queries)

### Обучение
- [Tailwind CSS Course (YouTube)](https://www.youtube.com/c/TailwindLabs)
- [shadcn/ui Tutorial](https://www.youtube.com/results?search_query=shadcn+ui+tutorial)
- [Web Dev Simplified](https://www.youtube.com/c/WebDevSimplified)
- [Frontend Masters](https://frontendmasters.com/)

### Сообщество
- [shadcn/ui Discord](https://discord.com/invite/9b8n7DqV)
- [Tailwind Discord](https://discord.gg/7NF8GNe)
- [r/webdev](https://www.reddit.com/r/webdev/)
- [r/reactjs](https://www.reddit.com/r/reactjs/)

---

## Чеклист для создания современного UI

### ✅ Дизайн
- [ ] Определена цветовая палитра (2-3 основных цвета)
- [ ] Настроена темная тема
- [ ] Выбраны шрифты (максимум 2-3)
- [ ] Определена система spacing (4, 8, 16, 24, 32)
- [ ] Созданы переиспользуемые компоненты

### ✅ Адаптивность

 Mobile-first подход
 Проверка на всех breakpoints (sm, md, lg, xl)
 Адаптивная типографика
 Мобильная навигация
 Touch-friendly элементы (минимум 44x44px)

✅ Производительность

 Lazy loading изображений
 Code splitting
 Оптимизация изображений (WebP, AVIF)
 Минимизация CSS и JS
 Использование CDN

✅ Accessibility

 Семантический HTML
 ARIA атрибуты где нужно
 Keyboard navigation
 Focus indicators
 Контрастность минимум AA
 Alt текст для изображений
 Skip links

✅ UX

 Loading states (skeletons, spinners)
 Error states
 Empty states
 Transitions и animations
 Toast notifications
 Form validation с понятными сообщениями
 Consistent spacing

✅ SEO

 Meta tags (title, description)
 Open Graph tags
 Semantic HTML5
 Structured data
 Sitemap
 robots.txt

✅ Тестирование

 Проверка на разных браузерах
 Проверка на мобильных устройствах
 Lighthouse audit
 Accessibility audit (WAVE, axe)
 Тест медленного интернета


Примеры кода готовых секций
Landing Page - полный пример
jsx// app/page.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Check, Zap, Shield, Globe, Star } from "lucide-react"
import Image from "next/image"

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">Logo</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Возможности
            </a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Цены
            </a>
            <a href="#testimonials" className="text-sm font-medium hover:text-primary transition-colors">
              Отзывы
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost">Войти</Button>
            <Button>Начать бесплатно</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Создавайте потрясающие продукты{" "}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  быстрее
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-[600px]">
                Все инструменты, которые вам нужны для создания современных веб-приложений. 
                Начните за минуты, масштабируйтесь до миллионов.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-lg">
                Начать бесплатно
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg">
                Смотреть демо
              </Button>
            </div>
            <div className="flex items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Бесплатно навсегда</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Без кредитной карты</span>
              </div>
            </div>
          </div>
          <div className="relative lg:h-[600px]">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-3xl" />
            <div className="relative h-full rounded-xl border bg-card shadow-2xl overflow-hidden">
              <Image
                src="/dashboard-preview.png"
                alt="Dashboard Preview"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Все что вам нужно
          </h2>
          <p className="text-xl text-muted-foreground max-w-[700px] mx-auto">
            Мощные инструменты для создания современных приложений
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: "Молниеносная скорость",
              description: "Оптимизированная производительность из коробки"
            },
            {
              icon: Shield,
              title: "Максимальная безопасность",
              description: "Enterprise-grade защита ваших данных"
            },
            {
              icon: Globe,
              title: "Глобальная сеть",
              description: "CDN по всему миру для быстрой доставки"
            },
            {
              icon: Star,
              title: "Простота использования",
              description: "Интуитивный интерфейс для всех"
            },
            {
              icon: Check,
              title: "Надежность 99.9%",
              description: "Гарантированная доступность сервиса"
            },
            {
              icon: ArrowRight,
              title: "Легкая интеграция",
              description: "API для быстрой интеграции"
            }
          ].map((feature, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Прозрачные цены
          </h2>
          <p className="text-xl text-muted-foreground">
            Выберите план, который подходит именно вам
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
              <CardDescription>Для небольших проектов</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/месяц</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>5 проектов</span>
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Базовая поддержка</span>
                </li>
              </ul>
              <Button className="w-full mt-6" variant="outline">
                Начать
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-primary shadow-xl relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                Популярный
              </span>
            </div>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>Для растущего бизнеса</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-muted-foreground">/месяц</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Unlimited проекты</span>
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Приоритетная поддержка</span>
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>API доступ</span>
                </li>
              </ul>
              <Button className="w-full mt-6">
                Начать
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>Для больших команд</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">Custom</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Все из Pro</span>
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Dedicated support</span>
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>Custom решения</span>
                </li>
              </ul>
              <Button className="w-full mt-6" variant="outline">
                Связаться
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-90" />
          <CardContent className="relative p-12 md:p-16 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Готовы начать?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Присоединяйтесь к тысячам довольных клиентов уже сегодня
            </p>
            <Button size="lg" variant="secondary" className="text-lg">
              Начать бесплатно
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold mb-4">Продукт</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#">Возможности</a></li>
                <li><a href="#">Цены</a></li>
                <li><a href="#">Документация</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Компания</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#">О нас</a></li>
                <li><a href="#">Блог</a></li>
                <li><a href="#">Карьера</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Поддержка</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#">Помощь</a></li>
                <li><a href="#">Контакты</a></li>
                <li><a href="#">Статус</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Правовая информация</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#">Конфиденциальность</a></li>
                <li><a href="#">Условия</a></li>
                <li><a href="#">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 Ваша Компания. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

Заключение
Этот гайд охватывает основные аспекты создания современного, адаптивного и красивого интерфейса с использованием shadcn/ui и Tailwind CSS. Помните:

Начинайте с простого - не пытайтесь использовать все сразу
Следуйте системе дизайна - консистентность важнее креативности
Думайте о пользователях - accessibility и UX на первом месте
Тестируйте на реальных устройствах - эмуляторы не показывают всей картины
Итерируйте и улучшайте - дизайн - это процесс, а не результат

собери изученно в новый .md файл