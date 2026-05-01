import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import api from '../../services/api';
import './InvitationProjectsPage.css';

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed'];

export default function InvitationProjectFormPage({ mode = 'create', initialData = null }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isEdit = mode === 'edit';

    const [clients, setClients] = useState([]);
    const [events, setEvents] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loadingRefs, setLoadingRefs] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        clientId: '',
        eventId: '',
        name: '',
        nameAr: '',
        description: '',
        descriptionAr: '',
        defaultLanguage: 'ar',
        coverTemplateId: '',
        status: 'draft',
        settingsText: '{\n  "theme": "classic",\n  "layout": "mobile-first"\n}'
    });

    useEffect(() => {
        fetchReferences();
    }, []);

    useEffect(() => {
        if (isEdit && initialData) {
            setFormData({
                clientId: initialData.client_id || '',
                eventId: initialData.event_id || '',
                name: initialData.name || '',
                nameAr: initialData.name_ar || '',
                description: initialData.description || '',
                descriptionAr: initialData.description_ar || '',
                defaultLanguage: initialData.default_language || 'ar',
                coverTemplateId: initialData.cover_template_id || '',
                status: initialData.status || 'draft',
                settingsText: JSON.stringify(initialData.settings || {}, null, 2)
            });
        }
    }, [isEdit, initialData]);

    useEffect(() => {
        const eventId = searchParams.get('eventId');
        if (!isEdit && eventId && events.length) {
            const selectedEvent = events.find(event => event.id === eventId);
            if (selectedEvent) {
                setFormData(prev => ({
                    ...prev,
                    eventId,
                    clientId: selectedEvent.client_id || prev.clientId,
                    coverTemplateId: selectedEvent.template_id || ''
                }));
            }
        }
    }, [searchParams, events, isEdit]);

    const visibleEvents = useMemo(() => {
        if (!formData.clientId) {
            return events;
        }
        return events.filter(event => event.client_id === formData.clientId);
    }, [events, formData.clientId]);

    function localized(primary, secondary) {
        return i18n.language === 'ar' ? (secondary || primary) : (primary || secondary);
    }

    async function fetchReferences() {
        setLoadingRefs(true);
        try {
            const [clientsResponse, eventsResponse, templatesResponse] = await Promise.all([
                api.get('/admin/clients?pageSize=200'),
                api.get('/admin/events?pageSize=200'),
                api.get('/admin/templates?pageSize=200')
            ]);

            setClients(clientsResponse.data.data);
            setEvents(eventsResponse.data.data);
            setTemplates(templatesResponse.data.data);
        } catch (err) {
            console.error('Failed to load form references:', err);
        } finally {
            setLoadingRefs(false);
        }
    }

    function handleChange(event) {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    function buildPayload() {
        let settings = {};

        if (formData.settingsText.trim()) {
            try {
                settings = JSON.parse(formData.settingsText);
            } catch {
                throw new Error(t('invitationProjects.invalidSettingsJson'));
            }
        }

        return {
            clientId: formData.clientId,
            eventId: formData.eventId,
            name: formData.name,
            nameAr: formData.nameAr,
            description: formData.description,
            descriptionAr: formData.descriptionAr,
            defaultLanguage: formData.defaultLanguage,
            coverTemplateId: formData.coverTemplateId || null,
            status: formData.status,
            settings
        };
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = buildPayload();
            const response = isEdit
                ? await api.put(`/admin/invitation-projects/${initialData.id}`, payload)
                : await api.post('/admin/invitation-projects', payload);

            navigate(`/invitation-projects/${response.data.data.project.id || initialData.id}`, { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || err.message || t('invitationProjects.saveFailed'));
        } finally {
            setIsSubmitting(false);
        }
    }

    if (loadingRefs && !isEdit) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    return (
        <div className="invitation-project-form-page">
            <div className="page-header">
                <div>
                    <h1>{isEdit ? t('invitationProjects.editProject') : t('invitationProjects.newProject')}</h1>
                    <p>{t('invitationProjects.formSubtitle')}</p>
                </div>
            </div>

            <form className="project-form-card" onSubmit={handleSubmit}>
                {error && <div className="form-error">{error}</div>}

                <div className="form-section">
                    <h3>{t('invitationProjects.scope')}</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="clientId">{t('invitationProjects.client')}</label>
                            <select
                                id="clientId"
                                name="clientId"
                                value={formData.clientId}
                                onChange={handleChange}
                                required
                                disabled={isEdit}
                            >
                                <option value="">{t('invitationProjects.selectClient')}</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {localized(client.name, client.name_ar)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="eventId">{t('invitationProjects.event')}</label>
                            <select
                                id="eventId"
                                name="eventId"
                                value={formData.eventId}
                                onChange={handleChange}
                                required
                                disabled={isEdit}
                            >
                                <option value="">{t('invitationProjects.selectEvent')}</option>
                                {visibleEvents.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {localized(event.name, event.name_ar)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('invitationProjects.projectDetails')}</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="name">{t('invitationProjects.projectName')}</label>
                            <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label htmlFor="nameAr">{t('invitationProjects.projectNameAr')}</label>
                            <input id="nameAr" name="nameAr" type="text" value={formData.nameAr} onChange={handleChange} dir="rtl" />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="description">{t('invitationProjects.description')}</label>
                            <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows="4" />
                        </div>

                        <div className="form-group">
                            <label htmlFor="descriptionAr">{t('invitationProjects.descriptionAr')}</label>
                            <textarea id="descriptionAr" name="descriptionAr" value={formData.descriptionAr} onChange={handleChange} rows="4" dir="rtl" />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('invitationProjects.rendering')}</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="defaultLanguage">{t('invitationProjects.defaultLanguage')}</label>
                            <select id="defaultLanguage" name="defaultLanguage" value={formData.defaultLanguage} onChange={handleChange}>
                                <option value="ar">العربية</option>
                                <option value="en">English</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="coverTemplateId">{t('invitationProjects.coverTemplate')}</label>
                            <select id="coverTemplateId" name="coverTemplateId" value={formData.coverTemplateId} onChange={handleChange}>
                                <option value="">{t('invitationProjects.noTemplate')}</option>
                                {templates.map(template => (
                                    <option key={template.id} value={template.id}>
                                        {template.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="status">{t('invitationProjects.statusLabel')}</label>
                            <select id="status" name="status" value={formData.status} onChange={handleChange}>
                                {STATUS_OPTIONS.map(option => (
                                    <option key={option} value={option}>{t(`invitationProjects.status.${option}`)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="settingsText">{t('invitationProjects.settings')}</label>
                            <textarea
                                id="settingsText"
                                name="settingsText"
                                value={formData.settingsText}
                                onChange={handleChange}
                                rows="6"
                                className="code-textarea"
                                spellCheck="false"
                            />
                        </div>
                    </div>
                </div>

                <div className="summary-note">
                    <Check size={16} />
                    <span>{t('invitationProjects.coverHelp')}</span>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/invitation-projects')}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('common.loading') : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
}
