import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeProvider } from './components/ThemeProvider';
import LayoutContent from './LayoutContent';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Афродита - Админ панель',
  description: 'Административная панель для массажного салона Афродита',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <Providers>
            <LayoutContent>{children}</LayoutContent>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
