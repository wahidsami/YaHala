import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BarChart3, CalendarDays, ChevronDown, ChevronUp, Download, Eye, Globe2, Image as ImageIcon, Palette, Plus, Save, Send, Settings2, Sparkles, Trash2, Upload } from 'lucide-react';
import api from '../../services/api';
import './PollBuilderPage.css';

function getStorageBaseUrl() {
    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return baseUrl.replace(/\/api\/?$/, '');
}

function resolveStorageUrl(storagePath) {
    if (!storagePath) {
        return '';
    }

    if (/^https?:\/\//i.test(storagePath) || storagePath.startsWith('data:')) {
        return storagePath;
    }

    return `${getStorageBaseUrl()}${storagePath.startsWith('/') ? '' : '/'}${storagePath}`;
}

function createTempId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createOption(index) {
    return {
        id: createTempId(),
        text: `Option ${index + 1}`,
        textAr: `الخيار ${index + 1}`,
        icon: '',
        iconPath: '',
        iconDataUrl: '',
        colorOverride: '',
        imagePath: '',
        imageDataUrl: '',
        sortOrder: index
    };
}

function localizedText(i18n, primary, secondary) {
    return i18n.language?.startsWith('ar') ? (secondary || primary || '') : (primary || secondary || '');
}

function previewText(primary, secondary, isArabic) {
    return isArabic ? (secondary || primary || '') : (primary || secondary || '');
}

function formatReportDate(value, language) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    try {
        return new Intl.DateTimeFormat(language?.startsWith('ar') ? 'ar-SA' : 'en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    } catch {
        return date.toLocaleString();
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Unable to read file'));
        reader.readAsDataURL(file);
    });
}

function getOptionMediaSource(option, field) {
    return option?.[`${field}DataUrl`] || resolveStorageUrl(option?.[`${field}Path`]);
}

export default function PollBuilderPage({ mode = 'create', initialData = {} }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isArabic = i18n.language?.startsWith('ar');
    const [clients, setClients] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [coverPreview, setCoverPreview] = useState(resolveStorageUrl(initialData.cover_image_path));
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState('');

    const initialThemeSettings = {
        primary_color: '#946FA7',
        secondary_color: '#FF9D00',
        font_family: 'Cairo',
        button_style: 'rounded',
        background_style: 'soft',
        layout_style: 'cards',
        ...(initialData.theme_settings || {})
    };

    const initialLayoutSettings = {
        layout_style: 'cards',
        ...(initialData.layout_settings || {})
    };

    const [formData, setFormData] = useState(() => ({
        clientId: initialData.client_id || searchParams.get('clientId') || '',
        eventId: initialData.event_id || searchParams.get('eventId') || '',
        title: initialData.title || '',
        titleAr: initialData.title_ar || '',
        subtitle: initialData.subtitle || '',
        subtitleAr: initialData.subtitle_ar || '',
        description: initialData.description || '',
        descriptionAr: initialData.description_ar || '',
        status: initialData.status || 'draft',
        pollMode: initialData.poll_mode || 'named',
        allowMultipleChoice: Boolean(initialData.allow_multiple_choice),
        requireLogin: typeof initialData.require_login === 'boolean' ? initialData.require_login : true,
        startDate: initialData.start_date ? initialData.start_date.slice(0, 16) : '',
        endDate: initialData.end_date ? initialData.end_date.slice(0, 16) : '',
        maxVotesPerUser: initialData.max_votes_per_user || 1,
        showResultsMode: initialData.show_results_mode || 'after_vote',
        coverImagePath: initialData.cover_image_path || '',
        coverImageDataUrl: '',
        themeSettings: initialThemeSettings,
        layoutSettings: initialLayoutSettings,
        options: Array.isArray(initialData.options) && initialData.options.length > 0
            ? initialData.options.map((option, index) => ({
                id: option.id || createTempId(),
                text: option.text || `Option ${index + 1}`,
                textAr: option.text_ar || `الخيار ${index + 1}`,
                icon: option.icon || '',
                iconPath: option.icon_path || '',
                iconDataUrl: '',
                colorOverride: option.color_override || '',
                imagePath: option.image_path || '',
                imageDataUrl: '',
                sortOrder: option.sort_order ?? index
            }))
            : [createOption(0), createOption(1)]
    }));

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (mode === 'edit' && initialData?.id) {
            fetchReport(initialData.id);
        } else {
            setReportData(null);
            setReportError('');
        }
    }, [mode, initialData?.id]);

    useEffect(() => {
        if (formData.clientId) {
            fetchEvents(formData.clientId);
        } else {
            setEvents([]);
        }
    }, [formData.clientId]);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data.data || []);
        } catch (fetchError) {
            console.error('Failed to fetch clients:', fetchError);
        } finally {
            setLoading(false);
        }
    }

    async function fetchEvents(clientId) {
        try {
            const response = await api.get(`/admin/events?pageSize=200&clientId=${clientId}`);
            setEvents(response.data.data || []);
        } catch (fetchError) {
            console.error('Failed to fetch events:', fetchError);
        }
    }

    async function fetchReport(pollId = initialData?.id) {
        if (!pollId) {
            return;
        }

        setReportLoading(true);
        setReportError('');

        try {
            const response = await api.get(`/admin/polls/${pollId}/report`);
            setReportData(response.data.data || null);
        } catch (fetchError) {
            console.error('Failed to fetch poll report:', fetchError);
            setReportError(fetchError.response?.data?.message || t('addons.pollBuilder.reportLoadFailed'));
        } finally {
            setReportLoading(false);
        }
    }

    async function handleExportReport() {
        if (!initialData?.id) {
            return;
        }

        try {
            const response = await api.get(`/admin/polls/${initialData.id}/export`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `poll-report-${initialData.id}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (downloadError) {
            console.error('Failed to export poll report:', downloadError);
            setReportError(downloadError.response?.data?.message || t('addons.pollBuilder.reportLoadFailed'));
        }
    }

    function updateField(name, value) {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }

    function updateThemeField(name, value) {
        setFormData((prev) => ({
            ...prev,
            themeSettings: { ...prev.themeSettings, [name]: value }
        }));
    }

    function updateLayoutField(name, value) {
        setFormData((prev) => ({
            ...prev,
            layoutSettings: { ...prev.layoutSettings, [name]: value }
        }));
    }

    function updateOption(optionId, field, value) {
        setFormData((prev) => ({
            ...prev,
            options: prev.options.map((option) => (
                option.id === optionId ? { ...option, [field]: value } : option
            ))
        }));
    }

    async function updateOptionMedia(optionId, field, file) {
        if (!file) {
            return;
        }

        const dataUrl = await readFileAsDataUrl(file);
        setFormData((prev) => ({
            ...prev,
            options: prev.options.map((option) => (
                option.id === optionId
                    ? {
                        ...option,
                        [`${field}DataUrl`]: dataUrl,
                        [`${field}Path`]: ''
                    }
                    : option
            ))
        }));
    }

    function addOption() {
        setFormData((prev) => ({
            ...prev,
            options: [...prev.options, createOption(prev.options.length)]
        }));
    }

    function removeOption(optionId) {
        setFormData((prev) => ({
            ...prev,
            options: prev.options.filter((option) => option.id !== optionId).map((option, index) => ({
                ...option,
                sortOrder: index
            }))
        }));
    }

    function moveOption(optionId, direction) {
        setFormData((prev) => {
            const index = prev.options.findIndex((option) => option.id === optionId);
            const nextIndex = index + direction;

            if (index < 0 || nextIndex < 0 || nextIndex >= prev.options.length) {
                return prev;
            }

            const nextOptions = [...prev.options];
            const [moved] = nextOptions.splice(index, 1);
            nextOptions.splice(nextIndex, 0, moved);

            return {
                ...prev,
                options: nextOptions.map((option, currentIndex) => ({
                    ...option,
                    sortOrder: currentIndex
                }))
            };
        });
    }

    function handleCoverImageChange(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            setCoverPreview(result);
            setFormData((prev) => ({
                ...prev,
                coverImageDataUrl: result,
                coverImagePath: ''
            }));
        };
        reader.readAsDataURL(file);
    }

    async function savePoll(nextStatus) {
        setSaving(true);
        setError('');

        try {
            const payload = {
                clientId: formData.clientId,
                eventId: formData.eventId,
                title: formData.title,
                titleAr: formData.titleAr,
                subtitle: formData.subtitle,
                subtitleAr: formData.subtitleAr,
                description: formData.description,
                descriptionAr: formData.descriptionAr,
                themeSettings: formData.themeSettings,
                layoutSettings: formData.layoutSettings,
                status: nextStatus,
                pollMode: formData.pollMode,
                allowMultipleChoice: formData.allowMultipleChoice,
                requireLogin: formData.requireLogin,
                startDate: formData.startDate || null,
                endDate: formData.endDate || null,
                maxVotesPerUser: Number.parseInt(formData.maxVotesPerUser, 10) || 1,
                showResultsMode: formData.showResultsMode,
                coverImageDataUrl: formData.coverImageDataUrl || undefined,
                coverImagePath: formData.coverImagePath || undefined,
                options: formData.options.map((option) => ({
                    id: option.id,
                    text: option.text,
                    textAr: option.textAr,
                    icon: option.icon,
                    iconPath: option.iconPath,
                    iconDataUrl: option.iconDataUrl,
                    colorOverride: option.colorOverride,
                    imagePath: option.imagePath,
                    imageDataUrl: option.imageDataUrl,
                    sortOrder: option.sortOrder
                }))
            };

            if (mode === 'edit') {
                await api.put(`/admin/polls/${initialData.id}`, payload);
            } else {
                await api.post('/admin/polls', payload);
            }

            navigate('/addons/polls');
        } catch (saveError) {
            setError(saveError.response?.data?.message || t('addons.pollBuilder.failedToSave'));
        } finally {
            setSaving(false);
        }
    }

    const selectedClient = useMemo(
        () => clients.find((client) => client.id === formData.clientId),
        [clients, formData.clientId]
    );

    const selectedEvent = useMemo(
        () => events.find((event) => event.id === formData.eventId),
        [events, formData.eventId]
    );

    const previewStyle = {
        fontFamily: formData.themeSettings.font_family || 'Cairo',
        ['--poll-primary']: formData.themeSettings.primary_color || '#946FA7',
        ['--poll-secondary']: formData.themeSettings.secondary_color || '#FF9D00'
    };

    if (loading) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    return (
        <div className="poll-builder-page">
            <div className="page-header">
                <div>
                    <button type="button" className="back-link" onClick={() => navigate('/addons/polls')}>
                        <ArrowLeft size={18} />
                        <span>{t('addons.pollBuilder.backToAddons')}</span>
                    </button>
                    <h1>{mode === 'edit' ? t('addons.pollBuilder.editTitle') : t('addons.pollBuilder.createTitle')}</h1>
                    <p>{t('addons.pollBuilder.subtitle')}</p>
                </div>
                <div className="header-actions">
                    <span className={`status-pill status-${formData.status}`}>
                        {t(`addons.polls.status.${formData.status}`) || formData.status}
                    </span>
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="poll-builder-layout">
                <div className="builder-column">
                    <section className="builder-card">
                        <div className="builder-card-header">
                            <div>
                                <p className="builder-eyebrow">{t('addons.pollBuilder.ownership')}</p>
                                <h2>{t('addons.pollBuilder.basicInfo')}</h2>
                            </div>
                        </div>
                        <p className="builder-note">{t('addons.pollBuilder.basicInfoHint')}</p>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.client')}</label>
                                <select value={formData.clientId} onChange={(event) => updateField('clientId', event.target.value)}>
                                    <option value="">{t('addons.pollBuilder.selectClient')}</option>
                                    {clients.map((client) => (
                                        <option key={client.id} value={client.id}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>{t('addons.pollBuilder.event')}</label>
                                <select
                                    value={formData.eventId}
                                    onChange={(event) => updateField('eventId', event.target.value)}
                                    disabled={!formData.clientId}
                                >
                                    <option value="">{t('addons.pollBuilder.selectEvent')}</option>
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>
                                            {event.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.titleEn')}</label>
                                <input value={formData.title} onChange={(event) => updateField('title', event.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.titleAr')}</label>
                                <input value={formData.titleAr} onChange={(event) => updateField('titleAr', event.target.value)} dir="rtl" />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.subtitleEn')}</label>
                                <input value={formData.subtitle} onChange={(event) => updateField('subtitle', event.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.subtitleAr')}</label>
                                <input value={formData.subtitleAr} onChange={(event) => updateField('subtitleAr', event.target.value)} dir="rtl" />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.descriptionEn')}</label>
                                <textarea
                                    rows="4"
                                    value={formData.description}
                                    onChange={(event) => updateField('description', event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.descriptionAr')}</label>
                                <textarea
                                    rows="4"
                                    value={formData.descriptionAr}
                                    onChange={(event) => updateField('descriptionAr', event.target.value)}
                                    dir="rtl"
                                />
                            </div>
                        </div>

                        <div className="cover-upload-card">
                            <div className="cover-upload-copy">
                                <div className="cover-upload-icon"><ImageIcon size={18} /></div>
                                <div>
                                    <h3>{t('addons.pollBuilder.coverImage')}</h3>
                                    <p>{t('addons.pollBuilder.coverImageHint')}</p>
                                </div>
                            </div>
                            <label className="upload-button">
                                <Upload size={16} />
                                <span>{t('common.add')}</span>
                                <input type="file" accept="image/*" onChange={handleCoverImageChange} hidden />
                            </label>
                        </div>

                        {coverPreview && (
                            <div className="cover-preview">
                                <img src={coverPreview} alt={t('addons.pollBuilder.coverPreview')} />
                            </div>
                        )}
                    </section>

                    <section className="builder-card">
                        <div className="builder-card-header">
                            <div>
                                <p className="builder-eyebrow">{t('addons.pollBuilder.options')}</p>
                                <h2>{t('addons.pollBuilder.options')}</h2>
                            </div>
                            <button type="button" className="btn btn-secondary" onClick={addOption}>
                                <Plus size={16} />
                                <span>{t('addons.pollBuilder.addOption')}</span>
                            </button>
                        </div>

                        <div className="option-list">
                            {formData.options.map((option, index) => (
                                <div className="option-card" key={option.id}>
                                    <div className="option-card-head">
                                        <strong>{t('addons.pollBuilder.optionLabel', { index: index + 1 })}</strong>
                                        <div className="option-actions">
                                            <button type="button" onClick={() => moveOption(option.id, -1)} title={t('addons.pollBuilder.moveUp')}>
                                                <ChevronUp size={14} />
                                            </button>
                                            <button type="button" onClick={() => moveOption(option.id, 1)} title={t('addons.pollBuilder.moveDown')}>
                                                <ChevronDown size={14} />
                                            </button>
                                            <button type="button" onClick={() => removeOption(option.id)} title={t('addons.pollBuilder.removeOption')}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>{t('addons.pollBuilder.optionTextEn')}</label>
                                            <input value={option.text} onChange={(event) => updateOption(option.id, 'text', event.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('addons.pollBuilder.optionTextAr')}</label>
                                            <input value={option.textAr} onChange={(event) => updateOption(option.id, 'textAr', event.target.value)} dir="rtl" />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>{t('addons.pollBuilder.optionIconName')}</label>
                                            <input value={option.icon} onChange={(event) => updateOption(option.id, 'icon', event.target.value)} placeholder="Sparkles" />
                                        </div>
                                        <div className="form-group">
                                            <label>{t('addons.pollBuilder.optionColor')}</label>
                                            <input value={option.colorOverride} onChange={(event) => updateOption(option.id, 'colorOverride', event.target.value)} placeholder="#946FA7" />
                                        </div>
                                    </div>

                                    <div className="option-media-grid">
                                        <div className="option-media-block">
                                            <div className="option-media-header">
                                                <label>{t('addons.pollBuilder.uploadIcon')}</label>
                                                <span className="option-media-chip">{t('addons.pollBuilder.iconPreview')}</span>
                                            </div>
                                            <div className="option-media-actions">
                                                <label className="upload-button upload-button-compact" htmlFor={`poll-option-icon-${option.id}`}>
                                                    <Upload size={14} />
                                                    <span>{t('addons.pollBuilder.uploadIcon')}</span>
                                                </label>
                                                <input
                                                    id={`poll-option-icon-${option.id}`}
                                                    type="file"
                                                    accept="image/*,.svg"
                                                    hidden
                                                    onChange={async (event) => {
                                                        const file = event.target.files?.[0];
                                                        await updateOptionMedia(option.id, 'icon', file);
                                                        event.target.value = '';
                                                    }}
                                                />
                                            </div>
                                            <div className="option-media-preview option-media-preview-icon">
                                                {getOptionMediaSource(option, 'icon') ? (
                                                    <img src={getOptionMediaSource(option, 'icon')} alt={t('addons.pollBuilder.iconPreview')} />
                                                ) : (
                                                    <div className="option-media-empty">
                                                        <ImageIcon size={18} />
                                                        <span>{t('addons.pollBuilder.noMediaSelected')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="option-media-block">
                                            <div className="option-media-header">
                                                <label>{t('addons.pollBuilder.uploadImage')}</label>
                                                <span className="option-media-chip">{t('addons.pollBuilder.imagePreview')}</span>
                                            </div>
                                            <div className="option-media-actions">
                                                <label className="upload-button upload-button-compact" htmlFor={`poll-option-image-${option.id}`}>
                                                    <Upload size={14} />
                                                    <span>{t('addons.pollBuilder.uploadImage')}</span>
                                                </label>
                                                <input
                                                    id={`poll-option-image-${option.id}`}
                                                    type="file"
                                                    accept="image/*,.svg"
                                                    hidden
                                                    onChange={async (event) => {
                                                        const file = event.target.files?.[0];
                                                        await updateOptionMedia(option.id, 'image', file);
                                                        event.target.value = '';
                                                    }}
                                                />
                                            </div>
                                            <div className="option-media-preview option-media-preview-image">
                                                {getOptionMediaSource(option, 'image') ? (
                                                    <img src={getOptionMediaSource(option, 'image')} alt={t('addons.pollBuilder.imagePreview')} />
                                                ) : (
                                                    <div className="option-media-empty">
                                                        <ImageIcon size={18} />
                                                        <span>{t('addons.pollBuilder.noMediaSelected')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="builder-card">
                        <div className="builder-card-header">
                            <div>
                                <p className="builder-eyebrow">{t('addons.pollBuilder.settings')}</p>
                                <h2>{t('addons.pollBuilder.settings')}</h2>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.pollMode')}</label>
                                <select value={formData.pollMode} onChange={(event) => updateField('pollMode', event.target.value)}>
                                    <option value="named">{t('addons.pollBuilder.pollMode.named')}</option>
                                    <option value="anonymous">{t('addons.pollBuilder.pollMode.anonymous')}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.showResults')}</label>
                                <select value={formData.showResultsMode} onChange={(event) => updateField('showResultsMode', event.target.value)}>
                                    <option value="immediately">{t('addons.pollBuilder.showResults.immediately')}</option>
                                    <option value="after_vote">{t('addons.pollBuilder.showResults.afterVote')}</option>
                                    <option value="after_end">{t('addons.pollBuilder.showResults.afterEnd')}</option>
                                    <option value="hidden">{t('addons.pollBuilder.showResults.hidden')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="switch-grid">
                            <label className="switch-card">
                                <input
                                    type="checkbox"
                                    checked={formData.allowMultipleChoice}
                                    onChange={(event) => updateField('allowMultipleChoice', event.target.checked)}
                                />
                                <span>{t('addons.pollBuilder.allowMultiple')}</span>
                            </label>
                            <label className="switch-card">
                                <input
                                    type="checkbox"
                                    checked={formData.requireLogin}
                                    onChange={(event) => updateField('requireLogin', event.target.checked)}
                                />
                                <span>{t('addons.pollBuilder.requireLogin')}</span>
                            </label>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.startDate')}</label>
                                <input type="datetime-local" value={formData.startDate} onChange={(event) => updateField('startDate', event.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.endDate')}</label>
                                <input type="datetime-local" value={formData.endDate} onChange={(event) => updateField('endDate', event.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.maxVotes')}</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.maxVotesPerUser}
                                    onChange={(event) => updateField('maxVotesPerUser', event.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="builder-card">
                        <div className="builder-card-header">
                            <div>
                                <p className="builder-eyebrow">{t('addons.pollBuilder.theme')}</p>
                                <h2>{t('addons.pollBuilder.theme')}</h2>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.primaryColor')}</label>
                                <input
                                    type="color"
                                    value={formData.themeSettings.primary_color}
                                    onChange={(event) => updateThemeField('primary_color', event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.secondaryColor')}</label>
                                <input
                                    type="color"
                                    value={formData.themeSettings.secondary_color}
                                    onChange={(event) => updateThemeField('secondary_color', event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.fontFamily')}</label>
                                <input
                                    value={formData.themeSettings.font_family}
                                    onChange={(event) => updateThemeField('font_family', event.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.buttonStyle')}</label>
                                <select value={formData.themeSettings.button_style} onChange={(event) => updateThemeField('button_style', event.target.value)}>
                                    <option value="rounded">Rounded</option>
                                    <option value="square">Square</option>
                                    <option value="pill">Pill</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.backgroundStyle')}</label>
                                <select value={formData.themeSettings.background_style} onChange={(event) => updateThemeField('background_style', event.target.value)}>
                                    <option value="soft">Soft</option>
                                    <option value="solid">Solid</option>
                                    <option value="glass">Glass</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>{t('addons.pollBuilder.layoutStyle')}</label>
                                <select value={formData.layoutSettings.layout_style} onChange={(event) => updateLayoutField('layout_style', event.target.value)}>
                                    <option value="list">List</option>
                                    <option value="cards">Cards</option>
                                    <option value="grid">Grid</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    <div className="builder-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => savePoll('draft')} disabled={saving}>
                            <Save size={16} />
                            <span>{t('addons.pollBuilder.saveDraft')}</span>
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => savePoll('published')} disabled={saving}>
                            <Send size={16} />
                            <span>{t('addons.pollBuilder.publish')}</span>
                        </button>
                    </div>
                </div>

                <aside className="preview-column">
                    <div className="preview-card" style={previewStyle}>
                        <div className="preview-card-header">
                            <span className="preview-badge">{t('addons.pollBuilder.previewBadge')}</span>
                            <span className="preview-status">{previewText(formData.status, formData.status, isArabic)}</span>
                        </div>

                        {coverPreview ? (
                            <div className="preview-cover">
                                <img src={coverPreview} alt={t('addons.pollBuilder.coverPreview')} />
                            </div>
                        ) : (
                            <div className="preview-cover preview-cover-empty">
                                <Sparkles size={28} />
                            </div>
                        )}

                        <div className="preview-copy">
                            <p className="preview-client">
                                {localizedText(i18n, selectedClient?.name, selectedClient?.name_ar) || t('addons.pollBuilder.selectClient')}
                            </p>
                            <h3>{previewText(formData.title, formData.titleAr, isArabic) || t('addons.pollBuilder.createTitle')}</h3>
                            {previewText(formData.subtitle, formData.subtitleAr, isArabic) && (
                                <p className="preview-subtitle">{previewText(formData.subtitle, formData.subtitleAr, isArabic)}</p>
                            )}
                            {previewText(formData.description, formData.descriptionAr, isArabic) && (
                                <p className="preview-description">{previewText(formData.description, formData.descriptionAr, isArabic)}</p>
                            )}
                        </div>

                        <div className="preview-meta">
                            <span>
                                <Globe2 size={14} />
                                {formData.pollMode === 'anonymous' ? t('addons.pollBuilder.pollMode.anonymous') : t('addons.pollBuilder.pollMode.named')}
                            </span>
                            <span>
                                <CalendarDays size={14} />
                                {formData.maxVotesPerUser} {t('addons.pollBuilder.maxVotes')}
                            </span>
                        </div>

                        <div className="preview-options">
                            {formData.options.length === 0 ? (
                                <div className="preview-empty">{t('addons.pollBuilder.noOptions')}</div>
                            ) : (
                                formData.options.map((option) => {
                                    const optionLabel = previewText(option.text, option.textAr, isArabic);
                                    const optionMedia = getOptionMediaSource(option, 'icon') || getOptionMediaSource(option, 'image');
                                    return (
                                        <button
                                            type="button"
                                            key={option.id}
                                            className="preview-option"
                                            style={{
                                                borderColor: option.colorOverride || 'rgba(148, 111, 167, 0.18)'
                                            }}
                                        >
                                            {optionMedia ? (
                                                <img className="preview-option-media" src={optionMedia} alt={optionLabel} />
                                            ) : (
                                                <span className="preview-option-dot" style={{ background: option.colorOverride || 'var(--poll-primary)' }} />
                                            )}
                                            <span>{optionLabel}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="preview-footer">
                            <small>
                                {localizedText(i18n, selectedEvent?.name, selectedEvent?.name_ar) || t('addons.pollBuilder.selectEvent')}
                            </small>
                            <button type="button" className="btn btn-primary btn-block">
                                <Eye size={16} />
                                <span>{t('addons.pollBuilder.voteButton')}</span>
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {mode === 'edit' && (
                <section className="builder-card poll-report-card">
                    <div className="builder-card-header">
                        <div>
                            <p className="builder-eyebrow">{t('addons.pollBuilder.reportTitle')}</p>
                            <h2>{t('addons.pollBuilder.reportTitle')}</h2>
                            <p className="builder-note">{t('addons.pollBuilder.reportSubtitle')}</p>
                        </div>
                        <div className="report-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => fetchReport()} disabled={reportLoading}>
                                <BarChart3 size={16} />
                                <span>{t('addons.pollBuilder.refreshReport')}</span>
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleExportReport} disabled={!reportData || reportLoading}>
                                <Download size={16} />
                                <span>{t('addons.pollBuilder.exportCsv')}</span>
                            </button>
                        </div>
                    </div>

                    {reportError && <div className="form-error">{reportError}</div>}

                    {reportLoading ? (
                        <div className="report-empty">{t('common.loading')}</div>
                    ) : reportData ? (
                        <>
                            <div className="report-summary-grid">
                                <article className="report-summary-card">
                                    <span>{t('addons.pollBuilder.reportTotalVotes')}</span>
                                    <strong>{reportData.summary?.total_votes ?? 0}</strong>
                                </article>
                                <article className="report-summary-card">
                                    <span>{t('addons.pollBuilder.reportParticipants')}</span>
                                    <strong>{reportData.summary?.total_participants ?? 0}</strong>
                                </article>
                                <article className="report-summary-card">
                                    <span>{t('addons.pollBuilder.reportNamedParticipants')}</span>
                                    <strong>{reportData.summary?.named_participants ?? 0}</strong>
                                </article>
                                <article className="report-summary-card">
                                    <span>{t('addons.pollBuilder.reportAnonymousParticipants')}</span>
                                    <strong>{reportData.summary?.anonymous_participants ?? 0}</strong>
                                </article>
                            </div>

                            <div className="report-grid">
                                <div className="report-panel">
                                    <div className="report-panel-header">
                                        <h3>{t('addons.pollBuilder.reportOptions')}</h3>
                                        <small>{reportData.options?.length || 0}</small>
                                    </div>
                                    <div className="report-option-list">
                                        {(reportData.options || []).length === 0 ? (
                                            <div className="report-empty">{t('addons.pollBuilder.reportNoVotes')}</div>
                                        ) : (
                                            reportData.options.map((option) => {
                                                const optionLabel = previewText(option.text, option.text_ar, isArabic);
                                                return (
                                                    <div className="report-option-item" key={option.id}>
                                                        <div className="report-option-meta">
                                                            <strong>{optionLabel}</strong>
                                                            <span>
                                                                {option.votes_count || 0} {t('addons.pollBuilder.reportVotes')}
                                                            </span>
                                                        </div>
                                                        <div className="report-option-bar">
                                                            <div
                                                                className="report-option-bar-fill"
                                                                style={{
                                                                    width: `${option.percentage || 0}%`,
                                                                    background: option.color_override || 'var(--poll-primary)'
                                                                }}
                                                            />
                                                        </div>
                                                        <small>{option.percentage || 0}%</small>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="report-panel">
                                    <div className="report-panel-header">
                                        <h3>{t('addons.pollBuilder.reportVotes')}</h3>
                                        <small>{reportData.votes?.length || 0}</small>
                                    </div>
                                    <div className="report-vote-list">
                                        {(reportData.votes || []).length === 0 ? (
                                            <div className="report-empty">{t('addons.pollBuilder.reportNoVotes')}</div>
                                        ) : (
                                            reportData.votes.map((vote) => {
                                                const selection = previewText(vote.option_text, vote.option_text_ar, isArabic);
                                                const anonymous = reportData.poll?.poll_mode === 'anonymous';
                                                const voterLabel = anonymous
                                                    ? t('addons.pollBuilder.anonymousGuest')
                                                    : vote.guest_name || t('addons.pollBuilder.anonymousGuest');
                                                return (
                                                    <article className="report-vote-item" key={vote.id}>
                                                        <div className="report-vote-head">
                                                            <strong>{voterLabel}</strong>
                                                            <span>{formatReportDate(vote.created_at, i18n.language)}</span>
                                                        </div>
                                                        <p>{selection}</p>
                                                        {!anonymous && (
                                                            <div className="report-vote-details">
                                                                {vote.guest_position && <span>{vote.guest_position}</span>}
                                                                {vote.guest_email && <span>{vote.guest_email}</span>}
                                                                {vote.guest_mobile_number && <span>{vote.guest_mobile_number}</span>}
                                                            </div>
                                                        )}
                                                    </article>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="report-empty">{t('addons.pollBuilder.reportNoVotes')}</div>
                    )}
                </section>
            )}
        </div>
    );
}
