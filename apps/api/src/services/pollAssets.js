import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppError } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLL_COVER_DIR = path.join(__dirname, '../../storage/poll-covers');
const POLL_OPTION_MEDIA_DIR = path.join(__dirname, '../../storage/poll-options');
const MAX_COVER_BYTES = 5 * 1024 * 1024;

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getExtensionFromMime(mimeType) {
    const mime = normalizeText(mimeType).toLowerCase();

    switch (mime) {
        case 'image/png':
            return 'png';
        case 'image/jpeg':
        case 'image/jpg':
            return 'jpg';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        case 'image/svg+xml':
            return 'svg';
        default:
            return null;
    }
}

function parseDataUrl(dataUrl) {
    const value = normalizeText(dataUrl);
    if (!value.startsWith('data:') || !value.includes('base64,')) {
        throw new AppError('Poll cover image is invalid', 400, 'VALIDATION_ERROR');
    }

    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        throw new AppError('Poll cover image is invalid', 400, 'VALIDATION_ERROR');
    }

    const mimeType = match[1];
    const base64Payload = match[2];
    const buffer = Buffer.from(base64Payload, 'base64');

    if (!buffer.length || buffer.length > MAX_COVER_BYTES) {
        throw new AppError('Poll cover image is invalid', 400, 'VALIDATION_ERROR');
    }

    return {
        mimeType,
        buffer,
        extension: getExtensionFromMime(mimeType)
    };
}

export async function savePollCover(pollId, dataUrl) {
    if (!normalizeText(dataUrl)) {
        return null;
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed?.extension) {
        throw new AppError('Poll cover image is invalid', 400, 'VALIDATION_ERROR');
    }

    await fs.mkdir(POLL_COVER_DIR, { recursive: true });

    const fileName = `poll-${pollId}.${parsed.extension}`;
    const filePath = path.join(POLL_COVER_DIR, fileName);
    await fs.writeFile(filePath, parsed.buffer);

    return `/storage/poll-covers/${fileName}`;
}

export async function savePollOptionMedia(pollId, optionId, dataUrl, kind = 'image') {
    if (!normalizeText(dataUrl)) {
        return null;
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed?.extension) {
        throw new AppError('Poll option media is invalid', 400, 'VALIDATION_ERROR');
    }

    await fs.mkdir(POLL_OPTION_MEDIA_DIR, { recursive: true });

    const safeKind = normalizeText(kind) || 'image';
    const fileName = `poll-${pollId}-option-${optionId}-${safeKind}.${parsed.extension}`;
    const filePath = path.join(POLL_OPTION_MEDIA_DIR, fileName);
    await fs.writeFile(filePath, parsed.buffer);

    return `/storage/poll-options/${fileName}`;
}
