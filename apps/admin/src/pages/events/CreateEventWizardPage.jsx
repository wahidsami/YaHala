import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ImagePlus, MapPin, Upload, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './CreateEventWizardPage.css';

const EVENT_TILES = [
    { id: 'birthday', backend: 'social', emoji: '🎂', en: 'Birthday', ar: 'عيد ميلاد' },
    { id: 'wedding', backend: 'wedding', emoji: '💍', en: 'Wedding', ar: 'زفاف' },
    { id: 'engagement', backend: 'social', emoji: '💐', en: 'Engagement', ar: 'خطوبة' },
    { id: 'brunch', backend: 'social', emoji: '🥂', en: 'Brunch', ar: 'برانش' },
    { id: 'baby-shower', backend: 'social', emoji: '🧸', en: 'Baby Shower', ar: 'استقبال مولود' },
    { id: 'corporate', backend: 'corporate', emoji: '💼', en: 'Corporate', ar: 'شركات' }
];

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function storageUrl(path) {
    if (!path) {
        return '';
    }
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) {
        return path;
    }
    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const origin = baseUrl.replace(/\/api\/?$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function CreateEventWizardPage() {
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState(1);
    const [themeType, setThemeType] = useState('birthday');
    const [clients, setClients] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [clientGuests, setClientGuests] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(searchParams.get('templateId') || '');
    const [selectedGuestIds, setSelectedGuestIds] = useState([]);
    const [eventId, setEventId] = useState('');
    const [projectCreated, setProjectCreated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [logoPreview, setLogoPreview] = useState('');
    const dirtyRef = useRef(false);
    const [formData, setFormData] = useState({
        clientId: '',
        name: '',
        nameAr: '',
        startDatetime: '',
        endDatetime: '',
        timezone: 'Asia/Riyadh',
        venue: '',
        venueAr: '',
        locationMode: 'maps',
        googleMapUrl: '',
        addressRegion: '',
        addressCity: '',
        addressDistrict: '',
        addressStreet: '',
        addressBuildingNumber: '',
        addressAdditionalNumber: '',
        addressPostalCode: '',
        addressUnitNumber: '',
        eventLogoDataUrl: ''
    });

    useEffect(() => {
        let mounted = true;
        async function loadReferences() {
            setLoading(true);
            try {
                const [clientRes, templateRes] = await Promise.all([
                    api.get('/admin/clients?page=1&pageSize=200&status=active'),
                    api.get('/admin/templates?page=1&pageSize=80')
                ]);
                if (!mounted) {
                    return;
                }
                setClients(clientRes.data?.data || []);
                setTemplates(templateRes.data?.data || []);
            } catch (loadError) {
                console.error('Failed to load event wizard references:', loadError);
                if (mounted) {
                    setError(localize(i18n, 'We could not load clients or templates.', 'تعذر تحميل العملاء أو القوالب.'));
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadReferences();
        return () => {
            mounted = false;
        };
    }, [i18n]);

    useEffect(() => {
        if (!formData.clientId) {
            setClientGuests([]);
            return;
        }

        let mounted = true;
        async function loadClientGuests() {
            try {
                const response = await api.get(`/admin/clients/${formData.clientId}/guests?page=1&pageSize=120&status=active`);
                if (mounted) {
                    setClientGuests(response.data?.data || []);
                }
            } catch (loadError) {
                console.error('Failed to load client guest directory:', loadError);
                if (mounted) {
                    setClientGuests([]);
                }
            }
        }

        loadClientGuests();
        return () => {
            mounted = false;
        };
    }, [formData.clientId]);

    useEffect(() => {
        function handleBeforeUnload(event) {
            if (!dirtyRef.current) {
                return;
            }
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const selectedTheme = EVENT_TILES.find((tile) => tile.id === themeType) || EVENT_TILES[0];
    const selectedClient = clients.find((client) => client.id === formData.clientId);
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

    const canContinueFromDetails = Boolean(
        formData.clientId &&
        formData.name.trim() &&
        formData.startDatetime &&
        formData.endDatetime
    );

    function setField(key, value) {
        dirtyRef.current = true;
        setFormData((current) => ({ ...current, [key]: value }));
    }

    function handleLogoChange(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            setLogoPreview(result);
            setField('eventLogoDataUrl', result);
        };
        reader.readAsDataURL(file);
    }

    async function ensureProjectForEvent(createdEventId) {
        if (projectCreated) {
            return;
        }

        await api.post('/admin/invitation-projects', {
            clientId: formData.clientId,
            eventId: createdEventId,
            name: formData.name,
            nameAr: formData.nameAr || '',
            description: formData.venue || '',
            descriptionAr: formData.venueAr || '',
            coverTemplateId: selectedTemplateId || null
        });

        setProjectCreated(true);
    }

    async function handleContinue() {
        setSaving(true);
        setError('');

        try {
            if (step === 1) {
                setStep(2);
                return;
            }

            if (step === 2) {
                if (!canContinueFromDetails) {
                    setError(localize(i18n, 'Add the required event details first.', 'أكمل بيانات الفعالية المطلوبة أولاً.'));
                    return;
                }

                let nextEventId = eventId;
                if (!nextEventId) {
                    const response = await api.post('/admin/events', {
                        clientId: formData.clientId,
                        name: formData.name,
                        nameAr: formData.nameAr,
                        eventType: selectedTheme.backend,
                        startDatetime: formData.startDatetime,
                        endDatetime: formData.endDatetime,
                        timezone: formData.timezone,
                        venue: formData.venue,
                        venueAr: formData.venueAr,
                        locationMode: formData.locationMode,
                        googleMapUrl: formData.googleMapUrl,
                        addressRegion: formData.addressRegion,
                        addressCity: formData.addressCity,
                        addressDistrict: formData.addressDistrict,
                        addressStreet: formData.addressStreet,
                        addressBuildingNumber: formData.addressBuildingNumber,
                        addressAdditionalNumber: formData.addressAdditionalNumber,
                        addressPostalCode: formData.addressPostalCode,
                        addressUnitNumber: formData.addressUnitNumber,
                        eventLogoDataUrl: formData.eventLogoDataUrl,
                        templateId: selectedTemplateId || null,
                        status: 'draft'
                    });

                    nextEventId = response.data?.data?.id;
                    setEventId(nextEventId);
                    await ensureProjectForEvent(nextEventId);
                } else {
                    await api.put(`/admin/events/${nextEventId}`, {
                        name: formData.name,
                        nameAr: formData.nameAr,
                        eventType: selectedTheme.backend,
                        startDatetime: formData.startDatetime,
                        endDatetime: formData.endDatetime,
                        timezone: formData.timezone,
                        venue: formData.venue,
                        venueAr: formData.venueAr,
                        locationMode: formData.locationMode,
                        googleMapUrl: formData.googleMapUrl,
                        addressRegion: formData.addressRegion,
                        addressCity: formData.addressCity,
                        addressDistrict: formData.addressDistrict,
                        addressStreet: formData.addressStreet,
                        addressBuildingNumber: formData.addressBuildingNumber,
                        addressAdditionalNumber: formData.addressAdditionalNumber,
                        addressPostalCode: formData.addressPostalCode,
                        addressUnitNumber: formData.addressUnitNumber,
                        eventLogoDataUrl: formData.eventLogoDataUrl || undefined,
                        templateId: selectedTemplateId || null,
                        status: 'draft'
                    });
                }

                setStep(3);
                return;
            }

            if (step === 3) {
                if (eventId && selectedTemplateId) {
                    await api.patch(`/admin/events/${eventId}/invitation-setup`, {
                        templateId: selectedTemplateId,
                        rsvpGate: {
                            enabled: false,
                            style: { variant: 'brand', primaryColor: '#ff7f66', secondaryColor: '#dcb0ff', icon: 'sparkles' },
                            behavior: { showReasonOnNo: true, requireReasonOnNo: false },
                            copy: { en: {}, ar: {} }
                        }
                    });
                }
                setStep(4);
                return;
            }

            if (step === 4) {
                if (eventId && selectedGuestIds.length > 0) {
                    await api.post(`/admin/events/${eventId}/guest-directory/assign`, { guestIds: selectedGuestIds });
                }
                dirtyRef.current = false;
                navigate(eventId ? `/events/${eventId}` : '/events');
            }
        } catch (submitError) {
            console.error('Failed to continue event wizard:', submitError);
            setError(submitError.response?.data?.message || localize(i18n, 'We could not save this step yet.', 'تعذر حفظ هذه الخطوة حالياً.'));
        } finally {
            setSaving(false);
        }
    }

    function handleBack() {
        if (step === 1) {
            if (dirtyRef.current) {
                const confirmed = window.confirm(localize(i18n, 'Leave the wizard and discard your progress?', 'هل تريد مغادرة المعالج وفقدان التقدم؟'));
                if (!confirmed) {
                    return;
                }
            }
            navigate('/');
            return;
        }

        setStep((current) => Math.max(1, current - 1));
    }

    const previewTitle = formData.name || localize(i18n, 'Your event title', 'عنوان الفعالية');
    const previewDate = formData.startDatetime
        ? new Date(formData.startDatetime).toLocaleString(i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : localize(i18n, 'Date and time', 'التاريخ والوقت');

    const guestOptions = useMemo(
        () => clientGuests.filter((guest) => guest.email || guest.mobile_number),
        [clientGuests]
    );

    return (
        <div className="create-event-page">
            <section className="create-event-page__hero">
                <div>
                    <h1 className="hub-display-title">{localize(i18n, 'Let’s create your event', 'لننشئ فعاليتك')}</h1>
                    <p>{localize(i18n, 'A few quick steps. You can edit everything later.', 'بضع خطوات سريعة ويمكنك تعديل كل شيء لاحقاً.')}</p>
                </div>
                <div className="wizard-steps">
                    {[1, 2, 3, 4].map((item) => (
                        <div key={item} className={`wizard-step-pill ${step === item ? 'is-active' : step > item ? 'is-complete' : ''}`}>
                            <span>{step > item ? <CheckCircle2 size={16} /> : item}</span>
                            <strong>
                                {item === 1 && localize(i18n, 'Event type', 'نوع الفعالية')}
                                {item === 2 && localize(i18n, 'Details', 'التفاصيل')}
                                {item === 3 && localize(i18n, 'Design invite', 'تصميم الدعوة')}
                                {item === 4 && localize(i18n, 'Guest list', 'قائمة الضيوف')}
                            </strong>
                        </div>
                    ))}
                </div>
            </section>

            {error && <div className="form-error">{error}</div>}

            <div className="create-event-layout">
                <section className="create-event-stage">
                    {loading ? (
                        <div className="create-event-empty">{localize(i18n, 'Loading references...', 'جاري تحميل البيانات...')}</div>
                    ) : step === 1 ? (
                        <div className="event-type-grid">
                            {EVENT_TILES.map((tile) => (
                                <button key={tile.id} type="button" className={`event-type-card ${themeType === tile.id ? 'is-active' : ''}`} onClick={() => {
                                    dirtyRef.current = true;
                                    setThemeType(tile.id);
                                }}>
                                    <span className="event-type-card__emoji">{tile.emoji}</span>
                                    <strong>{localize(i18n, tile.en, tile.ar)}</strong>
                                </button>
                            ))}
                        </div>
                    ) : step === 2 ? (
                        <div className="event-details-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="clientId">{localize(i18n, 'Client', 'العميل')}</label>
                                    <select id="clientId" value={formData.clientId} onChange={(event) => setField('clientId', event.target.value)} disabled={Boolean(eventId)}>
                                        <option value="">{localize(i18n, 'Select client', 'اختر العميل')}</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {localize(i18n, client.name, client.name_ar || client.name)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="timezone">{localize(i18n, 'Timezone', 'المنطقة الزمنية')}</label>
                                    <select id="timezone" value={formData.timezone} onChange={(event) => setField('timezone', event.target.value)}>
                                        <option value="Asia/Riyadh">Asia/Riyadh</option>
                                        <option value="Asia/Dubai">Asia/Dubai</option>
                                        <option value="Asia/Calcutta">Asia/Calcutta</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="name">{localize(i18n, 'Event name', 'اسم الفعالية')}</label>
                                    <input id="name" type="text" value={formData.name} onChange={(event) => setField('name', event.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="nameAr">{localize(i18n, 'Arabic name', 'الاسم العربي')}</label>
                                    <input id="nameAr" type="text" dir="rtl" value={formData.nameAr} onChange={(event) => setField('nameAr', event.target.value)} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="startDatetime">{localize(i18n, 'Start', 'البداية')}</label>
                                    <input id="startDatetime" type="datetime-local" value={formData.startDatetime} onChange={(event) => setField('startDatetime', event.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="endDatetime">{localize(i18n, 'End', 'النهاية')}</label>
                                    <input id="endDatetime" type="datetime-local" value={formData.endDatetime} onChange={(event) => setField('endDatetime', event.target.value)} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="venue">{localize(i18n, 'Venue', 'المكان')}</label>
                                    <input id="venue" type="text" value={formData.venue} onChange={(event) => setField('venue', event.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="venueAr">{localize(i18n, 'Venue (Arabic)', 'المكان بالعربية')}</label>
                                    <input id="venueAr" type="text" dir="rtl" value={formData.venueAr} onChange={(event) => setField('venueAr', event.target.value)} />
                                </div>
                            </div>

                            <div className="form-row">
                                <button type="button" className={`mode-toggle ${formData.locationMode === 'maps' ? 'is-active' : ''}`} onClick={() => setField('locationMode', 'maps')}>
                                    <MapPin size={16} />
                                    <span>{localize(i18n, 'Google Maps link', 'رابط خرائط جوجل')}</span>
                                </button>
                                <button type="button" className={`mode-toggle ${formData.locationMode === 'manual' ? 'is-active' : ''}`} onClick={() => setField('locationMode', 'manual')}>
                                    <CalendarDays size={16} />
                                    <span>{localize(i18n, 'Manual address', 'عنوان يدوي')}</span>
                                </button>
                            </div>

                            {formData.locationMode === 'maps' ? (
                                <div className="form-group">
                                    <label htmlFor="googleMapUrl">{localize(i18n, 'Maps URL', 'رابط الخريطة')}</label>
                                    <input id="googleMapUrl" type="url" value={formData.googleMapUrl} onChange={(event) => setField('googleMapUrl', event.target.value)} />
                                </div>
                            ) : (
                                <div className="address-grid">
                                    <div className="form-group">
                                        <label>{localize(i18n, 'Region', 'المنطقة')}</label>
                                        <input type="text" value={formData.addressRegion} onChange={(event) => setField('addressRegion', event.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label>{localize(i18n, 'City', 'المدينة')}</label>
                                        <input type="text" value={formData.addressCity} onChange={(event) => setField('addressCity', event.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label>{localize(i18n, 'District', 'الحي')}</label>
                                        <input type="text" value={formData.addressDistrict} onChange={(event) => setField('addressDistrict', event.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label>{localize(i18n, 'Street', 'الشارع')}</label>
                                        <input type="text" value={formData.addressStreet} onChange={(event) => setField('addressStreet', event.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="logo-upload-card">
                                <div className="logo-upload-card__preview">
                                    {logoPreview ? <img src={logoPreview} alt="Event logo preview" /> : <ImagePlus size={24} />}
                                </div>
                                <div className="logo-upload-card__copy">
                                    <strong>{localize(i18n, 'Cover image or logo', 'صورة الغلاف أو الشعار')}</strong>
                                    <small>{localize(i18n, 'Add a visual for the event card and invitation preview.', 'أضف صورة مرئية لبطاقة الفعالية ومعاينة الدعوة.')}</small>
                                </div>
                                <label className="btn btn-secondary">
                                    <Upload size={16} />
                                    <span>{localize(i18n, 'Upload', 'رفع')}</span>
                                    <input type="file" accept="image/*" hidden onChange={handleLogoChange} />
                                </label>
                            </div>
                        </div>
                    ) : step === 3 ? (
                        <div className="template-selection-grid">
                            {templates.map((template) => (
                                <button key={template.id} type="button" className={`template-choice-card ${selectedTemplateId === template.id ? 'is-active' : ''}`} onClick={() => {
                                    dirtyRef.current = true;
                                    setSelectedTemplateId(template.id);
                                }}>
                                    <span>{localize(i18n, template.category || 'custom', template.category || 'مخصص')}</span>
                                    <strong>{localize(i18n, template.name || 'Untitled', template.name_ar || template.name || 'قالب')}</strong>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="guest-pick-stage">
                            <div className="guest-pick-stage__header">
                                <div>
                                    <h2>{localize(i18n, 'Guest list', 'قائمة الضيوف')}</h2>
                                    <p>{selectedClient ? localize(i18n, `Choose from ${selectedClient.name}'s reusable guests.`, `اختر من ضيوف ${selectedClient.name_ar || selectedClient.name} القابلين لإعادة الاستخدام.`) : localize(i18n, 'Select a client first to load guest choices.', 'اختر العميل أولاً لتحميل الضيوف.')}</p>
                                </div>
                                <span className="guest-pick-stage__count">{selectedGuestIds.length}</span>
                            </div>

                            {guestOptions.length === 0 ? (
                                <div className="create-event-empty">{localize(i18n, 'No reusable guests available for this client yet.', 'لا توجد قائمة ضيوف جاهزة لهذا العميل بعد.')}</div>
                            ) : (
                                <div className="guest-pick-list">
                                    {guestOptions.map((guest) => (
                                        <label key={guest.id} className={`guest-pick-row ${selectedGuestIds.includes(guest.id) ? 'is-active' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedGuestIds.includes(guest.id)}
                                                onChange={() => {
                                                    dirtyRef.current = true;
                                                    setSelectedGuestIds((current) => (
                                                        current.includes(guest.id)
                                                            ? current.filter((id) => id !== guest.id)
                                                            : [...current, guest.id]
                                                    ));
                                                }}
                                            />
                                            <span>
                                                <strong>{guest.name}</strong>
                                                <small>{guest.email || guest.mobile_number || guest.organization || ''}</small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <aside className="create-event-preview">
                    <h2>{localize(i18n, 'Live preview', 'معاينة مباشرة')}</h2>
                    <div className="create-event-preview__card">
                        {logoPreview || selectedTemplate ? (
                            <div className="create-event-preview__art">
                                {logoPreview ? <img src={logoPreview} alt={previewTitle} /> : <span>{selectedTemplate ? localize(i18n, 'Template selected', 'تم اختيار القالب') : localize(i18n, 'Preview', 'معاينة')}</span>}
                            </div>
                        ) : (
                            <div className="create-event-preview__art">
                                <span>{selectedTheme.emoji}</span>
                            </div>
                        )}
                        <strong>{previewTitle}</strong>
                        <small>{previewDate}</small>
                        <p>{formData.venue || localize(i18n, 'Venue to be confirmed', 'سيتم تأكيد المكان')}</p>
                        {selectedTemplate && (
                            <div className="create-event-preview__tag">
                                {localize(i18n, selectedTemplate.name || 'Template', selectedTemplate.name_ar || selectedTemplate.name || 'قالب')}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            <div className="create-event-footer">
                <button type="button" className="btn btn-secondary" onClick={handleBack}>
                    {step === 1 ? localize(i18n, 'Exit', 'خروج') : localize(i18n, 'Back', 'رجوع')}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleContinue} disabled={saving || (step === 2 && !canContinueFromDetails)}>
                    {saving
                        ? localize(i18n, 'Saving...', 'جاري الحفظ...')
                        : step === 4
                            ? localize(i18n, 'Finish Event Setup', 'إنهاء إعداد الفعالية')
                            : localize(i18n, 'Continue', 'متابعة')}
                </button>
            </div>
        </div>
    );
}
