export declare const formatDate: (date: Date | string, format?: string) => string;
export declare const formatCurrency: (amount: number, currency?: string) => string;
export declare const formatPhone: (phone: string) => string;
export declare const debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => ((...args: Parameters<T>) => void);
export declare const throttle: <T extends (...args: any[]) => any>(func: T, limit: number) => ((...args: Parameters<T>) => void);
