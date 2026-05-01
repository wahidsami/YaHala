import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe2, MapPin, Upload } from 'lucide-react';
import api from '../../services/api';
import './EventFormPage.css';

const EVENT_TYPES = ['wedding', 'corporate', 'social'];
const ADD_INS = [
    { id: 'poll', titleKey: 'events.form.addin.poll.title', descriptionKey: 'events.form.addin.poll.description' },
    { id: 'questionnaire', titleKey: 'events.form.addin.questionnaire.title', descriptionKey: 'events.form.addin.questionnaire.description' },
    { id: 'quiz', titleKey: 'events.form.addin.quiz.title', descriptionKey: 'events.form.addin.quiz.description' },
    { id: 'instructions', titleKey: 'events.form.addin.instructions.title', descriptionKey: 'events.form.addin.instructions.description' },
    { id: 'guest_book', titleKey: 'events.form.addin.guest_book.title', descriptionKey: 'events.form.addin.guest_book.description' },
    { id: 'files_downloads', titleKey: 'events.form.addin.files_downloads.title', descriptionKey: 'events.form.addin.files_downloads.description' }
];
const LOCATION_MODES = [
    {
        id: 'maps',
        titleKey: 'events.form.locationMode.mapsTitle',
        descriptionKey: 'events.form.locationMode.mapsDescription'
    },
    {
        id: 'manual',
        titleKey: 'events.form.locationMode.manualTitle',
        descriptionKey: 'events.form.locationMode.manualDescription'
    }
];

function hasManualAddress(data) {
    return Boolean(
        data.addressRegion ||
            data.addressCity ||
            data.addressDistrict ||
            data.addressStreet ||
            data.addressBuildingNumber ||
            data.addressAdditionalNumber ||
            data.addressPostalCode ||
            data.addressUnitNumber
    );
}

function formatSaudiAddress(data) {
    const parts = [
        data.addressStreet,
        data.addressDistrict,
        data.addressCity,
        data.addressRegion,
        data.addressBuildingNumber && `Bldg ${data.addressBuildingNumber}`,
        data.addressAdditionalNumber && `Addl ${data.addressAdditionalNumber}`,
        data.addressUnitNumber && `Unit ${data.addressUnitNumber}`,
        data.addressPostalCode && `P.O. ${data.addressPostalCode}`
    ].filter(Boolean);

    return parts.join(', ');
}

function getStorageBaseUrl() {
    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return baseUrl.replace(/\/api\/?$/, '');
}

function resolveStorageUrl(storagePath) {
    if (!storagePath) {
        return '';
    }

    if (/^https?:\/\//i.test(storagePath)) {
        return storagePath;
    }

    return `${getStorageBaseUrl()}${storagePath}`;
}

export default function EventFormPage({ mode = 'create', initialData = {} }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [eventLogoPreview, setEventLogoPreview] = useState(resolveStorageUrl(initialData.event_logo_path));

    const initialLocationMode =
        initialData.location_mode ||
        (initialData.google_map_url ? 'maps' : hasManualAddress(initialData) ? 'manual' : 'maps');

    const [formData, setFormData] = useState({
        clientId: initialData.client_id || searchParams.get('clientId') || '',
        name: initialData.name || '',
        nameAr: initialData.name_ar || '',
        eventType: initialData.event_type || 'wedding',
        startDatetime: initialData.start_datetime ? initialData.start_datetime.slice(0, 16) : '',
        endDatetime: initialData.end_datetime ? initialData.end_datetime.slice(0, 16) : '',
        timezone: initialData.timezone || 'Asia/Riyadh',
        venue: initialData.venue || '',
        venueAr: initialData.venue_ar || '',
        locationMode: initialLocationMode,
        googleMapUrl: initialData.google_map_url || '',
        addressRegion: initialData.address_region || '',
        addressCity: initialData.address_city || '',
        addressDistrict: initialData.address_district || '',
        addressStreet: initialData.address_street || '',
        addressBuildingNumber: initialData.address_building_number || '',
        addressAdditionalNumber: initialData.address_additional_number || '',
        addressPostalCode: initialData.address_postal_code || '',
        addressUnitNumber: initialData.address_unit_number || '',
        addIns: Array.isArray(initialData.add_ins)
            ? initialData.add_ins
            : Array.isArray(initialData.settings?.addIns)
                ? initialData.settings.addIns
                : [],
        templateId: initialData.template_id || '',
        status: initialData.status || 'draft'
    });

    useEffect(() => {
        fetchClients();
    }, []);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=100&status=active');
            setClients(response.data.data);
        } catch (fetchError) {
            console.error('Failed to fetch clients:', fetchError);
        }
    }

    function handleChange(event) {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    }

    function handleLocationModeChange(locationMode) {
        setFormData((prev) => ({ ...prev, locationMode }));
    }

    function handleAddInToggle(addInId) {
        setFormData((prev) => ({
            ...prev,
            addIns: prev.addIns.includes(addInId)
                ? prev.addIns.filter((id) => id !== addInId)
                : [...prev.addIns, addInId]
        }));
    }

    function handleEventLogoChange(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            setEventLogoPreview(result);
            setFormData((prev) => ({ ...prev, eventLogoDataUrl: result }));
        };
        reader.readAsDataURL(file);
    }

    const canSubmit = useMemo(() => {
        const hasRequiredBasics =
            formData.clientId && formData.name && formData.eventType && formData.startDatetime && formData.endDatetime;
        const hasManualFields =
            formData.locationMode !== 'manual' || (formData.addressCity && formData.addressStreet);
        return hasRequiredBasics && hasManualFields;
    }, [formData]);

    async function handleSubmit() {
        setIsSubmitting(true);
        setError(null);

        try {
            if (mode === 'edit') {
                await api.put(`/admin/events/${initialData.id}`, formData);
            } else {
                await api.post('/admin/events', formData);
            }
            navigate('/events');
        } catch (submitError) {
            setError(submitError.response?.data?.message || t('events.form.failedToSave'));
        } finally {
            setIsSubmitting(false);
        }
    }

    const selectedClient = clients.find((client) => client.id === formData.clientId);

    return (
        <div className="event-form-page">
            <div className="page-header">
                <div>
                    <button type="button" className="back-link" onClick={() => navigate('/events')}>
                        ← {t('events.form.backToEvents')}
                    </button>
                    <h1>{mode === 'edit' ? t('events.form.editTitle') : t('events.form.createTitle')}</h1>
                    <p>{t('events.form.subtitle')}</p>
                </div>
            </div>

            <div className="form-steps-stack">
                {error && <div className="form-error">{error}</div>}

                <section className="section-card">
                    <div className="section-heading">
                        <span>{t('events.form.step1')}</span>
                        <h2>{t('events.form.basicInfo')}</h2>
                    </div>

                    <div className="form-group">
                        <label htmlFor="clientId">{t('events.form.client')}</label>
                        <select id="clientId" name="clientId" value={formData.clientId} onChange={handleChange} required>
                            <option value="">{t('events.form.selectClient')}</option>
                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="name">{t('events.form.eventNameEn')}</label>
                            <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label htmlFor="nameAr">{t('events.form.eventNameAr')}</label>
                            <input
                                id="nameAr"
                                name="nameAr"
                                type="text"
                                value={formData.nameAr}
                                onChange={handleChange}
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>{t('events.form.eventType')}</label>
                        <div className="radio-group">
                            {EVENT_TYPES.map((type) => (
                                <label key={type} className="radio-option">
                                    <input
                                        type="radio"
                                        name="eventType"
                                        value={type}
                                        checked={formData.eventType === type}
                                        onChange={handleChange}
                                    />
                                    <span>{t(`events.form.eventType.${type}`)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="section-card">
                    <div className="section-heading">
                        <span>{t('events.form.step1_5')}</span>
                        <h2>{t('events.form.eventLogo')}</h2>
                    </div>

                    <div className="logo-upload-row">
                        <div className="logo-preview-box">
                            {eventLogoPreview ? (
                                <img src={eventLogoPreview} alt="Event logo preview" />
                            ) : (
                                <div className="logo-preview-placeholder">
                                    <Upload size={18} />
                                    <span>{t('events.form.noEventLogo')}</span>
                                </div>
                            )}
                        </div>

                        <div className="logo-upload-copy">
                            <p>
                                {t('events.form.uploadLogoHelp')}
                            </p>
                            <label className="logo-upload-btn" htmlFor="eventLogo">
                                <Upload size={16} />
                                <span>{eventLogoPreview ? t('events.form.replaceLogo') : t('events.form.uploadLogo')}</span>
                            </label>
                            <input
                                id="eventLogo"
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={handleEventLogoChange}
                            />
                        </div>
                    </div>
                </section>

                <section className="section-card">
                    <div className="section-heading">
                        <span>{t('events.form.step2')}</span>
                        <h2>{t('events.form.dateLocation')}</h2>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="startDatetime">{t('events.form.startDateTime')}</label>
                            <input
                                id="startDatetime"
                                name="startDatetime"
                                type="datetime-local"
                                value={formData.startDatetime}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="endDatetime">{t('events.form.endDateTime')}</label>
                            <input
                                id="endDatetime"
                                name="endDatetime"
                                type="datetime-local"
                                value={formData.endDatetime}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="timezone">{t('events.form.timezone')}</label>
                        <select id="timezone" name="timezone" value={formData.timezone} onChange={handleChange}>
                            <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                            <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                        </select>
                    </div>

                    <div className="location-mode-switch">
                        {LOCATION_MODES.map((modeOption) => (
                            <button
                                key={modeOption.id}
                                type="button"
                                className={formData.locationMode === modeOption.id ? 'active' : ''}
                                onClick={() => handleLocationModeChange(modeOption.id)}
                            >
                                {modeOption.id === 'maps' ? <Globe2 size={16} /> : <MapPin size={16} />}
                                <div>
                                    <strong>{t(modeOption.titleKey)}</strong>
                                    <span>{t(modeOption.descriptionKey)}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="venue">{t('events.form.locationLabelEn')}</label>
                            <input
                                id="venue"
                                name="venue"
                                type="text"
                                value={formData.venue}
                                onChange={handleChange}
                                placeholder="Grand Hall"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="venueAr">{t('events.form.locationLabelAr')}</label>
                            <input
                                id="venueAr"
                                name="venueAr"
                                type="text"
                                value={formData.venueAr}
                                onChange={handleChange}
                                dir="rtl"
                                placeholder="قاعة الجراند"
                            />
                        </div>
                    </div>

                    {formData.locationMode === 'maps' ? (
                        <div className="form-group">
                            <label htmlFor="googleMapUrl">{t('events.form.mapsUrl')}</label>
                            <input
                                id="googleMapUrl"
                                name="googleMapUrl"
                                type="url"
                                value={formData.googleMapUrl}
                                onChange={handleChange}
                                placeholder="https://maps.google.com/..."
                            />
                            <small className="info-text">{t('events.form.mapsUrlHelp')}</small>
                        </div>
                    ) : (
                        <>
                            <div className="section-subtitle">
                                {t('events.form.manualAddressHelp')}
                            </div>
                            <div className="address-grid">
                                <div className="form-group">
                                    <label htmlFor="addressRegion">{t('events.form.region')}</label>
                                    <input id="addressRegion" name="addressRegion" type="text" value={formData.addressRegion} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressCity">{t('events.form.city')}</label>
                                    <input id="addressCity" name="addressCity" type="text" value={formData.addressCity} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressDistrict">{t('events.form.district')}</label>
                                    <input
                                        id="addressDistrict"
                                        name="addressDistrict"
                                        type="text"
                                        value={formData.addressDistrict}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressStreet">{t('events.form.street')}</label>
                                    <input id="addressStreet" name="addressStreet" type="text" value={formData.addressStreet} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressBuildingNumber">{t('events.form.buildingNumber')}</label>
                                    <input
                                        id="addressBuildingNumber"
                                        name="addressBuildingNumber"
                                        type="text"
                                        value={formData.addressBuildingNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressAdditionalNumber">{t('events.form.additionalNumber')}</label>
                                    <input
                                        id="addressAdditionalNumber"
                                        name="addressAdditionalNumber"
                                        type="text"
                                        value={formData.addressAdditionalNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressPostalCode">{t('events.form.postalCode')}</label>
                                    <input
                                        id="addressPostalCode"
                                        name="addressPostalCode"
                                        type="text"
                                        value={formData.addressPostalCode}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addressUnitNumber">{t('events.form.unitNumber')}</label>
                                    <input
                                        id="addressUnitNumber"
                                        name="addressUnitNumber"
                                        type="text"
                                        value={formData.addressUnitNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </section>

                <section className="section-card">
                    <div className="section-heading">
                        <span>{t('events.form.step3')}</span>
                        <h2>{t('events.form.invitationAddIns')}</h2>
                    </div>

                    <p className="section-subtitle">
                        {t('events.form.addInsHelp')}
                    </p>

                    <div className="addin-grid">
                        {ADD_INS.map((addin) => {
                            const selected = formData.addIns.includes(addin.id);

                            return (
                                <label key={addin.id} className={`addin-card ${selected ? 'selected' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => handleAddInToggle(addin.id)}
                                    />
                                    <div>
                                        <strong>{t(addin.titleKey)}</strong>
                                        <span>{t(addin.descriptionKey)}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </section>

                <section className="section-card">
                    <div className="section-heading">
                        <span>{t('events.form.step4')}</span>
                        <h2>{t('events.form.settingsReview')}</h2>
                    </div>

                    <div className="form-group">
                        <label htmlFor="status">{t('events.form.status')}</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange}>
                            <option value="draft">{t('events.status.draft')}</option>
                            <option value="active">{t('events.status.active')}</option>
                        </select>
                    </div>

                    <div className="summary-card">
                        <h3>{t('events.form.summary')}</h3>
                        <div className="summary-row">
                            <span>{t('events.form.client')}</span>
                            <strong>{selectedClient?.name || t('common.notFound')}</strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.eventNameEn')}</span>
                            <strong>{formData.name || t('events.form.notSet')}</strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.eventType')}</span>
                            <strong>{t(`events.form.eventType.${formData.eventType}`)}</strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.startDateTime')}</span>
                            <strong>{formData.startDatetime || t('events.form.notSet')}</strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.locationMode')}</span>
                            <strong>
                                {formData.locationMode === 'maps'
                                    ? t('events.form.googleMaps')
                                    : t('events.form.manualAddress')}
                            </strong>
                        </div>
                        <div className="summary-row summary-row-wrap">
                            <span>{t('events.form.addIns')}</span>
                            <strong>
                                {formData.addIns.length
                                    ? formData.addIns.map((id) => t(ADD_INS.find((item) => item.id === id)?.titleKey || id)).join(', ')
                                    : t('events.form.noneSelected')}
                            </strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.venue')}</span>
                            <strong>{formData.venue || t('events.form.notSet')}</strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.mapsUrl')}</span>
                            <strong>{formData.googleMapUrl || t('events.form.notSet')}</strong>
                        </div>
                        <div className="summary-row">
                            <span>{t('events.form.eventLogoStatus')}</span>
                            <strong>{eventLogoPreview ? t('events.form.uploaded') : t('events.form.notSet')}</strong>
                        </div>
                        {formData.locationMode === 'manual' && (
                            <div className="summary-row summary-row-wrap">
                                <span>{t('clients.form.address')}</span>
                                <strong>{formatSaudiAddress(formData) || t('events.form.notSet')}</strong>
                            </div>
                        )}
                    </div>
                </section>

                <div className="wizard-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/events')}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                        {isSubmitting ? t('events.form.saving') : mode === 'edit' ? t('events.form.saveChanges') : t('events.form.createEvent')}
                    </button>
                </div>
            </div>
        </div>
    );
}
