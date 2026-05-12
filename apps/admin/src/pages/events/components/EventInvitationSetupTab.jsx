import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, LayoutTemplate, Sparkles } from 'lucide-react';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventInvitationSetupTab.css';

function localizedText(i18n, primary, secondary) {
    return i18n.language?.startsWith('ar') ? (secondary || primary || '') : (primary || secondary || '');
}
function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

function createDefaultGate() {
    return {
        enabled: false,
        style: { variant: 'brand', primaryColor: '#946FA7', secondaryColor: '#FF9D00', icon: 'sparkles' },
        behavior: { showReasonOnNo: true, requireReasonOnNo: false },
        copy: {
            en: { attendanceTitle: '', attendanceBody: '', reasonLabel: '', reasonPlaceholder: '', positiveTitle: '', positiveBody: '', positiveButton: '', negativeTitle: '', negativeBody: '', negativeButton: '' },
            ar: { attendanceTitle: '', attendanceBody: '', reasonLabel: '', reasonPlaceholder: '', positiveTitle: '', positiveBody: '', positiveButton: '', negativeTitle: '', negativeBody: '', negativeButton: '' }
        }
    };
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
    const [rsvpGate, setRsvpGate] = useState(createDefaultGate());

    function setGateField(path, value) {
        setRsvpGate((prev) => {
            if (path[0] === 'style') return { ...prev, style: { ...prev.style, [path[1]]: value } };
            if (path[0] === 'behavior') {
                const nextBehavior = { ...prev.behavior, [path[1]]: value };
                if (path[1] === 'showReasonOnNo' && value === false) nextBehavior.requireReasonOnNo = false;
                return { ...prev, behavior: nextBehavior };
            }
            if (path[0] === 'copy') return { ...prev, copy: { ...prev.copy, [path[1]]: { ...prev.copy[path[1]], [path[2]]: value } } };
            return prev;
        });
    }

    useEffect(() => {
        setTemplateId(event?.settings?.invitation_setup?.templateId || event?.template_id || '');
        const existing = event?.settings?.rsvp_gate || {};
        const base = createDefaultGate();
        setRsvpGate({
            ...base,
            ...existing,
            style: { ...base.style, ...(existing.style || {}) },
            behavior: { ...base.behavior, ...(existing.behavior || {}) },
            copy: {
                en: { ...base.copy.en, ...(existing.copy?.en || {}) },
                ar: { ...base.copy.ar, ...(existing.copy?.ar || {}) }
            }
        });
    }, [event?.id, event?.template_id, event?.settings?.invitation_setup?.templateId]);

    useEffect(() => {
        async function fetchReferences() {
            if (!event?.id) return;
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
            { label: t('events.invitationSetup.checklist.template'), done: Boolean(templateId) },
            { label: localize(i18n, 'Add-ons configured', 'تم إعداد الإضافات'), done: Array.isArray(addonsSummary?.addInsEnabled) && addonsSummary.addInsEnabled.length > 0 },
            { label: localize(i18n, 'Card tabs linked', 'تم ربط تبويبات البطاقة'), done: tabs.length > 0 },
            { label: localize(i18n, 'RSVP gate configured', 'تم إعداد نافذة الرد'), done: Boolean(rsvpGate.enabled) }
        ];
    }, [addonsSummary, i18n, rsvpGate.enabled, t, templateId]);

    async function saveInvitationSetup() {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await api.patch(`/admin/events/${event.id}/invitation-setup`, { templateId: templateId || null, rsvpGate });
            setSuccess(t('events.invitationSetup.saved'));
            await onUpdated?.();
        } catch (saveError) {
            console.error('Failed to save invitation setup:', saveError);
            setError(saveError.response?.data?.message || t('events.invitationSetup.saveFailed'));
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="invitation-setup-loading">{t('common.loading')}</div>;

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
                    <span className="summary-chip summary-chip-soft">{templateId ? t('events.invitationSetup.templateSelected') : t('events.invitationSetup.noTemplateSelected')}</span>
                    <span className="summary-chip">{t('events.invitationSetup.selectedTabs', { count: addonsSummary?.invitationTabs?.length || 0 })}</span>
                </div>
            </div>

            <section className="invitation-setup-checklist">
                <div className="section-header"><div><h3>{t('events.invitationSetup.checklistTitle')}</h3><p>{localize(i18n, 'Status below reflects Add-ons tab configuration in real-time.', 'تعكس الحالة أدناه إعدادات تبويب الإضافات بشكل مباشر.')}</p></div><CheckCircle2 size={18} /></div>
                <div className="setup-checklist-list">
                    {setupStatus.map((item) => <div key={item.label} className={`setup-checklist-item ${item.done ? 'is-ready' : 'is-pending'}`}><CheckCircle2 size={16} /><span>{item.label}</span><strong>{item.done ? t('settings.ready') : t('common.pending')}</strong></div>)}
                </div>
            </section>

            <div className="invitation-setup-grid">
                <section className="setup-card">
                    <div className="section-header"><div><h3>{t('events.invitationSetup.templateTitle')}</h3><p>{t('events.invitationSetup.templateHelp')}</p></div><LayoutTemplate size={18} /></div>
                    <div className="form-group">
                        <label htmlFor="setupTemplateId">{t('events.invitationSetup.template')}</label>
                        <select id="setupTemplateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                            <option value="">{t('events.dashboardTemplateNotAssigned')}</option>
                            {templates.map((template) => <option key={template.id} value={template.id}>{localizedText(i18n, template.name, template.name_ar)}</option>)}
                        </select>
                    </div>
                    <div className="selected-template-note"><Sparkles size={16} /><span>{templateId ? t('events.invitationSetup.templateSelected') : t('events.invitationSetup.noTemplateSelected')}</span></div>
                </section>

                <section className="setup-card setup-card--wide">
                    <div className="section-header"><div><h3>{localize(i18n, 'Add-ons Ownership', 'إدارة الإضافات')}</h3><p>{localize(i18n, 'Add-ons and card tabs are managed in the Event Add-ons tab.', 'تتم إدارة الإضافات وتبويبات البطاقة من تبويب إضافات الفعالية.')}</p></div></div>
                    <div className="setup-empty-state"><p>{localize(i18n, 'Use Event > Add-ons to enable add-ons, select polls/questionnaires, and control which tabs appear on the invitation card.', 'استخدم الفعالية > الإضافات لتفعيل الإضافات واختيار الاستطلاعات/الاستبيانات والتحكم بالتبويبات التي تظهر في بطاقة الدعوة.')}</p><p className="event-addons-empty">{localize(i18n, 'Switch to the Add-ons tab above to manage these links.', 'انتقل إلى تبويب الإضافات أعلاه لإدارة هذه الروابط.')}</p></div>
                </section>

                <section className="setup-card setup-card--wide">
                    <div className="section-header"><div><h3>{localize(i18n, 'RSVP Gate', 'نافذة الرد')}</h3><p>{localize(i18n, 'Configure content and appearance of the first-open RSVP popup.', 'اضبط محتوى ومظهر نافذة الرد عند الفتح الأول.')}</p></div></div>
                    <label className="addon-toggle-item"><input type="checkbox" checked={Boolean(rsvpGate.enabled)} onChange={(e) => setRsvpGate((prev) => ({ ...prev, enabled: e.target.checked }))} /><span>{localize(i18n, 'Enable RSVP gate popup', 'تفعيل نافذة الرد')}</span></label>

                    <div className="rsvp-gate-grid">
                        <div className="form-group"><label>Variant</label><select value={rsvpGate.style.variant} onChange={(e) => setGateField(['style', 'variant'], e.target.value)}><option value="minimal">Minimal</option><option value="card">Card</option><option value="brand">Brand</option></select></div>
                        <div className="form-group"><label>Icon</label><select value={rsvpGate.style.icon} onChange={(e) => setGateField(['style', 'icon'], e.target.value)}><option value="sparkles">Sparkles</option><option value="check">Check</option><option value="heart">Heart</option></select></div>
                        <div className="form-group"><label>Primary color</label><input type="color" value={rsvpGate.style.primaryColor} onChange={(e) => setGateField(['style', 'primaryColor'], e.target.value)} /></div>
                        <div className="form-group"><label>Secondary color</label><input type="color" value={rsvpGate.style.secondaryColor} onChange={(e) => setGateField(['style', 'secondaryColor'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Attendance title</label><input type="text" value={rsvpGate.copy.en.attendanceTitle} onChange={(e) => setGateField(['copy', 'en', 'attendanceTitle'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Attendance title</label><input type="text" value={rsvpGate.copy.ar.attendanceTitle} onChange={(e) => setGateField(['copy', 'ar', 'attendanceTitle'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Attendance message</label><textarea rows={2} value={rsvpGate.copy.en.attendanceBody} onChange={(e) => setGateField(['copy', 'en', 'attendanceBody'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Attendance message</label><textarea rows={2} value={rsvpGate.copy.ar.attendanceBody} onChange={(e) => setGateField(['copy', 'ar', 'attendanceBody'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Reason label</label><input type="text" value={rsvpGate.copy.en.reasonLabel} onChange={(e) => setGateField(['copy', 'en', 'reasonLabel'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Reason label</label><input type="text" value={rsvpGate.copy.ar.reasonLabel} onChange={(e) => setGateField(['copy', 'ar', 'reasonLabel'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Reason placeholder</label><input type="text" value={rsvpGate.copy.en.reasonPlaceholder} onChange={(e) => setGateField(['copy', 'en', 'reasonPlaceholder'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Reason placeholder</label><input type="text" value={rsvpGate.copy.ar.reasonPlaceholder} onChange={(e) => setGateField(['copy', 'ar', 'reasonPlaceholder'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Positive title</label><input type="text" value={rsvpGate.copy.en.positiveTitle} onChange={(e) => setGateField(['copy', 'en', 'positiveTitle'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Positive title</label><input type="text" value={rsvpGate.copy.ar.positiveTitle} onChange={(e) => setGateField(['copy', 'ar', 'positiveTitle'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Positive message</label><textarea rows={2} value={rsvpGate.copy.en.positiveBody} onChange={(e) => setGateField(['copy', 'en', 'positiveBody'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Positive message</label><textarea rows={2} value={rsvpGate.copy.ar.positiveBody} onChange={(e) => setGateField(['copy', 'ar', 'positiveBody'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Positive button</label><input type="text" value={rsvpGate.copy.en.positiveButton} onChange={(e) => setGateField(['copy', 'en', 'positiveButton'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Positive button</label><input type="text" value={rsvpGate.copy.ar.positiveButton} onChange={(e) => setGateField(['copy', 'ar', 'positiveButton'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Negative title</label><input type="text" value={rsvpGate.copy.en.negativeTitle} onChange={(e) => setGateField(['copy', 'en', 'negativeTitle'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Negative title</label><input type="text" value={rsvpGate.copy.ar.negativeTitle} onChange={(e) => setGateField(['copy', 'ar', 'negativeTitle'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Negative message</label><textarea rows={2} value={rsvpGate.copy.en.negativeBody} onChange={(e) => setGateField(['copy', 'en', 'negativeBody'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Negative message</label><textarea rows={2} value={rsvpGate.copy.ar.negativeBody} onChange={(e) => setGateField(['copy', 'ar', 'negativeBody'], e.target.value)} /></div>
                        <div className="form-group"><label>EN Negative button</label><input type="text" value={rsvpGate.copy.en.negativeButton} onChange={(e) => setGateField(['copy', 'en', 'negativeButton'], e.target.value)} /></div>
                        <div className="form-group"><label>AR Negative button</label><input type="text" value={rsvpGate.copy.ar.negativeButton} onChange={(e) => setGateField(['copy', 'ar', 'negativeButton'], e.target.value)} /></div>
                    </div>

                    <div className={`rsvp-gate-preview variant-${rsvpGate.style.variant}`} style={{ '--rsvp-primary': rsvpGate.style.primaryColor, '--rsvp-secondary': rsvpGate.style.secondaryColor }}>
                        <strong>{localize(i18n, 'Preview', 'معاينة')}</strong>
                        <p>{rsvpGate.copy.en.attendanceTitle || localize(i18n, 'Will you attend this event?', 'هل ستحضر هذه الفعالية؟')}</p>
                        <small>{rsvpGate.copy.en.attendanceBody || localize(i18n, 'Please confirm your attendance first.', 'يرجى تأكيد حضورك أولًا.')}</small>
                        <div className="rsvp-gate-preview-actions"><button type="button">{rsvpGate.copy.en.positiveButton || localize(i18n, 'Open invitation', 'فتح الدعوة')}</button><button type="button">{rsvpGate.copy.en.negativeButton || localize(i18n, 'OK', 'حسنًا')}</button></div>
                    </div>

                    <div className="addon-toggle-row">
                        <label className="addon-toggle-item"><input type="checkbox" checked={Boolean(rsvpGate.behavior.showReasonOnNo)} onChange={(e) => setGateField(['behavior', 'showReasonOnNo'], e.target.checked)} /><span>{localize(i18n, 'Ask reason when guest selects No', 'اطلب سببًا عند اختيار لا')}</span></label>
                        <label className="addon-toggle-item"><input type="checkbox" checked={Boolean(rsvpGate.behavior.requireReasonOnNo)} disabled={!rsvpGate.behavior.showReasonOnNo} onChange={(e) => setGateField(['behavior', 'requireReasonOnNo'], e.target.checked)} /><span>{localize(i18n, 'Require reason on No', 'اجعل السبب إلزاميًا عند اختيار لا')}</span></label>
                    </div>
                </section>
            </div>

            <div className="setup-actions">
                <RoleGuard permission="events.edit">
                    <button type="button" className="btn btn-primary" onClick={saveInvitationSetup} disabled={saving}>{saving ? t('common.loading') : t('events.invitationSetup.save')}</button>
                </RoleGuard>
            </div>
        </div>
    );
}
