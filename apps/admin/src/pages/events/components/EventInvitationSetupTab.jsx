import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, CheckSquare2, LayoutTemplate, MessageSquare, Sparkles } from 'lucide-react';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventInvitationSetupTab.css';

function localizedText(i18n, primary, secondary) {
    return i18n.language?.startsWith('ar') ? (secondary || primary || '') : (primary || secondary || '');
}

export default function EventInvitationSetupTab({ event, onUpdated }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [polls, setPolls] = useState([]);
    const [questionnaires, setQuestionnaires] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        templateId: '',
        addIns: [],
        pollIds: [],
        questionnaireId: ''
    });

    const invitationSetup = event?.settings?.invitation_setup || {};

    useEffect(() => {
        const addIns = Array.isArray(event?.settings?.addIns) ? event.settings.addIns : [];
        const pollEnabled = addIns.includes('poll');
        const questionnaireEnabled = addIns.includes('questionnaire');
        const setupTabs = Array.isArray(invitationSetup.tabs) ? invitationSetup.tabs : [];

        setFormData({
            templateId: invitationSetup.templateId || event?.template_id || '',
            addIns,
            pollIds: pollEnabled
                ? setupTabs
                    .filter((tab) => tab?.type === 'poll')
                    .map((tab) => tab.addon_id || tab.addonId)
                    .filter(Boolean)
                : [],
            questionnaireId: questionnaireEnabled
                ? (
                    setupTabs.find((tab) => tab?.type === 'questionnaire')?.addon_id
                    || setupTabs.find((tab) => tab?.type === 'questionnaire')?.addonId
                    || ''
                )
                : ''
        });
    }, [event?.id, event?.template_id, event?.settings?.addIns, invitationSetup.templateId, invitationSetup.tabs]);

    useEffect(() => {
        async function fetchReferences() {
            if (!event?.id) {
                return;
            }

            setLoading(true);
            setError('');

            try {
                const [templatesResponse, pollsResponse, questionnairesResponse] = await Promise.all([
                    api.get('/admin/templates?pageSize=200'),
                    api.get(`/admin/polls?eventId=${event.id}&pageSize=200`),
                    api.get(`/admin/questionnaires?eventId=${event.id}&pageSize=200`)
                ]);

                setTemplates(templatesResponse.data.data || []);
                setPolls(pollsResponse.data.data || []);
                setQuestionnaires(questionnairesResponse.data.data || []);
            } catch (fetchError) {
                console.error('Failed to load invitation setup references:', fetchError);
                setError(fetchError.response?.data?.message || t('events.invitationSetup.loadFailed'));
            } finally {
                setLoading(false);
            }
        }

        fetchReferences();
    }, [event?.id, t]);

    const selectedPolls = useMemo(() => {
        const selected = new Set(formData.pollIds);
        return polls.filter((poll) => selected.has(poll.id));
    }, [polls, formData.pollIds]);

    const selectedQuestionnaire = useMemo(
        () => questionnaires.find((item) => item.id === formData.questionnaireId) || null,
        [questionnaires, formData.questionnaireId]
    );

    const setupChecklist = useMemo(() => [
        {
            label: t('events.invitationSetup.checklist.template'),
            done: Boolean(formData.templateId)
        },
        {
            label: t('events.invitationSetup.checklist.pollAddon'),
            done: formData.addIns.includes('poll')
        },
        {
            label: t('events.invitationSetup.checklist.pollTabs'),
            done: !formData.addIns.includes('poll') || selectedPolls.length > 0
        },
        {
            label: t('addons.questionnaireTab'),
            done: !formData.addIns.includes('questionnaire') || Boolean(formData.questionnaireId)
        },
        {
            label: t('events.invitationSetup.checklist.ready'),
            done: Boolean(
                formData.templateId
                && (!formData.addIns.includes('poll') || selectedPolls.length > 0)
                && (!formData.addIns.includes('questionnaire') || formData.questionnaireId)
            )
        }
    ], [formData.addIns, formData.questionnaireId, formData.templateId, selectedPolls.length, t]);

    function openPoll(pollId) {
        navigate(`/addons/polls/${pollId}`);
    }

    function togglePoll(pollId, checked) {
        setFormData((prev) => {
            const nextIds = new Set(prev.pollIds);
            if (checked) {
                nextIds.add(pollId);
            } else {
                nextIds.delete(pollId);
            }

            return {
                ...prev,
                pollIds: polls
                    .filter((poll) => nextIds.has(poll.id))
                    .map((poll) => poll.id)
            };
        });
    }

    function toggleAddon(addonId, checked) {
        setFormData((prev) => {
            const addIns = checked
                ? Array.from(new Set([...prev.addIns, addonId]))
                : prev.addIns.filter((id) => id !== addonId);

            return {
                ...prev,
                addIns,
                pollIds: addonId === 'poll' && !checked ? [] : prev.pollIds,
                questionnaireId: addonId === 'questionnaire' && !checked ? '' : prev.questionnaireId
            };
        });
    }

    async function saveInvitationSetup() {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            if (formData.addIns.includes('poll') && formData.pollIds.length === 0) {
                setError(t('events.invitationSetup.noPolls'));
                return;
            }
            if (formData.addIns.includes('questionnaire') && !formData.questionnaireId) {
                setError('Please select one questionnaire.');
                return;
            }

            const tabs = [];
            if (formData.addIns.includes('poll')) {
                formData.pollIds.forEach((pollId, index) => {
                    tabs.push({
                        type: 'poll',
                        addonId: pollId,
                        sortOrder: index
                    });
                });
            }
            if (formData.addIns.includes('questionnaire') && formData.questionnaireId) {
                tabs.push({
                    type: 'questionnaire',
                    addonId: formData.questionnaireId,
                    sortOrder: tabs.length
                });
            }

            await api.patch(`/admin/events/${event.id}/invitation-setup`, {
                templateId: formData.templateId || null,
                addIns: formData.addIns,
                invitationSetup: {
                    tabs
                }
            });

            setSuccess(t('events.invitationSetup.saved'));
            await onUpdated?.();
        } catch (saveError) {
            console.error('Failed to save invitation setup:', saveError);
            setError(saveError.response?.data?.message || t('events.invitationSetup.saveFailed'));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="invitation-setup-loading">{t('common.loading')}</div>;
    }

    return (
        <div className="invitation-setup-tab">
            {error && <div className="form-error">{error}</div>}
            {success && <div className="status-banner success">{success}</div>}

            <div className="invitation-setup-summary">
                <div className="invitation-setup-summary-copy">
                    <p className="invitation-setup-summary-eyebrow">{t('events.invitationSetup.summaryTitle')}</p>
                    <h3>{t('events.invitationSetup.summaryHint')}</h3>
                </div>
                <div className="invitation-setup-summary-chips">
                    <span className="summary-chip summary-chip-soft">
                        {formData.templateId
                            ? t('events.invitationSetup.templateSelected')
                            : t('events.invitationSetup.noTemplateSelected')}
                    </span>
                    <span className="summary-chip">
                        {t('events.invitationSetup.selectedTabs', { count: selectedPolls.length + (selectedQuestionnaire ? 1 : 0) })}
                    </span>
                    {selectedPolls.map((poll) => (
                        <button
                            type="button"
                            key={poll.id}
                            className="summary-chip summary-chip-soft summary-chip-action"
                            onClick={() => openPoll(poll.id)}
                            title={t('events.invitationSetup.openPoll')}
                        >
                            {localizedText(i18n, poll.title, poll.title_ar)}
                        </button>
                    ))}
                    {selectedQuestionnaire && (
                        <span className="summary-chip summary-chip-soft">
                            {t('addons.questionnaireTab')}: {localizedText(i18n, selectedQuestionnaire.title, selectedQuestionnaire.title_ar)}
                        </span>
                    )}
                </div>
            </div>

            <section className="invitation-setup-checklist">
                <div className="section-header">
                    <div>
                        <h3>{t('events.invitationSetup.checklistTitle')}</h3>
                        <p>{t('events.invitationSetup.checklistHint')}</p>
                    </div>
                    <CheckSquare2 size={18} />
                </div>

                <div className="setup-checklist-list">
                    {setupChecklist.map((item) => (
                        <div key={item.label} className={`setup-checklist-item ${item.done ? 'is-ready' : 'is-pending'}`}>
                            {item.done ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span>{item.label}</span>
                            <strong>{item.done ? t('settings.ready') : t('common.pending')}</strong>
                        </div>
                    ))}
                </div>
            </section>

            <div className="invitation-setup-grid">
                <section className="setup-card">
                    <div className="section-header">
                        <div>
                            <h3>Add-ons</h3>
                            <p>Enable add-ons and they will appear in event tabs.</p>
                        </div>
                        <CheckSquare2 size={18} />
                    </div>
                    <div className="addon-toggle-row">
                        <label className="addon-toggle-item">
                            <input
                                type="checkbox"
                                checked={formData.addIns.includes('poll')}
                                onChange={(event) => toggleAddon('poll', event.target.checked)}
                            />
                            <span>{t('events.form.addin.poll.title')}</span>
                        </label>
                        <label className="addon-toggle-item">
                            <input
                                type="checkbox"
                                checked={formData.addIns.includes('questionnaire')}
                                onChange={(event) => toggleAddon('questionnaire', event.target.checked)}
                            />
                            <span>{t('events.form.addin.questionnaire.title')}</span>
                        </label>
                    </div>
                </section>

                <section className="setup-card">
                    <div className="section-header">
                        <div>
                            <h3>{t('events.invitationSetup.templateTitle')}</h3>
                            <p>{t('events.invitationSetup.templateHelp')}</p>
                        </div>
                        <LayoutTemplate size={18} />
                    </div>

                    <div className="form-group">
                        <label htmlFor="setupTemplateId">{t('events.invitationSetup.template')}</label>
                        <select
                            id="setupTemplateId"
                            value={formData.templateId}
                            onChange={(event) => setFormData((prev) => ({ ...prev, templateId: event.target.value }))}
                        >
                            <option value="">{t('events.dashboardTemplateNotAssigned')}</option>
                            {templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {localizedText(i18n, template.name, template.name_ar)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="selected-template-note">
                        <Sparkles size={16} />
                        <span>
                            {formData.templateId
                                ? t('events.invitationSetup.templateSelected')
                                : t('events.invitationSetup.noTemplateSelected')}
                        </span>
                    </div>
                </section>

                <section className="setup-card setup-card--wide">
                    <div className="section-header">
                        <div>
                            <h3>{t('events.invitationSetup.tabsTitle')}</h3>
                            <p>{t('events.invitationSetup.tabsHelp')}</p>
                        </div>
                        <CheckSquare2 size={18} />
                    </div>

                    {!formData.addIns.includes('poll') ? (
                        <div className="setup-empty-state">
                            <MessageSquare size={20} />
                            <p>{t('events.invitationSetup.pollDisabled')}</p>
                        </div>
                    ) : polls.length === 0 ? (
                        <div className="setup-empty-state">
                            <MessageSquare size={20} />
                            <p>{t('events.invitationSetup.noPolls')}</p>
                        </div>
                    ) : (
                        <div className="addon-selection-grid">
                            {polls.map((poll) => {
                                const checked = formData.pollIds.includes(poll.id);
                                return (
                                    <label key={poll.id} className={`addon-selection-card ${checked ? 'selected' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => togglePoll(poll.id, event.target.checked)}
                                        />
                                        <div className="addon-selection-copy">
                                            <span className="addon-selection-kind">
                                                <MessageSquare size={11} />
                                                <span>{t('addons.pollTab')}</span>
                                            </span>
                                            <strong>{localizedText(i18n, poll.title, poll.title_ar)}</strong>
                                            <span>{localizedText(i18n, event?.client_name, event?.client_name_ar)}</span>
                                            <small>{t(`addons.polls.status.${poll.status}`) || poll.status}</small>
                                        </div>
                                        <div className="addon-selection-meta">
                                            <span>{poll.participants_count || 0}</span>
                                            <small>{t('addons.polls.participants')}</small>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="setup-card setup-card--wide">
                    <div className="section-header">
                        <div>
                            <h3>{t('addons.questionnaireTab')}</h3>
                            <p>Select one questionnaire for the event invitation tab.</p>
                        </div>
                        <CheckSquare2 size={18} />
                    </div>

                    {!formData.addIns.includes('questionnaire') ? (
                        <div className="setup-empty-state">
                            <MessageSquare size={20} />
                            <p>Enable Questionnaire addon to add this tab.</p>
                        </div>
                    ) : questionnaires.length === 0 ? (
                        <div className="setup-empty-state">
                            <MessageSquare size={20} />
                            <p>No questionnaires found for this event.</p>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="setupQuestionnaireId">{t('addons.questionnaireTab')}</label>
                            <select
                                id="setupQuestionnaireId"
                                value={formData.questionnaireId}
                                onChange={(event) => setFormData((prev) => ({ ...prev, questionnaireId: event.target.value }))}
                            >
                                <option value="">Select questionnaire</option>
                                {questionnaires.map((questionnaire) => (
                                    <option key={questionnaire.id} value={questionnaire.id}>
                                        {localizedText(i18n, questionnaire.title, questionnaire.title_ar)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </section>
            </div>

            <div className="setup-actions">
                <RoleGuard permission="events.edit">
                    <button type="button" className="btn btn-primary" onClick={saveInvitationSetup} disabled={saving}>
                        {saving ? t('common.loading') : t('events.invitationSetup.save')}
                    </button>
                </RoleGuard>
            </div>
        </div>
    );
}
