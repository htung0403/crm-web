/** Cấu hình tài khoản nhận thanh toán (VietQR) — đặt trong client/.env */
export interface PaymentConfig {
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
}

function env(key: keyof ImportMetaEnv): string {
    const raw = import.meta.env[key];
    if (raw == null || raw === '') return '';
    return String(raw).trim();
}

export function getPaymentConfig(): PaymentConfig {
    return {
        bankBin: env('VITE_PAYMENT_BANK_BIN') || '970422',
        bankName: env('VITE_PAYMENT_BANK_NAME') || 'MB Bank',
        accountNumber: env('VITE_PAYMENT_ACCOUNT_NUMBER'),
        accountName: env('VITE_PAYMENT_ACCOUNT_NAME') || 'CONG TY TNHH',
        companyName: env('VITE_COMPANY_NAME') || 'CRM',
        companyAddress: env('VITE_COMPANY_ADDRESS'),
        companyPhone: env('VITE_COMPANY_PHONE'),
    };
}

export function isPaymentConfigured(): boolean {
    const c = getPaymentConfig();
    return Boolean(c.accountNumber && c.bankBin);
}
