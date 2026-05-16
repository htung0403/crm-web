import type { Order, OrderItem } from '@/hooks/useOrders';
import { formatDateTime } from '@/lib/utils';
import { getPaymentConfig, isPaymentConfigured, type PaymentConfig } from '@/lib/paymentConfig';
import { buildVietQrPayload } from '@/lib/vietqr';

const INVOICE_FOOTER_NOTES = [
    'Giữ hoá đơn cẩn thận và mang theo khi đến lấy đồ. Hoặc hóa đơn qua zalo XoXo sẽ KHÔNG TRẢ ĐỒ nếu KHÔNG CÓ HOÁ ĐƠN.',
    'Xác nhận chính xác tình trạng đồ với nhận viên Xoxo, mọi vấn đề trên đồ đã có trước đó. Xoxo sẽ không chịu trách nhiệm',
    'Kiểm tra kỹ đồ trước khi mang về. Nếu có điều gì chưa hài lòng về đồ, hãy trao đổi ngay với nhân viên tại quầy. Xoxo sẽ không chịu trách nhiệm khi quý khách đã mang đồ ra khỏi cửa hàng.',
    'Xoxo không chịu trách nhiệm với các trường hợp mất mát, hư hỏng khi có 1 bên thứ 3 thay khách đến nhận đồ.',
    'Vui lòng lấy đồ đúng hẹn. Xoxo sẽ không chịu trách nhiệm cho những hoá đơn quá hạn trên 2 tuần.',
];

const UNIT_SUFFIX: Record<string, string> = {
    product: 'chiếc',
    service: 'lần',
    package: 'gói',
    voucher: '',
    account_card: '',
};

interface PrintSubLine {
    index: number;
    code: string;
    name: string;
    qty: string | number;
    unit: string;
}

interface PrintLine {
    name: string;
    unitSuffix?: string;
    noteLines: string[];
    unitPrice: number;
    listPrice?: number;
    quantity: number;
    total: number;
    subLines: PrintSubLine[];
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Định dạng tiền kiểu hóa đơn XOXO: 9n, 1tr */
export function formatThermalMoney(amount: number): string {
    const n = Math.round(amount);
    if (n >= 1_000_000) {
        const tr = n / 1_000_000;
        return Number.isInteger(tr) ? `${tr}tr` : `${tr.toFixed(1).replace(/\.0$/, '')}tr`;
    }
    if (n >= 1000) {
        return `${Math.round(n / 1000)}n`;
    }
    return String(n);
}

function formatPriceCell(unitPrice: number, listPrice?: number): string {
    const unit = formatThermalMoney(unitPrice);
    if (listPrice != null && listPrice > 0 && listPrice !== unitPrice) {
        return `<span class="price-main">${unit}</span><span class="price-old">${formatThermalMoney(listPrice)}</span>`;
    }
    return unit;
}

function extractNoteLines(item: OrderItem): string[] {
    const sd = ((item as { sales_step_data?: Record<string, unknown> }).sales_step_data || {}) as Record<
        string,
        unknown
    >;
    const lines: string[] = [];

    for (const key of [
        'note',
        'notes',
        'description',
        'deduct_note',
        'package_note',
        'item_note',
        'deduction_note',
    ]) {
        const v = sd[key];
        if (typeof v === 'string' && v.trim()) lines.push(v.trim());
    }

    if (item.accessory?.notes?.trim()) lines.push(item.accessory.notes.trim());
    if (item.partner?.notes?.trim()) lines.push(item.partner.notes.trim());

    return lines;
}

function extractPackageSubLines(item: OrderItem): PrintSubLine[] {
    const sd = ((item as { sales_step_data?: Record<string, unknown> }).sales_step_data || {}) as Record<
        string,
        unknown
    >;
    const raw =
        sd.package_services ||
        sd.package_items ||
        (item as { package_services?: unknown[] }).package_services ||
        [];

    if (!Array.isArray(raw)) return [];

    return raw.map((ps: Record<string, unknown>, idx) => ({
        index: idx + 1,
        code: String(ps.service_code || ps.code || ps.item_code || ''),
        name: String(ps.service_name || ps.name || ps.item_name || ''),
        qty: (ps.quantity ?? ps.remaining ?? ps.qty ?? '') as string | number,
        unit: String(ps.unit || 'Buổi'),
    }));
}

export function collectPrintLineItems(order: Order): PrintLine[] {
    const lines: PrintLine[] = [];

    for (const item of order.items || []) {
        if (!item.item_name?.trim()) continue;

        const isCustomerProductHeader =
            item.is_customer_item && item.item_type === 'product' && !item.unit_price && !item.total_price;
        if (isCustomerProductHeader) continue;

        const qty = item.quantity ?? 1;
        const unitPrice = Number(item.unit_price) || 0;
        const total = Number(item.total_price) || qty * unitPrice;

        if (total <= 0 && unitPrice <= 0 && item.item_type !== 'package') continue;

        const sd = ((item as { sales_step_data?: Record<string, unknown> }).sales_step_data || {}) as Record<
            string,
            unknown
        >;
        const noteLines = extractNoteLines(item);
        const subLines = item.item_type === 'package' ? extractPackageSubLines(item) : [];

        const suffix = UNIT_SUFFIX[item.item_type];
        let displayName = item.item_name;
        if (suffix && !displayName.toLowerCase().includes(`(${suffix})`)) {
            displayName = `${displayName} (${suffix.charAt(0).toUpperCase() + suffix.slice(1)})`;
        }

        if (item.item_type === 'voucher' || item.item_type === 'account_card') {
            const denom = Number(sd.face_value ?? sd.denomination ?? unitPrice);
            noteLines.push(
                `Mệnh giá: ${denom.toLocaleString('vi-VN')} đ - áp dụng: ${
                    (sd.apply_scope as string) || 'Một số sản phẩm, dịch vụ, gói dịch vụ'
                }`
            );
        }

        const listPrice = Number(sd.list_price ?? sd.original_price ?? 0);

        lines.push({
            name: displayName,
            unitSuffix: suffix,
            noteLines,
            unitPrice,
            listPrice: listPrice > 0 && listPrice !== unitPrice ? listPrice : undefined,
            quantity: qty,
            total,
            subLines,
        });
    }

    return lines;
}

export function getOrderPayAmount(order: Order): number {
    if (order.payment_status === 'paid') return 0;
    if (order.remaining_debt != null && order.remaining_debt > 0) return order.remaining_debt;
    const paid = order.paid_amount ?? 0;
    return Math.max(0, (order.total_amount ?? 0) - paid);
}

function buildItemsTableHtml(lines: PrintLine[]): string {
    if (lines.length === 0) {
        return '<p class="empty-items">Không có dòng hàng</p>';
    }

    const bodyRows = lines
        .map((line) => {
            const notesHtml = line.noteLines
                .map((n) => `<tr><td colspan="3" class="item-note">${escapeHtml(n)}</td></tr>`)
                .join('');

            const subHtml = line.subLines
                .map(
                    (s) =>
                        `<tr><td colspan="3" class="pkg-line">${s.index} ${escapeHtml(s.code)} ${escapeHtml(s.name)} ${escapeHtml(String(s.qty))} ${escapeHtml(s.unit)}</td></tr>`
                )
                .join('');

            return `
            <tr><td colspan="3" class="item-title">${escapeHtml(line.name)}</td></tr>
            ${notesHtml}
            ${subHtml}
            <tr class="item-values">
                <td class="col-price">${formatPriceCell(line.unitPrice, line.listPrice)}</td>
                <td class="col-qty">${line.quantity}</td>
                <td class="col-total">${formatThermalMoney(line.total)}</td>
            </tr>
            <tr class="item-spacer"><td colspan="3"></td></tr>`;
        })
        .join('');

    return `
    <table class="items-table">
        <colgroup>
            <col class="col-price-w" />
            <col class="col-qty-w" />
            <col class="col-total-w" />
        </colgroup>
        <thead>
            <tr>
                <th class="col-price">Đơn giá</th>
                <th class="col-qty">SL</th>
                <th class="col-total">Thành tiền</th>
            </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
    </table>`;
}

function buildTotalsTableHtml(subtotal: number, discount: number, total: number): string {
    return `
    <table class="totals-table">
        <colgroup>
            <col class="col-price-w" />
            <col class="col-qty-w" />
            <col class="col-total-w" />
        </colgroup>
        <tbody>
            <tr>
                <td colspan="2" class="total-label">Tổng tiền hàng:</td>
                <td class="col-total">${formatThermalMoney(subtotal)}</td>
            </tr>
            ${
                discount > 0
                    ? `<tr>
                <td colspan="2" class="total-label">Chiết khấu:</td>
                <td class="col-total">${formatThermalMoney(discount)}</td>
            </tr>`
                    : ''
            }
            <tr class="grand">
                <td colspan="2" class="total-label">Tổng cộng:</td>
                <td class="col-total">${formatThermalMoney(total)}</td>
            </tr>
        </tbody>
    </table>`;
}

const THERMAL_STYLES = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 80mm auto; margin: 2mm; }
        body, .thermal-preview, .invoice-sheet {
            width: 72mm;
            max-width: 72mm;
            margin: 0 auto;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .invoice-sheet { padding: 2mm 3mm; }
        .logo { display: block; margin: 0 auto 4px; max-width: 48mm; max-height: 18mm; height: auto; object-fit: contain; }
        .shop-name { text-align: center; font-size: 11px; font-weight: 700; margin-top: 2px; }
        .shop-line { text-align: center; font-size: 9px; margin: 1px 0; line-height: 1.35; }
        .meta { margin: 6px 0 4px; font-size: 10px; }
        .meta-row { margin: 2px 0; }
        .invoice-title { text-align: center; font-weight: 700; font-size: 11px; margin: 8px 0 2px; }
        .invoice-code { text-align: center; font-weight: 700; font-size: 12px; margin-bottom: 6px; }
        .block { margin: 4px 0; font-size: 10px; line-height: 1.4; }
        .block p { margin: 2px 0; }
        .label { font-weight: 600; }
        .terms { font-size: 9px; font-style: italic; margin: 6px 0; line-height: 1.35; text-align: left; }
        .col-price-w { width: 40%; }
        .col-qty-w { width: 12%; }
        .col-total-w { width: 48%; }
        .items-table, .totals-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 10px;
        }
        .items-table { margin: 4px 0; }
        .items-table thead th {
            font-weight: 700;
            font-size: 9px;
            padding: 3px 2px;
            border-bottom: 1px solid #000;
            vertical-align: bottom;
        }
        .items-table td, .totals-table td { padding: 2px; vertical-align: top; word-break: break-word; }
        .col-price { text-align: left; }
        .col-qty { text-align: center; }
        .col-total { text-align: right; font-weight: 600; white-space: nowrap; }
        .item-title {
            font-weight: 700;
            font-size: 10px;
            padding: 6px 2px 2px !important;
            text-align: left;
            line-height: 1.35;
        }
        .item-note, .pkg-line {
            font-size: 9px;
            padding: 1px 2px 1px 6px !important;
            text-align: left;
            line-height: 1.35;
            color: #222;
        }
        .item-values td { padding-top: 1px; padding-bottom: 4px; }
        .item-spacer td { height: 4px; padding: 0 !important; border: none; }
        .price-main { display: block; line-height: 1.25; }
        .price-old { display: block; font-size: 8px; color: #555; text-decoration: line-through; line-height: 1.2; }
        .empty-items { text-align: center; font-size: 10px; color: #555; padding: 8px 0; }
        .notes-block { margin: 8px 0 4px; font-size: 10px; }
        .totals-table { margin-top: 4px; border-top: 1px solid #000; }
        .totals-table td { padding: 3px 2px; }
        .total-label { text-align: left; font-size: 10px; }
        .totals-table .grand td { font-weight: 700; font-size: 11px; padding-top: 4px; }
        .footer-title { font-weight: 700; margin: 10px 0 4px; font-size: 10px; text-align: left; }
        .footer-note { font-size: 8.5px; line-height: 1.35; margin: 3px 0; text-align: justify; }
        .footer-note::before { content: "- "; }
        .thanks { text-align: center; font-weight: 700; margin: 10px 0 6px; font-size: 10px; }
        .qr-block { text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #000; }
        .qr-title { font-weight: 700; font-size: 10px; }
        .qr-amount { font-size: 14px; font-weight: 700; margin: 4px 0; }
        .qr-box { display: flex; justify-content: center; margin: 6px auto; min-height: 140px; }
        .qr-box canvas, .qr-box img { width: 38mm !important; height: 38mm !important; }
        .bank { font-size: 9px; margin: 1px 0; }
        .warn { text-align: center; font-size: 9px; color: #555; margin-top: 6px; }
        @media print { body { width: 72mm; } }
`;

function buildInvoiceBody(order: Order, cfg: PaymentConfig): string {
    const customer = order.customer as { name?: string; phone?: string; address?: string; email?: string } | undefined;
    const saleDate = order.confirmed_at || order.created_at;
    const lines = collectPrintLineItems(order);
    const subtotal = order.subtotal ?? lines.reduce((s, l) => s + l.total, 0);
    const discount = order.discount ?? 0;

    const itemsTableHtml = buildItemsTableHtml(lines);
    const totalsHtml = buildTotalsTableHtml(subtotal, discount, order.total_amount);

    const notesBlock = order.notes?.trim()
        ? `<div class="notes-block"><span class="label">Ghi chú</span><br/>${escapeHtml(order.notes)}</div>`
        : '';

    return `
    <div class="invoice-sheet">
    <img class="logo" src="${escapeHtml(cfg.companyLogoUrl)}" alt="Logo" />
    <p class="shop-name">${escapeHtml(cfg.companyName)}</p>
    ${cfg.companyAddress ? `<p class="shop-line">Địa chỉ: ${escapeHtml(cfg.companyAddress)}</p>` : ''}
    ${cfg.companyPhone ? `<p class="shop-line">Điện thoại: ${escapeHtml(cfg.companyPhone)}</p>` : ''}

    <div class="meta">
        <p class="meta-row">Liên số: ${escapeHtml(cfg.invoiceCopyLabel)}</p>
        <p class="meta-row">Ngày bán: ${formatDateTime(saleDate || new Date().toISOString())}</p>
    </div>

    <p class="invoice-title">HOÁ ĐƠN BÁN HÀNG</p>
    <p class="invoice-code">${escapeHtml(order.order_code)}</p>

    <div class="block">
        <p><span class="label">Khách hàng:</span> ${escapeHtml(customer?.name || '—')}</p>
        ${customer?.address ? `<p><span class="label">Địa chỉ:</span> ${escapeHtml(customer.address)}</p>` : ''}
        ${customer?.phone ? `<p><span class="label">Điện thoại:</span> ${escapeHtml(customer.phone)}</p>` : ''}
    </div>

    <p class="terms">${escapeHtml(cfg.termsAgreementLine)}</p>
    <p class="block"><span class="label">Nhân viên bán hàng:</span> ${escapeHtml(order.sales_user?.name || '—')}</p>

    ${itemsTableHtml}

    ${notesBlock}

    ${totalsHtml}

    <p class="footer-title">Quý khách lưu ý:</p>
    ${INVOICE_FOOTER_NOTES.map((n) => `<p class="footer-note">${escapeHtml(n)}</p>`).join('')}
    <p class="thanks">Cảm ơn quý khách đã sử dụng dịch vụ của Xoxo Luxury!</p>
    </div>
    `;
}

export function buildThermalInvoiceHtml(order: Order, config?: PaymentConfig): string {
    const cfg = config ?? getPaymentConfig();
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

    const qrBlock = hasQr
        ? `
        <div class="qr-block">
            <p class="qr-title">QUÉT MÃ THANH TOÁN</p>
            <p class="qr-amount">${formatThermalMoney(payAmount)}</p>
            <div id="payment-qr" class="qr-box"></div>
            <p class="bank">${escapeHtml(cfg.bankName)} · ${escapeHtml(cfg.accountNumber)}</p>
            <p class="bank">ND: ${escapeHtml(order.order_code)}</p>
        </div>`
        : payAmount > 0 && !isPaymentConfigured()
          ? `<p class="warn">Chưa cấu hình TK nhận tiền (VITE_PAYMENT_* trong .env)</p>`
          : '';

    const body = buildInvoiceBody(order, cfg);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Hóa đơn ${escapeHtml(order.order_code)}</title>
    <style>${THERMAL_STYLES}</style>
</head>
<body>
    ${body}
    ${qrBlock}
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    <script>
        (function() {
            var payload = ${JSON.stringify(qrPayload)};
            if (payload && document.getElementById('payment-qr')) {
                try {
                    new QRCode(document.getElementById('payment-qr'), {
                        text: payload,
                        width: 152,
                        height: 152,
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch (e) { console.error(e); }
            }
            setTimeout(function() { window.print(); }, 700);
        })();
    <\/script>
</body>
</html>`;
}

/** HTML fragment for in-app preview (no print script) */
export function buildThermalInvoicePreviewHtml(order: Order, config?: PaymentConfig): string {
    const cfg = config ?? getPaymentConfig();
    const body = buildInvoiceBody(order, cfg);

    const payAmount = getOrderPayAmount(order);
    const qrNote =
        payAmount > 0 && isPaymentConfigured()
            ? `<p class="warn" style="text-align:center;margin-top:8px;">Còn thanh toán: ${formatThermalMoney(payAmount)} (QR khi in)</p>`
            : '';

    return `${body}${qrNote}<style>${THERMAL_STYLES}</style>`;
}

export function printThermalInvoice(order: Order): void {
    const html = buildThermalInvoiceHtml(order);
    const win = window.open('', '_blank', 'width=400,height=820');
    if (!win) {
        alert('Trình duyệt chặn cửa sổ in. Vui lòng cho phép popup.');
        return;
    }
    win.document.write(html);
    win.document.close();
}
