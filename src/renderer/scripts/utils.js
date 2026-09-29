// Utility Functions

class Utils {
    // Date formatting utilities
    static formatDate(date, format = 'DD-MM-YYYY') {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        
        switch (format) {
            case 'DD-MM-YYYY':
                return `${day}-${month}-${year}`;
            case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'readable':
                return d.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            default:
                return `${day}-${month}-${year}`;
        }
    }
    
    static getCurrentDate(format = 'YYYY-MM-DD') {
        return this.formatDate(new Date(), format);
    }
    
    static addMonths(date, months) {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    }
    
    static daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        const firstDate = new Date(date1);
        const secondDate = new Date(date2);
        return Math.round((secondDate - firstDate) / oneDay);
    }
    
    // Currency formatting
    static formatCurrency(amount, currency = 'PKR') {
        if (isNaN(amount) || amount === null || amount === undefined) return 'Rs. 0';
        
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount).replace(currency, 'Rs.');
    }
    
    static parseCurrency(currencyString) {
        if (!currencyString) return 0;
        return parseFloat(currencyString.replace(/[Rs.,\s]/g, '')) || 0;
    }
    
    // Number utilities
    static formatNumber(num, decimals = 0) {
        if (isNaN(num)) return '0';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    static roundTo(num, decimals = 2) {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    
    // Validation utilities
    static isValidCNIC(cnic) {
        if (!cnic) return false;
        const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]$/;
        return cnicRegex.test(cnic);
    }
    
    static formatCNIC(cnic) {
        if (!cnic) return '';
        const cleaned = cnic.replace(/\D/g, '');
        if (cleaned.length === 13) {
            return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
        }
        return cnic;
    }
    
    static isValidPhone(phone) {
        if (!phone) return false;
        const phoneRegex = /^(\+92|0)?3[0-9]{2}[0-9]{7}$/;
        return phoneRegex.test(phone.replace(/[\s-]/g, ''));
    }
    
    static formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11 && cleaned.startsWith('03')) {
            return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        return phone;
    }
    
    static isValidEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // String utilities
    static capitalizeWords(str) {
        if (!str) return '';
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }
    
    static truncate(str, length = 50, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + suffix;
    }
    
    static generateId(prefix = '', length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = prefix;
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    static generateAccountNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        return `ACC-${timestamp}${random}`;
    }
    
    static generateReceiptNumber() {
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 999).toString().padStart(3, '0');
        return `RCP-${timestamp}${random}`;
    }
    
    // Array utilities
    static groupBy(array, key) {
        return array.reduce((result, currentValue) => {
            (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
            return result;
        }, {});
    }
    
    static sortBy(array, key, direction = 'asc') {
        return array.sort((a, b) => {
            if (direction === 'asc') {
                return a[key] > b[key] ? 1 : -1;
            } else {
                return a[key] < b[key] ? 1 : -1;
            }
        });
    }
    
    // Installment calculation utilities
    static calculateInstallmentSchedule({
        salePrice,
        purchasePrice,
        profitPercentage,
        advancePayment = 0,
        installmentMonths,
        startDate,
        // Optional explicit override if caller wants to provide a fixed profit amount
        profitAmountOverride
    }) {
        // Net principal to finance after advance
        const principal = Math.max(0, Math.round(salePrice - advancePayment));

        // Determine profit amount: prefer percentage of principal; fall back to override; finally margin
        let profitAmount;
        if (typeof profitPercentage === 'number' && !isNaN(profitPercentage)) {
            profitAmount = Math.round((principal * profitPercentage) / 100);
        } else if (typeof profitAmountOverride === 'number' && !isNaN(profitAmountOverride)) {
            profitAmount = Math.round(profitAmountOverride);
        } else {
            // Fallback to product margin if no percentage/override provided
            profitAmount = Math.max(0, Math.round(salePrice - purchasePrice));
        }

        // Total to schedule is principal plus profit (both rounded to whole rupees)
        const totalAmount = principal + profitAmount;
        const remainingAmount = totalAmount;

        // Round monthly installment to nearest rupee (no decimals)
        const baseInstallment = Math.round(remainingAmount / installmentMonths);
        
        const schedule = [];
        let currentDate = new Date(startDate);
        let remainingBalance = Math.round(remainingAmount);
        
        for (let i = 1; i <= installmentMonths; i++) {
            currentDate = this.addMonths(currentDate, 1);
            // For the last installment, use the remaining to eliminate rounding drift
            const installmentAmount = i === installmentMonths ? remainingBalance : baseInstallment;
            
            schedule.push({
                installment_no: i,
                due_date: this.formatDate(currentDate, 'YYYY-MM-DD'),
                amount: installmentAmount,
                remaining_balance: remainingBalance
            });
            
            remainingBalance = Math.max(0, Math.round(remainingBalance - installmentAmount));
        }
        
        return {
            schedule,
            summary: {
                salePrice,
                purchasePrice,
                profitAmount,
                // Profit percentage relative to financed principal
                profitPercentage: principal > 0 ? this.roundTo((profitAmount / principal) * 100, 2) : 0,
                totalAmount: Math.round(totalAmount),
                advancePayment: Math.round(advancePayment),
                remainingAmount: Math.round(remainingAmount),
                monthlyInstallment: baseInstallment,
                installmentMonths
            }
        };
    }
    
    static calculateProfitPercentage(salePrice, purchasePrice) {
        if (purchasePrice === 0) return 0;
        return this.roundTo(((salePrice - purchasePrice) / purchasePrice) * 100, 2);
    }
    
    // Local storage utilities
    static setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }
    
    static getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }
    
    static removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
    }
    
    // Download utilities
    static downloadJSON(data, filename = 'data.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        this.downloadBlob(blob, filename);
    }
    
    static downloadCSV(data, filename = 'data.csv') {
        if (!data.length) return;
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => 
                `"${row[header] || ''}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        this.downloadBlob(blob, filename);
    }
    
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Print utilities
    static printElement(elementId, title = 'Print Document') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                ${element.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    // Performance utilities
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Export to window
window.Utils = Utils;
