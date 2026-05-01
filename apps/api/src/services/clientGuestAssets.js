import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AppError } from '../middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_GUEST_AVATAR_DIR = path.join(__dirname, '../../storage/client-guest-avatars');
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

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
        default:
            return null;
    }
}

function parseDataUrl(dataUrl) {
    const value = normalizeText(dataUrl);
    if (!value.startsWith('data:') || !value.includes('base64,')) {
        throw new AppError('Guest avatar image is invalid', 400, 'VALIDATION_ERROR');
    }

    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        throw new AppError('Guest avatar image is invalid', 400, 'VALIDATION_ERROR');
    }

    const mimeType = match[1];
    const base64Payload = match[2];
    const buffer = Buffer.from(base64Payload, 'base64');

    if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) {
        throw new AppError('Guest avatar image is invalid', 400, 'VALIDATION_ERROR');
    }

    return {
        mimeType,
        buffer,
        extension: getExtensionFromMime(mimeType)
    };
}

export async function saveClientGuestAvatar(clientId, guestId, dataUrl) {
    if (!normalizeText(dataUrl)) {
        return null;
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed?.extension) {
        throw new AppError('Guest avatar image is invalid', 400, 'VALIDATION_ERROR');
    }

    await fs.mkdir(CLIENT_GUEST_AVATAR_DIR, { recursive: true });

    const fileName = `client-${clientId}-guest-${guestId}.${parsed.extension}`;
    const filePath = path.join(CLIENT_GUEST_AVATAR_DIR, fileName);
    await fs.writeFile(filePath, parsed.buffer);

    return `/storage/client-guest-avatars/${fileName}`;
}

