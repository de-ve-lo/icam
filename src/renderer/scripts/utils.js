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

    static toLocalDateString(date) {
        const d = date instanceof Date ? date : new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
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

    static localDaysBetween(fromDate, toDate) {
        const parse = (value) => {
            const parts = String(value || '').slice(0, 10).split('-').map(Number);
            return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
        };
        const ms = parse(toDate) - parse(fromDate);
        return Math.round(ms / (24 * 60 * 60 * 1000));
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

    static stockIdentifier(row) {
        const category = row.category || row.product_category || 'bike';
        if (category === 'mobile') {
            return { label: 'IMEI', value: row.imei || '-' };
        }
        if (category === 'misc') {
            if (row.serial_no) return { label: 'Serial', value: row.serial_no };
            return { label: 'Qty', value: String(row.quantity != null ? row.quantity : 1) };
        }
        const engine = row.engine_no || '-';
        const chassis = row.chassis_no || '-';
        return { label: 'Engine / Chassis', value: `${engine} / ${chassis}` };
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
    static calculateInstallmentSchedule(params) {
        const result = InstallmentEngine.createSchedule(params);
        result.schedule = result.schedule.map(row => ({
            ...row,
            amount: row.original_amount
        }));
        return result;
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
    
    static developerCreditCss() {
        return `.developer-credit { margin-top: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #ddd; padding-top: 12px; }`;
    }

    static developerCreditHtml() {
        return `<div class="developer-credit">
            <p>Developed By <strong>POVDEV</strong></p>
            <p>povdev.com | WhatsApp: @wpfahad | Email: mypovdev@gmail.com</p>
        </div>`;
    }

    static developerCreditText() {
        return 'Developed By POVDEV | povdev.com | WhatsApp: @wpfahad | Email: mypovdev@gmail.com';
    }

    static escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    static async getShopSettingsSafe() {
        try {
            if (typeof Database !== 'undefined' && Database.getShopSettings) {
                return await Database.getShopSettings();
            }
        } catch (e) { /* use defaults */ }
        return { shop_name: 'Installment Management', phone: '', address: '', logo_path: '' };
    }

    static logoSrc(logoPathOrSettings) {
        if (!logoPathOrSettings) return '';
        if (typeof logoPathOrSettings === 'object') {
            return logoPathOrSettings.logo_data_url || Utils.logoSrc(logoPathOrSettings.logo_path);
        }
        const normalized = String(logoPathOrSettings).replace(/\\/g, '/');
        if (/^(file|https|data):/i.test(normalized)) return normalized;
        return 'file:///' + normalized.replace(/^\/+/, '');
    }

    static shopPrintHeaderCss() {
        return `.shop-print-header{text-align:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #333}
.shop-print-header img{max-height:64px;max-width:160px;display:block;margin:0 auto 8px}
.shop-print-header h1{margin:0 0 4px;font-size:20px}
.shop-print-header p{margin:0;font-size:12px;color:#444}`;
    }

    static async shopPrintHeaderHtml() {
        const s = await Utils.getShopSettingsSafe();
        const name = Utils.escapeHtml(s.shop_name || 'Installment Management');
        const phone = Utils.escapeHtml(s.phone || '');
        const address = Utils.escapeHtml(s.address || '');
        const logoUrl = Utils.logoSrc(s);
        const logo = logoUrl
            ? `<img src="${Utils.escapeHtml(logoUrl)}" alt="${name}">`
            : '';
        const lines = [phone, address].filter(Boolean).join(' | ');
        return `<div class="shop-print-header">${logo}<h1>${name}</h1>${lines ? `<p>${lines}</p>` : ''}</div>`;
    }

    static wrapPrintDocument(bodyHtml, title = 'Print Document', extraCss = '') {
        const safeTitle = Utils.escapeHtml(title);
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        ${Utils.developerCreditCss()}
        ${Utils.shopPrintHeaderCss()}
        ${extraCss}
        @media print { body { margin: 0; } .no-print { display: none; } }
    </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
    }

    static pdfFileName(title) {
        const stamp = Utils.toLocalDateString(new Date());
        const slug = String(title || 'document').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
        return `${slug || 'document'}-${stamp}.pdf`;
    }

    static async sendPrint(html) {
        if (!window.electronAPI || !window.electronAPI.invoke) {
            throw new Error('Print is only available in the desktop app');
        }
        return window.electronAPI.invoke('print-document', { html });
    }

    static async savePrintPdf(html, title) {
        if (!window.electronAPI || !window.electronAPI.invoke) {
            throw new Error('Save PDF is only available in the desktop app');
        }
        return window.electronAPI.invoke('print-preview-pdf', {
            html,
            defaultName: Utils.pdfFileName(title)
        });
    }

    static showPrintPreview(html, title = 'Print Preview') {
        const safeTitle = Utils.escapeHtml(title);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const modalHtml = `
            <div class="modal print-preview-modal">
                <div class="modal-content modal-xl print-preview-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-print"></i> ${safeTitle}</h3>
                        <button class="modal-close" type="button">&times;</button>
                    </div>
                    <div class="modal-body print-preview-body">
                        <iframe class="print-preview-frame" src="${url}" title="${safeTitle}"></iframe>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" type="button" id="print-preview-close">Close</button>
                        <button class="btn btn-secondary" type="button" id="print-preview-pdf">
                            <i class="fas fa-file-pdf"></i> Save PDF
                        </button>
                        <button class="btn btn-primary" type="button" id="print-preview-print">
                            <i class="fas fa-print"></i> Print
                        </button>
                    </div>
                </div>
            </div>
        `;
        if (typeof app !== 'undefined' && app.showModal) {
            app.showModal(modalHtml);
        } else {
            const container = document.getElementById('modal-container');
            if (container) container.innerHTML = modalHtml;
        }
        const revoke = () => URL.revokeObjectURL(url);
        const notify = (message, type) => {
            if (typeof app !== 'undefined' && app.showNotification) {
                app.showNotification(message, type);
            }
        };
        const closeBtn = document.getElementById('print-preview-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                revoke();
                if (typeof app !== 'undefined' && app.closeModal) app.closeModal();
            });
        }
        const printBtn = document.getElementById('print-preview-print');
        if (printBtn) {
            printBtn.addEventListener('click', async () => {
                try {
                    const result = await Utils.sendPrint(html);
                    if (result && result.ok === false && result.reason !== 'canceled') {
                        notify('Print failed', 'error');
                    }
                } catch (error) {
                    notify(error.message || 'Print failed', 'error');
                }
            });
        }
        const pdfBtn = document.getElementById('print-preview-pdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', async () => {
                try {
                    const result = await Utils.savePrintPdf(html, title);
                    if (result && result.ok) {
                        notify('PDF saved', 'success');
                    } else if (result && result.reason && result.reason !== 'canceled') {
                        notify('Failed to save PDF', 'error');
                    }
                } catch (error) {
                    notify(error.message || 'Failed to save PDF', 'error');
                }
            });
        }
        const modalClose = document.querySelector('#modal-container .modal-close');
        if (modalClose) modalClose.addEventListener('click', revoke, { once: true });
    }

    static printElement(elementId, title = 'Print Document') {
        const element = document.getElementById(elementId);
        if (!element) return;
        const html = Utils.wrapPrintDocument(`${element.innerHTML}${Utils.developerCreditHtml()}`, title);
        Utils.showPrintPreview(html, title);
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

    static toWhatsAppDigits(phone) {
        const digits = String(phone || '').replace(/\D/g, '');
        if (!digits) return '';
        if (digits.startsWith('92')) return digits;
        if (digits.startsWith('0')) return '92' + digits.slice(1);
        if (digits.length === 10) return '92' + digits;
        return digits;
    }

    static fillWhatsAppTemplate(template, values) {
        const source = String(template || '');
        const data = values || {};
        return source.replace(/\{(name|account|amount|due_date|shop)\}/g, (_, key) => {
            return data[key] != null ? String(data[key]) : '';
        });
    }

    static whatsAppUrl(phone, text) {
        const digits = Utils.toWhatsAppDigits(phone);
        if (!digits) return '';
        return 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text || '');
    }
}

if (typeof window !== 'undefined') {
    window.Utils = Utils;
}
if (typeof module === 'object' && module.exports) {
    module.exports = { Utils };
}
