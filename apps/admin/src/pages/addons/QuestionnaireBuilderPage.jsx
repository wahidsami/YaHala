import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare, CircleDot, ListChecks, MessageSquareText, Plus, Star, Save, Send, Trash2 } from 'lucide-react';
import api from '../../services/api';
import './QuestionnaireBuilderPage.css';

const QUESTION_TYPES = [
    { id: 'yes_no', label: 'Yes / No', icon: CheckSquare },
    { id: 'single_choice', label: 'Single Choice', icon: CircleDot },
    { id: 'multiple_choice', label: 'Multiple Choice', icon: ListChecks },
    { id: 'short_text', label: 'Short Text', icon: MessageSquareText },
    { id: 'rating', label: 'Rating', icon: Star }
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
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [activeStep, setActiveStep] = useState(1);

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
            purposeAr: initialData.settings?.purposeAr || initialData.settings?.purpose_ar || ''
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

    async function saveQuestionnaire(nextStatus = formData.status) {
        if (!canSave) {
            setError('Please complete details and add at least one question.');
            return;
        }
        setSaving(true);
        setError('');
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
            navigate('/addons');
        } catch (saveError) {
            setError(saveError.response?.data?.message || 'Failed to save questionnaire.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="questionnaire-builder-page">
            <div className="page-header">
                <div>
                    <button type="button" className="back-link" onClick={() => navigate('/addons')}>
                        <ArrowLeft size={18} />
                        <span>Back to Addons</span>
                    </button>
                    <h1>{mode === 'edit' ? 'Edit Questionnaire' : 'Create Questionnaire'}</h1>
                    <p>Step 1: Details, Step 2: Questions and types, Step 3: Save.</p>
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="builder-steps">
                <button type="button" className={activeStep === 1 ? 'active' : ''} onClick={() => setActiveStep(1)}>1. Details</button>
                <button type="button" className={activeStep === 2 ? 'active' : ''} onClick={() => setActiveStep(2)}>2. Questions</button>
                <button type="button" className={activeStep === 3 ? 'active' : ''} onClick={() => setActiveStep(3)}>3. Review & Save</button>
            </div>

            {activeStep === 1 && (
                <section className="builder-card">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Client</label>
                            <select value={formData.clientId} onChange={(e) => updateField('clientId', e.target.value)}>
                                <option value="">Select client</option>
                                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Event</label>
                            <select value={formData.eventId} onChange={(e) => updateField('eventId', e.target.value)}>
                                <option value="">Select event</option>
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
                        <label>Status</label>
                        <select value={formData.status} onChange={(e) => updateField('status', e.target.value)}>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
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
                                    title={`Add ${type.label}`}
                                >
                                    <Icon size={16} />
                                    <span>{type.label}</span>
                                    <Plus size={14} />
                                </button>
                            );
                        })}
                    </div>

                    <div className="question-list">
                        {formData.questions.map((question, index) => (
                            <article key={question.id} className="question-card">
                                <div className="question-card-head">
                                    <strong>Q{index + 1} · {QUESTION_TYPES.find((item) => item.id === question.questionType)?.label || question.questionType}</strong>
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
                    <h3>Review</h3>
                    <p>Questions count: {formData.questions.length}</p>
                    <div className="builder-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => saveQuestionnaire('draft')} disabled={saving || !canSave}>
                            <Save size={16} />
                            <span>Save Draft</span>
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => saveQuestionnaire('published')} disabled={saving || !canSave}>
                            <Send size={16} />
                            <span>Publish</span>
                        </button>
                    </div>
                </section>
            )}
        </div>
    );
}
