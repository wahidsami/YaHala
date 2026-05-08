import { AppError } from '../middleware/errorHandler.js';

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function localizedText(language, valueEn, valueAr) {
    return language === 'ar' ? (valueAr || valueEn || '') : (valueEn || valueAr || '');
}

function formatDateTime(language, value) {
    if (!value) {
        return '';
    }

    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(value));
}

function formatEventLocation(language, event) {
    const venue = localizedText(language, event?.venue, event?.venue_ar);
    const address = [
        event?.address_street,
        event?.address_district,
        event?.address_city,
        event?.address_region,
        event?.address_building_number && `Bldg ${event.address_building_number}`,
        event?.address_additional_number && `Addl ${event.address_additional_number}`,
        event?.address_unit_number && `Unit ${event.address_unit_number}`,
        event?.address_postal_code && `P.O. ${event.address_postal_code}`
    ].filter(Boolean).join(', ');

    if (venue && address) {
        return `${venue} - ${address}`;
    }

    return venue || address;
}

export function getPublicInvitationBaseUrl() {
    return normalizeText(process.env.PUBLIC_INVITATION_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function getPublicAssetsBaseUrl() {
    const configured = normalizeText(process.env.PUBLIC_ASSETS_BASE_URL || process.env.PUBLIC_API_BASE_URL || '');
    if (configured) {
        return configured.replace(/\/+$/, '');
    }
    return getPublicInvitationBaseUrl();
}

function resolvePublicAssetUrl(assetPath) {
    const value = normalizeText(assetPath);
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return `${getPublicAssetsBaseUrl()}${value}`;
    return `${getPublicAssetsBaseUrl()}/${value}`;
}

export function buildInvitationEmailContent({ project, recipient, publicLink, language = 'ar' }) {
    const guestName = localizedText(language, recipient.display_name, recipient.display_name_ar) || recipient.display_name || recipient.display_name_ar || 'Guest';
    const clientName = localizedText(language, project.client?.name || project.client_name, project.client?.name_ar || project.client_name_ar);
    const eventName = localizedText(language, project.event?.name || project.event_name, project.event?.name_ar || project.event_name_ar);
    const eventDate = formatDateTime(language, project.event?.start_datetime || project.start_datetime);
    const eventLocation = formatEventLocation(language, project.event || project);
    const invitationTitle = localizedText(language, project.name, project.name_ar);
    const clientLogoPath = project.client?.logo_path || project.client_logo_path || '';
    const eventLogoPath = project.event?.event_logo_path || project.event_logo_path || '';
    const headerLogoUrl = resolvePublicAssetUrl(clientLogoPath || eventLogoPath);
    const isArabic = language === 'ar';
    const subject = isArabic
        ? `دعوة إلى ${eventName || invitationTitle || clientName || ''}`.trim()
        : `Invitation to ${eventName || invitationTitle || clientName || ''}`.trim();

    const text = isArabic
        ? `مرحباً ${guestName}،\n\nلديك دعوة جديدة من ${clientName || 'Rawaj'}.\n${eventName ? `الفعالية: ${eventName}\n` : ''}${eventDate ? `التاريخ: ${eventDate}\n` : ''}${eventLocation ? `الموقع: ${eventLocation}\n` : ''}\nافتح بطاقة الدعوة من الرابط التالي:\n${publicLink}\n\nملاحظة: الرابط شخصي ومخصص لك.\n\nمع التحية،\n${clientName || 'Rawaj'}`
        : `Hello ${guestName},\n\nYou have a new invitation from ${clientName || 'Rawaj'}.\n${eventName ? `Event: ${eventName}\n` : ''}${eventDate ? `Date: ${eventDate}\n` : ''}${eventLocation ? `Location: ${eventLocation}\n` : ''}\nOpen your invitation card here:\n${publicLink}\n\nNote: this link is personal and unique to you.\n\nBest regards,\n${clientName || 'Rawaj'}`;

    const html = `
        <div style="direction:${isArabic ? 'rtl' : 'ltr'};font-family:Arial,sans-serif;background:#f6f7fb;padding:32px">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 18px 50px rgba(15,23,42,.08)">
                <div style="padding:26px 30px;background:linear-gradient(135deg,#0f172a,#1e293b 55%,#0f766e);color:#fff">
                    ${headerLogoUrl ? `<div style="margin:0 0 14px"><img src="${escapeAttribute(headerLogoUrl)}" alt="${escapeAttribute(clientName || eventName || 'Logo')}" style="max-width:140px;max-height:56px;object-fit:contain;display:block" /></div>` : ''}
                    <p style="margin:0 0 10px;opacity:.82;letter-spacing:.12em;text-transform:uppercase;font-size:12px">${isArabic ? 'دعوة رقمية' : 'Digital Invitation'}</p>
                    <h1 style="margin:0;font-size:28px;line-height:1.2">${escapeHtml(invitationTitle || eventName || clientName || (isArabic ? 'دعوة' : 'Invitation'))}</h1>
                    <p style="margin:14px 0 0;opacity:.9;line-height:1.7">${escapeHtml(isArabic ? `مرحباً ${guestName}` : `Hello ${guestName}`)}</p>
                </div>
                <div style="padding:30px">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px 20px;margin-bottom:22px">
                        <p style="margin:0 0 8px;color:#0f172a;font-weight:700">${escapeHtml(isArabic ? 'تفاصيل الدعوة' : 'Invitation details')}</p>
                        ${eventName ? `<p style="margin:0 0 8px;color:#334155;line-height:1.8"><strong>${escapeHtml(isArabic ? 'الفعالية:' : 'Event:')}</strong> ${escapeHtml(eventName)}</p>` : ''}
                        ${eventDate ? `<p style="margin:0 0 8px;color:#334155;line-height:1.8"><strong>${escapeHtml(isArabic ? 'التاريخ:' : 'Date:')}</strong> ${escapeHtml(eventDate)}</p>` : ''}
                        ${eventLocation ? `<p style="margin:0;color:#334155;line-height:1.8"><strong>${escapeHtml(isArabic ? 'الموقع:' : 'Location:')}</strong> ${escapeHtml(eventLocation)}</p>` : ''}
                    </div>
                    <p style="margin:0 0 12px;color:#374151;line-height:1.8">${escapeHtml(isArabic ? `لديك دعوة جديدة من ${clientName || 'Rawaj'}.` : `You have a new invitation from ${clientName || 'Rawaj'}.`)}</p>
                    <p style="margin:0 0 22px;color:#374151;line-height:1.8">${escapeHtml(isArabic ? 'افتح بطاقة الدعوة من الرابط التالي:' : 'Open your invitation card using the link below:')}</p>
                    <div style="margin:24px 0 18px;text-align:center">
                        <a href="${escapeAttribute(publicLink)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:14px;font-weight:700">${isArabic ? 'فتح الدعوة' : 'Open Invitation'}</a>
                    </div>
                    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.7">${escapeHtml(isArabic ? 'هذا الرابط شخصي ومخصص لك فقط.' : 'This link is personal and unique to you.')}</p>
                </div>
            </div>
        </div>
    `;

    return { subject, text, html };
}

function escapeHtml(value) {
    return normalizeText(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('`', '&#96;');
}

export async function sendResendEmail({ to, subject, text, html }) {
    const apiKey = normalizeText(process.env.RESEND_API_KEY);
    const from = normalizeText(process.env.RESEND_FROM_EMAIL || '');

    if (!apiKey || !from) {
        throw new AppError('Email provider is not configured', 503, 'EMAIL_PROVIDER_NOT_CONFIGURED');
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            text,
            html
        })
    });

    const responseText = await response.text();
    let payload = null;

    try {
        payload = JSON.parse(responseText);
    } catch {
        payload = { raw: responseText };
    }

    if (!response.ok) {
        throw new AppError(
            payload?.message || payload?.error || `Resend request failed (${response.status})`,
            502,
            'EMAIL_SEND_FAILED'
        );
    }

    return payload;
}
