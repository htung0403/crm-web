import type { Order } from '@/hooks/useOrders';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { getPaymentConfig, isPaymentConfigured, type PaymentConfig } from '@/lib/paymentConfig';
import { buildVietQrPayload } from '@/lib/vietqr';

const ITEM_TYPE_LABEL: Record<string, string> = {
    product: 'SP',
    service: 'DV',
    package: 'GOI',
    voucher: 'VC',
};

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
}

export function getOrderPayAmount(order: Order): number {
    if (order.payment_status === 'paid') return 0;
    if (order.remaining_debt != null && order.remaining_debt > 0) return order.remaining_debt;
    const paid = order.paid_amount ?? 0;
    return Math.max(0, (order.total_amount ?? 0) - paid);
}

export function buildThermalInvoiceHtml(order: Order, config?: PaymentConfig): string {
    const pay = getPaymentConfig();
    const cfg = config ?? pay;
    const payAmount = getOrderPayAmount(order);
    const hasQr = isPaymentConfigured() && payAmount > 0;

    const qrPayload = hasQr
        ? buildVietQrPayload({
              bankBin: cfg.bankBin,
              accountNumber: cfg.accountNumber,
              amount: payAmount,
              description: order.order_code,
              merchantName: cfg.accountName,
          })
        : '';

    const items = order.items || [];
    const itemRows = items
        .map((item: { item_name?: string; item_type?: string; quantity?: number; unit_price?: number; total_price?: number }) => {
            const type = ITEM_TYPE_LABEL[item.item_type || ''] || '';
            const name = truncate(item.item_name || '—', 28);
            const qty = item.quantity ?? 1;
            const lineTotal = item.total_price ?? qty * (item.unit_price ?? 0);
            return `
            <tr>
                <td class="item-name">${type ? `[${type}] ` : ''}${escapeHtml(name)}</td>
            </tr>
            <tr class="item-sub">
                <td>${qty} x ${formatCurrency(item.unit_price ?? 0)}</td>
                <td class="right">${formatCurrency(lineTotal)}</td>
            </tr>`;
        })
        .join('');

    const discount =
        order.discount && order.discount > 0
            ? `<div class="row"><span>Giảm giá</span><span>-${formatCurrency(order.discount)}</span></div>`
            : '';

    const paid =
        (order.paid_amount ?? 0) > 0
            ? `<div class="row"><span>Đã thanh toán</span><span>${formatCurrency(order.paid_amount ?? 0)}</span></div>`
            : '';

    const qrBlock = hasQr
        ? `
        <div class="qr-block">
            <p class="qr-title">QUÉT MÃ THANH TOÁN</p>
            <p class="qr-amount">${formatCurrency(payAmount)}</p>
            <div id="payment-qr" class="qr-box"></div>
            <p class="bank">${escapeHtml(cfg.bankName)}</p>
            <p class="bank">${escapeHtml(cfg.accountNumber)}</p>
            <p class="bank muted">${escapeHtml(cfg.accountName)}</p>
            <p class="transfer-note">ND: ${escapeHtml(order.order_code)}</p>
        </div>`
        : !isPaymentConfigured()
          ? `<p class="warn">Chưa cấu hình TK nhận tiền (VITE_PAYMENT_* trong .env)</p>`
          : `<p class="paid-note">Đơn đã thanh toán đủ</p>`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Hóa đơn ${escapeHtml(order.order_code)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 80mm auto; margin: 2mm; }
        body {
            width: 72mm;
            max-width: 72mm;
            margin: 0 auto;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .center { text-align: center; }
        .bold { font-weight: 700; }
        .title { font-size: 13px; font-weight: 700; margin: 4px 0; }
        .subtitle { font-size: 10px; color: #333; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; gap: 4px; margin: 2px 0; }
        .right { text-align: right; white-space: nowrap; }
        table.items { width: 100%; border-collapse: collapse; margin: 4px 0; }
        .item-name { padding-top: 4px; font-weight: 600; }
        .item-sub td { font-size: 10px; padding-bottom: 2px; color: #222; }
        .total-row { font-size: 12px; font-weight: 700; margin-top: 4px; }
        .qr-block { text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000; }
        .qr-title { font-weight: 700; font-size: 11px; letter-spacing: 0.5px; }
        .qr-amount { font-size: 16px; font-weight: 700; margin: 4px 0; }
        .qr-box { display: flex; justify-content: center; margin: 6px auto; min-height: 160px; }
        .qr-box canvas, .qr-box img { width: 42mm !important; height: 42mm !important; }
        .bank { font-size: 10px; margin: 1px 0; }
        .muted { color: #444; }
        .transfer-note { font-size: 10px; margin-top: 4px; font-weight: 600; }
        .warn, .paid-note { text-align: center; font-size: 10px; margin-top: 8px; color: #555; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; }
        @media print {
            body { width: 72mm; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="center">
        <p class="bold title">${escapeHtml(cfg.companyName)}</p>
        ${cfg.companyAddress ? `<p class="subtitle">${escapeHtml(cfg.companyAddress)}</p>` : ''}
        ${cfg.companyPhone ? `<p class="subtitle">Tel: ${escapeHtml(cfg.companyPhone)}</p>` : ''}
    </div>
    <div class="divider"></div>
    <p class="center bold">HÓA ĐƠN BÁN HÀNG</p>
    <div class="divider"></div>
    <div class="row"><span>Mã đơn</span><span class="bold">${escapeHtml(order.order_code)}</span></div>
    <div class="row"><span>Ngày</span><span>${formatDateTime(order.created_at || new Date().toISOString())}</span></div>
    <div class="row"><span>Khách</span><span class="right">${escapeHtml(truncate(order.customer?.name || '—', 22))}</span></div>
    ${order.customer?.phone ? `<div class="row"><span>SĐT</span><span>${escapeHtml(order.customer.phone)}</span></div>` : ''}
    <div class="divider"></div>
    <table class="items">${itemRows || '<tr><td>Không có dòng hàng</td></tr>'}</table>
    <div class="divider"></div>
    <div class="row"><span>Tạm tính</span><span>${formatCurrency(order.subtotal ?? order.total_amount)}</span></div>
    ${discount}
    ${(order.surcharges_amount ?? 0) > 0 ? `<div class="row"><span>Phụ thu</span><span>${formatCurrency(order.surcharges_amount!)}</span></div>` : ''}
    <div class="row total-row"><span>TỔNG CỘNG</span><span>${formatCurrency(order.total_amount)}</span></div>
    ${paid}
    ${payAmount > 0 ? `<div class="row total-row"><span>CÒN THANH TOÁN</span><span>${formatCurrency(payAmount)}</span></div>` : ''}
    ${qrBlock}
    <p class="footer">Cảm ơn quý khách!</p>
    <p class="footer">${formatDateTime(new Date().toISOString())}</p>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>
        (function() {
            var payload = ${JSON.stringify(qrPayload)};
            if (payload && document.getElementById('payment-qr')) {
                try {
                    new QRCode(document.getElementById('payment-qr'), {
                        text: payload,
                        width: 168,
                        height: 168,
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (e) { console.error(e); }
            }
            setTimeout(function() { window.print(); }, 600);
        })();
    <\/script>
</body>
</html>`;
}

export function printThermalInvoice(order: Order): void {
    const html = buildThermalInvoiceHtml(order);
    const win = window.open('', '_blank', 'width=400,height=720');
    if (!win) {
        alert('Trình duyệt chặn cửa sổ in. Vui lòng cho phép popup.');
        return;
    }
    win.document.write(html);
    win.document.close();
}
