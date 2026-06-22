export function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    const units = ['KB', 'MB', 'GB'];
    let i = -1;
    do { bytes /= 1024; i++; } while (bytes >= 1024 && i < units.length - 1);
    return bytes.toFixed(bytes < 10 ? 1 : 0) + ' ' + units[i];
}

export function fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        pdf: 'file-text', doc: 'file-text', docx: 'file-text',
        xls: 'table', xlsx: 'table', csv: 'table',
        zip: 'archive', gz: 'archive', tar: 'archive', rar: 'archive',
        mp3: 'music', wav: 'music', ogg: 'music',
        mp4: 'film', mov: 'film', avi: 'film', webm: 'film',
        js: 'code', css: 'code', html: 'code', json: 'code', xml: 'code',
        txt: 'file-text', md: 'file-text', rtf: 'file-text',
        svg: 'image',
    };
    return map[ext] || 'file';
}

export function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function formatLabel(s) {
    if (!s) return s;
    return s.replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
}

export function formatDate(value) {
    if (!value) return '';
    const opts = { year: 'numeric', month: 'short', day: 'numeric' };
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, day] = value.split('-').map(Number);
        return new Date(y, m - 1, day).toLocaleDateString('en-US', opts);
    }
    const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', opts);
}
