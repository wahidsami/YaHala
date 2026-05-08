import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, LayoutTemplate, Sparkles } from 'lucide-react';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventInvitationSetupTab.css';

function localizedText(i18n, primary, secondary) {
    return i18n.language?.startsWith('ar') ? (secondary || primary || '') : (primary || secondary || '');
}

export default function EventInvitationSetupTab({ event, onUpdated }) {
    const { t, i18n } = useTranslation();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [addonsSummary, setAddonsSummary] = useState(null);

    useEffect(() => {
        setTemplateId(event?.settings?.invitation_setup?.templateId || event?.template_id || '');
    }, [event?.id, event?.template_id, event?.settings?.invitation_setup?.templateId]);

    useEffect(() => {
        async function fetchReferences() {
            if (!event?.id) {
                return;
            }

            setLoading(true);
            setError('');
            try {
                const [templatesResponse, addonsResponse] = await Promise.all([
                    api.get('/admin/templates?pageSize=200'),
                    api.get(`/admin/events/${event.id}/addons-summary`)
                ]);
                setTemplates(templatesResponse.data?.data || []);
                setAddonsSummary(addonsResponse.data?.data || null);
            } catch (fetchError) {
                console.error('Failed to load invitation setup references:', fetchError);
                setError(fetchError.response?.data?.message || t('events.invitationSetup.loadFailed'));
            } finally {
                setLoading(false);
            }
        }

        fetchReferences();
    }, [event?.id, t]);

    const setupStatus = useMemo(() => {
        const tabs = addonsSummary?.invitationTabs || [];
        return [
            {
                label: t('events.invitationSetup.checklist.template'),
                done: Boolean(templateId)
            },
            {
                label: 'Add-ons configured',
                done: Array.isArray(addonsSummary?.addInsEnabled) && addonsSummary.addInsEnabled.length > 0
            },
            {
                label: 'Card tabs linked',
                done: tabs.length > 0
            }
        ];
    }, [addonsSummary, t, templateId]);

    async function saveInvitationSetup() {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.patch(`/admin/events/${event.id}/invitation-setup`, {
                templateId: templateId || null
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
                        {templateId
                            ? t('events.invitationSetup.templateSelected')
                            : t('events.invitationSetup.noTemplateSelected')}
                    </span>
                    <span className="summary-chip">
                        {t('events.invitationSetup.selectedTabs', { count: addonsSummary?.invitationTabs?.length || 0 })}
                    </span>
                </div>
            </div>

            <section className="invitation-setup-checklist">
                <div className="section-header">
                    <div>
                        <h3>{t('events.invitationSetup.checklistTitle')}</h3>
                        <p>Status below reflects Add-ons tab configuration in real-time.</p>
                    </div>
                    <CheckCircle2 size={18} />
                </div>
                <div className="setup-checklist-list">
                    {setupStatus.map((item) => (
                        <div key={item.label} className={`setup-checklist-item ${item.done ? 'is-ready' : 'is-pending'}`}>
                            <CheckCircle2 size={16} />
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
                            value={templateId}
                            onChange={(eventParam) => setTemplateId(eventParam.target.value)}
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
                            {templateId
                                ? t('events.invitationSetup.templateSelected')
                                : t('events.invitationSetup.noTemplateSelected')}
                        </span>
                    </div>
                </section>

                <section className="setup-card setup-card--wide">
                    <div className="section-header">
                        <div>
                            <h3>Add-ons Ownership</h3>
                            <p>Add-ons and card tabs are managed in the Event Add-ons tab.</p>
                        </div>
                    </div>
                    <div className="setup-empty-state">
                        <p>
                            Use <strong>Event &gt; Add-ons</strong> to enable add-ons, select polls/questionnaires,
                            and control which tabs appear on the invitation card.
                        </p>
                        <p className="event-addons-empty">Switch to the Add-ons tab above to manage these links.</p>
                    </div>
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
