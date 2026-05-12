import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckSquare, CircleDot, ListChecks, MessageSquareText, Plus, Star, Save, Send, Trash2 } from 'lucide-react';
import api from '../../services/api';
import './QuestionnaireBuilderPage.css';

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

const QUESTION_TYPES = [
    { id: 'yes_no', en: 'Yes / No', ar: 'نعم / لا', icon: CheckSquare },
    { id: 'single_choice', en: 'Single Choice', ar: 'اختيار واحد', icon: CircleDot },
    { id: 'multiple_choice', en: 'Multiple Choice', ar: 'اختيارات متعددة', icon: ListChecks },
    { id: 'short_text', en: 'Short Text', ar: 'نص قصير', icon: MessageSquareText },
    { id: 'rating', en: 'Rating', ar: 'تقييم', icon: Star }
];

function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createQuestion(type = 'short_text', index = 0) {
    const base = {
        id: createId(),
        questionType: type,
        title: `Question ${index + 1}`,
        titleAr: '',
        description: '',
        descriptionAr: '',
        isRequired: false,
        sortOrder: index,
        settings: {},
        options: []
    };
    if (type === 'yes_no') {
        base.options = [
            { id: createId(), label: 'Yes', labelAr: 'نعم', value: 'yes', sortOrder: 0 },
            { id: createId(), label: 'No', labelAr: 'لا', value: 'no', sortOrder: 1 }
        ];
        base.settings = { correctBoolean: null };
    }
    if (type === 'single_choice' || type === 'multiple_choice') {
        base.options = [
            { id: createId(), label: 'Option 1', labelAr: '', value: 'option_1', sortOrder: 0 },
            { id: createId(), label: 'Option 2', labelAr: '', value: 'option_2', sortOrder: 1 }
        ];
        if (type === 'single_choice') {
            base.settings = { correctOptionValue: '' };
        }
    }
    if (type === 'rating') {
        base.settings = { min: 1, max: 5 };
    }
    return base;
}

export default function QuestionnaireBuilderPage({ mode = 'create', initialData = {} }) {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeStep, setActiveStep] = useState(1);
    const [saveNotice, setSaveNotice] = useState('');

    const [formData, setFormData] = useState({
        clientId: initialData.client_id || searchParams.get('clientId') || '',
        eventId: initialData.event_id || searchParams.get('eventId') || '',
        title: initialData.title || '',
        titleAr: initialData.title_ar || '',
        description: initialData.description || '',
        descriptionAr: initialData.description_ar || '',
        status: initialData.status || 'draft',
        settings: {
            purpose: initialData.settings?.purpose || '',
            purposeAr: initialData.settings?.purposeAr || initialData.settings?.purpose_ar || '',
            theme: {
                backgroundType: initialData.settings?.theme?.backgroundType || 'color',
                backgroundColor: initialData.settings?.theme?.backgroundColor || '#f8fafc',
                backgroundImage: initialData.settings?.theme?.backgroundImage || '',
                backgroundSize: initialData.settings?.theme?.backgroundSize || 'cover',
                backgroundRepeat: initialData.settings?.theme?.backgroundRepeat || 'no-repeat',
                backgroundPosition: initialData.settings?.theme?.backgroundPosition || 'center center',
                textColor: initialData.settings?.theme?.textColor || '#0f172a',
                buttonColor: initialData.settings?.theme?.buttonColor || '#334155',
                buttonTextColor: initialData.settings?.theme?.buttonTextColor || '#ffffff',
                selectedAnswerColor: initialData.settings?.theme?.selectedAnswerColor || '#22c55e',
                selectedAnswerTextColor: initialData.settings?.theme?.selectedAnswerTextColor || '#ffffff'
            }
        },
        questions: Array.isArray(initialData.questions) && initialData.questions.length
            ? initialData.questions.map((q, idx) => ({
                id: q.id || createId(),
                questionType: q.question_type || q.questionType,
                title: q.title || '',
                titleAr: q.title_ar || q.titleAr || '',
                description: q.description || '',
                descriptionAr: q.description_ar || q.descriptionAr || '',
                isRequired: Boolean(q.is_required ?? q.isRequired),
                sortOrder: q.sort_order ?? q.sortOrder ?? idx,
                settings: q.settings || {},
                options: Array.isArray(q.options) ? q.options.map((o, optionIndex) => ({
                    id: o.id || createId(),
                    label: o.label || '',
                    labelAr: o.label_ar || o.labelAr || '',
                    value: o.value || '',
                    sortOrder: o.sort_order ?? o.sortOrder ?? optionIndex
                })) : []
            }))
            : []
    });

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (formData.clientId) {
            fetchEvents(formData.clientId);
        }
    }, [formData.clientId]);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data?.data || []);
        } finally {
            setLoading(false);
        }
    }

    async function fetchEvents(clientId) {
        try {
            const response = await api.get(`/admin/events?pageSize=200&clientId=${clientId}`);
            setEvents(response.data?.data || []);
        } catch {
            setEvents([]);
        }
    }

    function updateField(name, value) {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }

    function updateTheme(patch) {
        setFormData((prev) => ({
            ...prev,
            settings: {
                ...prev.settings,
                theme: {
                    ...(prev.settings?.theme || {}),
                    ...patch
                }
            }
        }));
    }

    async function uploadThemeBackgroundImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readFileAsDataUrl(file);
            updateTheme({ backgroundType: 'image', backgroundImage: dataUrl });
        } catch {
            setError('Failed to upload background image.');
        }
    }

    function addQuestion(type = 'short_text') {
        setFormData((prev) => ({
            ...prev,
            questions: [...prev.questions, createQuestion(type, prev.questions.length)]
        }));
    }

    function removeQuestion(questionId) {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions
                .filter((q) => q.id !== questionId)
                .map((q, idx) => ({ ...q, sortOrder: idx }))
        }));
    }

    function updateQuestion(questionId, patch) {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q))
        }));
    }

    function addOption(questionId) {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) => {
                if (q.id !== questionId) return q;
                const nextIndex = q.options.length;
                return {
                    ...q,
                    options: [
                        ...q.options,
                        { id: createId(), label: `Option ${nextIndex + 1}`, labelAr: '', value: `option_${nextIndex + 1}`, sortOrder: nextIndex }
                    ]
                };
            })
        }));
    }

    function updateOption(questionId, optionId, patch) {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) => {
                if (q.id !== questionId) return q;
                return {
                    ...q,
                    options: q.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o))
                };
            })
        }));
    }

    function removeOption(questionId, optionId) {
        setFormData((prev) => ({
            ...prev,
            questions: prev.questions.map((q) => {
                if (q.id !== questionId) return q;
                return {
                    ...q,
                    options: q.options.filter((o) => o.id !== optionId).map((o, idx) => ({ ...o, sortOrder: idx }))
                };
            })
        }));
    }

    const canSave = useMemo(() => {
        return Boolean(formData.clientId && formData.eventId && formData.title.trim() && formData.questions.length > 0);
    }, [formData]);

    async function saveQuestionnaire(nextStatus = formData.status, options = {}) {
        const { stayOnPage = false } = options;
        if (!canSave) {
            setError('Please complete details and add at least one question.');
            return;
        }
        setSaving(true);
        setError('');
        setSaveNotice('');
        try {
            const payload = {
                clientId: formData.clientId,
                eventId: formData.eventId,
                title: formData.title,
                titleAr: formData.titleAr || null,
                description: formData.description || null,
                descriptionAr: formData.descriptionAr || null,
                status: nextStatus,
                settings: formData.settings || {},
                questions: formData.questions.map((q, index) => ({
                    id: q.id,
                    questionType: q.questionType,
                    title: q.title,
                    titleAr: q.titleAr || null,
                    description: q.description || null,
                    descriptionAr: q.descriptionAr || null,
                    isRequired: q.isRequired,
                    sortOrder: index,
                    settings: q.settings || {},
                    options: (q.options || []).map((o, optionIndex) => ({
                        id: o.id,
                        label: o.label,
                        labelAr: o.labelAr || null,
                        value: o.value || o.label,
                        sortOrder: optionIndex
                    }))
                }))
            };

            if (mode === 'edit' && initialData?.id) {
                await api.put(`/admin/questionnaires/${initialData.id}`, payload);
            } else {
                await api.post('/admin/questionnaires', payload);
            }
            if (stayOnPage) {
                setSaveNotice('Progress saved.');
            } else {
                navigate('/addons/questionnaires');
            }
        } catch (saveError) {
            setError(saveError.response?.data?.message || 'Failed to save questionnaire.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="loading">{localize(i18n, 'Loading...', 'جارٍ التحميل...')}</div>;

    return (
        <div className="questionnaire-builder-page">
            <div className="page-header">
                <div>
                    <button type="button" className="back-link" onClick={() => navigate('/addons/questionnaires')}>
                        <ArrowLeft size={18} />
                        <span>{localize(i18n, 'Back to Addons', 'العودة إلى الإضافات')}</span>
                    </button>
                    <h1>{mode === 'edit' ? localize(i18n, 'Edit Questionnaire', 'تعديل الاستبيان') : localize(i18n, 'Create Questionnaire', 'إنشاء استبيان')}</h1>
                    <p>{localize(i18n, 'Step 1: Details, Step 2: Questions and types, Step 3: Save.', 'الخطوة 1: التفاصيل، الخطوة 2: الأسئلة والأنواع، الخطوة 3: الحفظ.')}</p>
                </div>
                <div className="builder-header-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => saveQuestionnaire(formData.status, { stayOnPage: true })}
                        disabled={saving || !canSave}
                    >
                        <Save size={16} />
                        <span>{saving ? localize(i18n, 'Saving...', 'جارٍ الحفظ...') : localize(i18n, 'Save Progress', 'حفظ التقدم')}</span>
                    </button>
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            {saveNotice && <div className="form-success">{saveNotice}</div>}

            <div className="builder-steps">
                <button type="button" className={activeStep === 1 ? 'active' : ''} onClick={() => setActiveStep(1)}>{localize(i18n, '1. Details', '1. التفاصيل')}</button>
                <button type="button" className={activeStep === 2 ? 'active' : ''} onClick={() => setActiveStep(2)}>{localize(i18n, '2. Questions', '2. الأسئلة')}</button>
                <button type="button" className={activeStep === 3 ? 'active' : ''} onClick={() => setActiveStep(3)}>{localize(i18n, '3. Review & Save', '3. المراجعة والحفظ')}</button>
            </div>

            {activeStep === 1 && (
                <section className="builder-card">
                    <div className="form-row">
                        <div className="form-group">
                            <label>{localize(i18n, 'Client', 'العميل')}</label>
                            <select value={formData.clientId} onChange={(e) => updateField('clientId', e.target.value)}>
                                <option value="">{localize(i18n, 'Select client', 'اختر العميل')}</option>
                                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{localize(i18n, 'Event', 'الفعالية')}</label>
                            <select value={formData.eventId} onChange={(e) => updateField('eventId', e.target.value)}>
                                <option value="">{localize(i18n, 'Select event', 'اختر الفعالية')}</option>
                                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Title (EN)</label>
                            <input value={formData.title} onChange={(e) => updateField('title', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Title (AR)</label>
                            <input value={formData.titleAr} onChange={(e) => updateField('titleAr', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Description (EN)</label>
                            <textarea rows="3" value={formData.description} onChange={(e) => updateField('description', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Description (AR)</label>
                            <textarea rows="3" value={formData.descriptionAr} onChange={(e) => updateField('descriptionAr', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Questionnaire Purpose (EN)</label>
                            <textarea
                                rows="3"
                                value={formData.settings?.purpose || ''}
                                onChange={(e) => updateField('settings', { ...formData.settings, purpose: e.target.value })}
                                placeholder="Why this questionnaire exists and what decisions it should support"
                            />
                        </div>
                        <div className="form-group">
                            <label>Questionnaire Purpose (AR)</label>
                            <textarea
                                rows="3"
                                value={formData.settings?.purposeAr || ''}
                                onChange={(e) => updateField('settings', { ...formData.settings, purposeAr: e.target.value })}
                                placeholder="هدف الاستبيان"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>{localize(i18n, 'Status', 'الحالة')}</label>
                        <select value={formData.status} onChange={(e) => updateField('status', e.target.value)}>
                            <option value="draft">{localize(i18n, 'Draft', 'مسودة')}</option>
                            <option value="published">{localize(i18n, 'Published', 'منشور')}</option>
                            <option value="archived">{localize(i18n, 'Archived', 'مؤرشف')}</option>
                        </select>
                    </div>

                    <div className="theme-settings-block">
                        <h4>Questionnaire Theme</h4>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Background Type</label>
                                <select
                                    value={formData.settings?.theme?.backgroundType || 'color'}
                                    onChange={(e) => updateTheme({ backgroundType: e.target.value })}
                                >
                                    <option value="color">Color</option>
                                    <option value="image">Image</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Background Color</label>
                                <input
                                    type="color"
                                    value={formData.settings?.theme?.backgroundColor || '#f8fafc'}
                                    onChange={(e) => updateTheme({ backgroundColor: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Upload Background Image</label>
                                <input type="file" accept="image/*" onChange={uploadThemeBackgroundImage} />
                                <small className="info-text">
                                    {formData.settings?.theme?.backgroundImage
                                        ? 'Background image is set.'
                                        : 'No background image selected.'}
                                </small>
                                {formData.settings?.theme?.backgroundImage && (
                                    <img
                                        src={formData.settings.theme.backgroundImage}
                                        alt="Questionnaire background preview"
                                        className="theme-bg-preview"
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <label>Background Size</label>
                                <select
                                    value={formData.settings?.theme?.backgroundSize || 'cover'}
                                    onChange={(e) => updateTheme({ backgroundSize: e.target.value })}
                                >
                                    <option value="cover">Cover</option>
                                    <option value="contain">Fit / Contain</option>
                                    <option value="auto">Auto</option>
                                    <option value="100% 100%">Stretch</option>
                                    <option value="64px 64px">Tile</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Background Repeat</label>
                                <select
                                    value={formData.settings?.theme?.backgroundRepeat || 'no-repeat'}
                                    onChange={(e) => updateTheme({ backgroundRepeat: e.target.value })}
                                >
                                    <option value="no-repeat">No Repeat</option>
                                    <option value="repeat">Repeat</option>
                                    <option value="repeat-x">Repeat X</option>
                                    <option value="repeat-y">Repeat Y</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Background Position</label>
                                <select
                                    value={formData.settings?.theme?.backgroundPosition || 'center center'}
                                    onChange={(e) => updateTheme({ backgroundPosition: e.target.value })}
                                >
                                    <option value="center center">Center</option>
                                    <option value="top center">Top</option>
                                    <option value="bottom center">Bottom</option>
                                    <option value="left center">Left</option>
                                    <option value="right center">Right</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Text Color</label>
                                <input
                                    type="color"
                                    value={formData.settings?.theme?.textColor || '#0f172a'}
                                    onChange={(e) => updateTheme({ textColor: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Button Color</label>
                                <input
                                    type="color"
                                    value={formData.settings?.theme?.buttonColor || '#334155'}
                                    onChange={(e) => updateTheme({ buttonColor: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Button Text Color</label>
                                <input
                                    type="color"
                                    value={formData.settings?.theme?.buttonTextColor || '#ffffff'}
                                    onChange={(e) => updateTheme({ buttonTextColor: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Selected Answer Color</label>
                                <input
                                    type="color"
                                    value={formData.settings?.theme?.selectedAnswerColor || '#22c55e'}
                                    onChange={(e) => updateTheme({ selectedAnswerColor: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Selected Answer Text Color</label>
                                <input
                                    type="color"
                                    value={formData.settings?.theme?.selectedAnswerTextColor || '#ffffff'}
                                    onChange={(e) => updateTheme({ selectedAnswerTextColor: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {activeStep === 2 && (
                <section className="builder-card">
                    <div className="question-add-row">
                        {QUESTION_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
                                <button
                                    key={type.id}
                                    type="button"
                                    className="question-type-btn"
                                    onClick={() => addQuestion(type.id)}
                                    title={localize(i18n, `Add ${type.en}`, `إضافة ${type.ar}`)}
                                >
                                    <Icon size={16} />
                                    <span>{localize(i18n, type.en, type.ar)}</span>
                                    <Plus size={14} />
                                </button>
                            );
                        })}
                    </div>

                    <div className="question-list">
                        {formData.questions.map((question, index) => (
                            <article key={question.id} className="question-card">
                                <div className="question-card-head">
                                    <strong>Q{index + 1} · {localize(i18n, QUESTION_TYPES.find((item) => item.id === question.questionType)?.en || question.questionType, QUESTION_TYPES.find((item) => item.id === question.questionType)?.ar || question.questionType)}</strong>
                                    <button type="button" className="icon-btn danger" onClick={() => removeQuestion(question.id)}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Question (EN)</label>
                                        <input value={question.title} onChange={(e) => updateQuestion(question.id, { title: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Question (AR)</label>
                                        <input value={question.titleAr} onChange={(e) => updateQuestion(question.id, { titleAr: e.target.value })} />
                                    </div>
                                </div>
                                <label className="switch-inline">
                                    <input
                                        type="checkbox"
                                        checked={question.isRequired}
                                        onChange={(e) => updateQuestion(question.id, { isRequired: e.target.checked })}
                                    />
                                    <span>Required</span>
                                </label>

                                {question.questionType === 'yes_no' && (
                                    <div className="form-group">
                                        <label>Correct Answer (optional)</label>
                                        <select
                                            value={
                                                question.settings?.correctBoolean === true
                                                    ? 'yes'
                                                    : question.settings?.correctBoolean === false
                                                        ? 'no'
                                                        : ''
                                            }
                                            onChange={(e) => {
                                                const raw = e.target.value;
                                                const correctBoolean = raw === 'yes' ? true : raw === 'no' ? false : null;
                                                updateQuestion(question.id, {
                                                    settings: { ...question.settings, correctBoolean }
                                                });
                                            }}
                                        >
                                            <option value="">No correct answer</option>
                                            <option value="yes">Yes</option>
                                            <option value="no">No</option>
                                        </select>
                                    </div>
                                )}

                                {(question.questionType === 'single_choice' || question.questionType === 'multiple_choice') && (
                                    <div className="question-options">
                                        <div className="question-options-head">
                                            <strong>Options</strong>
                                            <button type="button" className="btn btn-secondary" onClick={() => addOption(question.id)}>Add Option</button>
                                        </div>
                                        {question.options.map((option) => (
                                            <div key={option.id} className="option-row">
                                                <input
                                                    value={option.label}
                                                    onChange={(e) => updateOption(question.id, option.id, { label: e.target.value })}
                                                    placeholder="Option label"
                                                />
                                                <input
                                                    value={option.labelAr}
                                                    onChange={(e) => updateOption(question.id, option.id, { labelAr: e.target.value })}
                                                    placeholder="Arabic label"
                                                />
                                                <button type="button" className="icon-btn danger" onClick={() => removeOption(question.id, option.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {question.questionType === 'single_choice' && question.options.length > 0 && (
                                            <div className="form-group">
                                                <label>Correct Answer (optional)</label>
                                                <select
                                                    value={question.settings?.correctOptionValue || ''}
                                                    onChange={(e) => updateQuestion(question.id, {
                                                        settings: { ...question.settings, correctOptionValue: e.target.value }
                                                    })}
                                                >
                                                    <option value="">No correct answer</option>
                                                    {question.options.map((option) => (
                                                        <option key={option.id} value={option.value || option.label}>
                                                            {option.label || option.value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {question.questionType === 'rating' && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Min</label>
                                            <input
                                                type="number"
                                                value={question.settings?.min ?? 1}
                                                onChange={(e) => updateQuestion(question.id, { settings: { ...question.settings, min: Number(e.target.value) || 1 } })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Max</label>
                                            <input
                                                type="number"
                                                value={question.settings?.max ?? 5}
                                                onChange={(e) => updateQuestion(question.id, { settings: { ...question.settings, max: Number(e.target.value) || 5 } })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {activeStep === 3 && (
                <section className="builder-card">
                    <h3>{localize(i18n, 'Review', 'مراجعة')}</h3>
                    <p>{localize(i18n, `Questions count: ${formData.questions.length}`, `عدد الأسئلة: ${formData.questions.length}`)}</p>
                    <div className="builder-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => saveQuestionnaire('draft')} disabled={saving || !canSave}>
                            <Save size={16} />
                            <span>{localize(i18n, 'Save Draft', 'حفظ كمسودة')}</span>
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => saveQuestionnaire('published')} disabled={saving || !canSave}>
                            <Send size={16} />
                            <span>{localize(i18n, 'Publish', 'نشر')}</span>
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
