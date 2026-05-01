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

function isPollAddonEnabled(event) {
    return Array.isArray(event?.settings?.addIns) && event.settings.addIns.includes('poll');
}

export default function EventInvitationSetupTab({ event, onUpdated }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({
        templateId: '',
        pollIds: []
    });

    const pollEnabled = isPollAddonEnabled(event);
    const invitationSetup = event?.settings?.invitation_setup || {};

    useEffect(() => {
        setFormData({
            templateId: invitationSetup.templateId || event?.template_id || '',
            pollIds: Array.isArray(invitationSetup.tabs)
                ? invitationSetup.tabs
                    .filter((tab) => tab?.type === 'poll')
                    .map((tab) => tab.addon_id || tab.addonId)
                    .filter(Boolean)
                : []
        });
    }, [event?.id, event?.template_id, invitationSetup.templateId, invitationSetup.tabs]);

    useEffect(() => {
        async function fetchReferences() {
            if (!event?.id) {
                return;
            }

            setLoading(true);
            setError('');

            try {
                const [templatesResponse, pollsResponse] = await Promise.all([
                    api.get('/admin/templates?pageSize=200'),
                    api.get(`/admin/polls?eventId=${event.id}&pageSize=200`)
                ]);

                setTemplates(templatesResponse.data.data || []);
                setPolls(pollsResponse.data.data || []);
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

    const setupChecklist = useMemo(() => [
        {
            label: t('events.invitationSetup.checklist.template'),
            done: Boolean(formData.templateId)
        },
        {
            label: t('events.invitationSetup.checklist.pollAddon'),
            done: pollEnabled
        },
        {
            label: t('events.invitationSetup.checklist.pollTabs'),
            done: selectedPolls.length > 0
        },
        {
            label: t('events.invitationSetup.checklist.ready'),
            done: Boolean(formData.templateId && selectedPolls.length > 0)
        }
    ], [formData.templateId, pollEnabled, selectedPolls.length, t]);

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

    async function saveInvitationSetup() {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const tabs = formData.pollIds.map((pollId, index) => ({
                type: 'poll',
                addonId: pollId,
                sortOrder: index
            }));

            await api.patch(`/admin/events/${event.id}/invitation-setup`, {
                templateId: formData.templateId || null,
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
                        {t('events.invitationSetup.selectedTabs', { count: selectedPolls.length })}
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

                    {!pollEnabled ? (
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
