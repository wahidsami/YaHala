import { v4 as uuidv4 } from 'uuid';

export const WIDGET_TYPES = [
    { type: 'text', label: 'Text Block', icon: 'Type', category: 'content' },
    { type: 'image', label: 'Image', icon: 'Image', category: 'content' },
    { type: 'logo', label: 'Entity Logo', icon: 'Shield', category: 'content' },
    { type: 'event_details', label: 'Event Details', icon: 'Calendar', category: 'event' },
    { type: 'qr_code', label: 'QR Code', icon: 'QrCode', category: 'event' },
    { type: 'guest_name', label: 'Guest Name', icon: 'User', category: 'guest' },
    { type: 'response', label: 'Response', icon: 'Reply', category: 'guest' },
    { type: 'voice_recorder', label: 'Voice Recorder', icon: 'Mic', category: 'post_event' },
    { type: 'text_submission', label: 'Text Submission', icon: 'MessageSquare', category: 'post_event' },
    { type: 'survey', label: 'Survey', icon: 'ClipboardList', category: 'post_event' }
];

export const WIDGET_CATEGORIES = [
    { id: 'content', label: 'Content' },
    { id: 'event', label: 'Event' },
    { id: 'guest', label: 'Guest' },
    { id: 'post_event', label: 'Post-Event' }
];

export const DEFAULT_WIDGET_CONTENT = {
    text: {
        ar: { text: 'نص جديد' },
        en: { text: 'New text' }
    },
    image: {
        ar: { url: '', alt: '' },
        en: { url: '', alt: '' }
    },
    logo: {
        ar: { alt: 'Logo' },
        en: { alt: 'Logo' }
    },
    event_details: {
        ar: { showDate: true, showTime: true, showVenue: true },
        en: { showDate: true, showTime: true, showVenue: true }
    },
    qr_code: {
        ar: { label: 'رمز الدخول' },
        en: { label: 'Entry QR Code' }
    },
    guest_name: {
        ar: { prefix: 'مرحباً', position: '' },
        en: { prefix: 'Welcome', position: '' }
    },
    response: {
        ar: { label: 'تأكيد الحضور' },
        en: { label: 'Confirm attendance' }
    },
    voice_recorder: {
        ar: { label: 'سجل رسالة صوتية', maxDuration: 60 },
        en: { label: 'Record a voice message', maxDuration: 60 }
    },
    text_submission: {
        ar: { label: 'اكتب رسالتك', placeholder: 'اكتب هنا...', maxLength: 500 },
        en: { label: 'Write your message', placeholder: 'Type here...', maxLength: 500 }
    },
    survey: {
        ar: { questions: [] },
        en: { questions: [] }
    }
};

export const DEFAULT_WIDGET_STYLE = {
    fontSize: 16,
    textAlign: 'center',
    color: '#000000',
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 8,
    fontFamily: 'Noto Sans Arabic',
    fontWeight: 'normal'
};

export const FONT_FAMILIES = [
    { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' },
    { value: 'Cairo', label: 'Cairo' },
    { value: 'Tajawal', label: 'Tajawal' },
    { value: 'Almarai', label: 'Almarai' },
    { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Sans Arabic' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' }
];

export function createDefaultWidget(type) {
    const isLogo = type === 'logo';

    return {
        id: uuidv4(),
        type,
        content: JSON.parse(JSON.stringify(DEFAULT_WIDGET_CONTENT[type] || {})),
        style: {
            ...DEFAULT_WIDGET_STYLE,
            padding: isLogo ? 0 : DEFAULT_WIDGET_STYLE.padding,
            backgroundColor: isLogo ? 'transparent' : DEFAULT_WIDGET_STYLE.backgroundColor
        },
        geometry: { x: 20, y: 20, w: 280, h: 80 }, // Default position & size within 360px wide canvas (center-ish)
        config: {},
        rules: []
    };
}

export const RULE_CONDITIONS = [
    { type: 'time', operator: 'before_event_start', label: 'Before event starts' },
    { type: 'time', operator: 'during_event', label: 'During event' },
    { type: 'time', operator: 'after_event_end', label: 'After event ends' },
    { type: 'scan', operator: 'checked_in', label: 'Guest checked in' },
    { type: 'scan', operator: 'not_scanned', label: 'Guest not scanned' },
    { type: 'event', operator: 'type_is', label: 'Event type is', hasValue: true, values: ['wedding', 'corporate', 'social'] },
    { type: 'guest', operator: 'group_is', label: 'Guest group is', hasValue: true, values: ['vip', 'family', 'regular'] }
];

export const RULE_ACTIONS = [
    { action: 'show', label: 'Show' },
    { action: 'hide', label: 'Hide' }
];
