"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throttle = exports.debounce = exports.formatPhone = exports.formatCurrency = exports.formatDate = void 0;
const formatDate = (date, format = 'dd.MM.yyyy') => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return format
        .replace('dd', day)
        .replace('MM', month)
        .replace('yyyy', String(year))
        .replace('HH', hours)
        .replace('mm', minutes);
};
exports.formatDate = formatDate;
const formatCurrency = (amount, currency = '₽') => {
    return `${amount.toLocaleString('ru-RU')} ${currency}`;
};
exports.formatCurrency = formatCurrency;
const formatPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('7')) {
        return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
};
exports.formatPhone = formatPhone;
const debounce = (func, wait) => {
    let timeout = null;
    return (...args) => {
        if (timeout)
            clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};
exports.debounce = debounce;
const throttle = (func, limit) => {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};
exports.throttle = throttle;
//# sourceMappingURL=index.js.map