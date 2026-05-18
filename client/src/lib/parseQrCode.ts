/** Trích mã từ nội dung QR (URL hoặc chuỗi thô). */
export function parseScannedCode(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    try {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            const url = new URL(trimmed);
            const path = decodeURIComponent(url.pathname);
            for (const prefix of ['/task/', '/product/', '/orders/']) {
                const idx = path.indexOf(prefix);
                if (idx !== -1) {
                    const segment = path
                        .slice(idx + prefix.length)
                        .split('/')[0]
                        ?.split('?')[0]
                        ?.split('#')[0];
                    if (segment) return decodeURIComponent(segment);
                }
            }
        }
    } catch {
        // fall through
    }

    for (const prefix of ['/task/', '/product/', '/orders/']) {
        if (trimmed.includes(prefix)) {
            const segment = trimmed.split(prefix).pop()?.split(/[?#]/)[0];
            if (segment) return segment.trim();
        }
    }

    return trimmed;
}
