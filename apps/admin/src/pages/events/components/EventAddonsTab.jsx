import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers3, MessageSquare, ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import './EventAddonsTab.css';

function localizedText(i18n, enText, arText) {
    return i18n.language?.startsWith('ar') ? (arText || enText || '') : (enText || arText || '');
}
function localize(i18n, english, arabic) {
    return i18n.language?.startsWith('ar') ? arabic : english;
}

const ADDON_CATALOG = [
    { id: 'poll', label: 'Poll', icon: MessageSquare, comingSoon: false },
    { id: 'questionnaire', label: 'Questionnaire', icon: ClipboardList, comingSoon: false },
    { id: 'instructions', label: 'Instructions', icon: Layers3, comingSoon: false },
    { id: 'quiz', label: 'Quiz', icon: Layers3, comingSoon: true },
    { id: 'files_downloads', label: 'Files & Downloads', icon: Layers3, comingSoon: true },
    { id: 'guest_book', label: 'Guest Book', icon: Layers3, comingSoon: true }
];

const DEFAULT_ACTIVATION_RULES = {
    liveAfterQrScanned: false,
    liveWhenScannerEnabled: false,
    liveOnSchedule: false,
    scheduleStartAt: '',
    scheduleEndAt: '',
    unlockLogic: 'any'
};

const DEFAULT_DISPLAY_RULES = {
    mode: 'tabs',
    position: 'top',
    replaceQrSlot: false,
    disableAfterSubmission: true,
    showBackButton: true,
    autoReturnAfterSubmit: true
};

function normalizeAddonConfig(config = {}) {
    const activation = config.activationRules || config.activation_rules || {};
    const display = config.display || {};
    return {
        activationRules: {
            ...DEFAULT_ACTIVATION_RULES,
            ...activation,
            unlockLogic: activation.unlockLogic === 'all' ? 'all' : 'any'
        },
        display: {
            ...DEFAULT_DISPLAY_RULES,
            ...display,
            mode: display.mode === 'icons' ? 'icons' : 'tabs',
            position: ['top', 'left', 'right', 'bottom', 'qr_slot'].includes(display.position) ? display.position : 'top'
        }
    };
}

function getSelectedTabId(tabs, type) {
    const match = tabs.find((tab) => tab?.type === type && tab?.addonId);
    return match?.addonId || '';
}

export default function EventAddonsTab({ event }) {
    const { t, i18n } = useTranslation();
    const eventId = event?.id;
    const clientId = event?.client_id;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [polls, setPolls] = useState([]);
    const [questionnaires, setQuestionnaires] = useState([]);
    const [instructions, setInstructions] = useState([]);
    const [activeAddon, setActiveAddon] = useState('poll');
    const [formData, setFormData] = useState({
        addIns: [],
        pollId: '',
        questionnaireId: '',
        instructionId: ''
    });
    const [addonConfigs, setAddonConfigs] = useState({});

    const enabledAddonSet = useMemo(() => new Set(formData.addIns), [formData.addIns]);
    const linkedPoll = useMemo(() => polls.find((item) => item.id === formData.pollId) || null, [polls, formData.pollId]);
    const linkedQuestionnaire = useMemo(
        () => questionnaires.find((item) => item.id === formData.questionnaireId) || null,
        [questionnaires, formData.questionnaireId]
    );
    const linkedInstruction = useMemo(
        () => instructions.find((item) => item.id === formData.instructionId) || null,
        [instructions, formData.instructionId]
    );

    async function loadAddons() {
        setLoading(true);
        setError('');
        try {
            const query = new URLSearchParams();
            query.set('pageSize', '200');
            if (clientId) {
                query.set('clientId', clientId);
            }
            const [summaryResponse, pollsResponse, questionnairesResponse, instructionsResponse] = await Promise.all([
                api.get(`/admin/events/${eventId}/addons-summary`),
                api.get(`/admin/polls?${query.toString()}${eventId ? `&eventId=${eventId}` : ''}`),
                api.get(`/admin/questionnaires?${query.toString()}${eventId ? `&eventId=${eventId}` : ''}`),
                api.get(`/admin/instructions?${query.toString()}`)
            ]);

            const summary = summaryResponse.data?.data || null;
            const pollList = pollsResponse.data?.data || [];
            const questionnaireList = questionnairesResponse.data?.data || [];
            const instructionList = instructionsResponse.data?.data || [];
            setPolls(pollList);
            setQuestionnaires(questionnaireList);
            setInstructions(Array.isArray(instructionList) ? instructionList : []);
            const tabs = Array.isArray(summary?.invitationTabs) ? summary.invitationTabs : [];
            setFormData({
                addIns: Array.isArray(summary?.addInsEnabled) ? summary.addInsEnabled : [],
                pollId: getSelectedTabId(tabs, 'poll'),
                questionnaireId: getSelectedTabId(tabs, 'questionnaire'),
                instructionId: getSelectedTabId(tabs, 'instructions')
            });
            const nextConfigs = {};
            for (const tab of tabs) {
                if (!tab?.type || !tab?.addonId) {
                    continue;
                }
                nextConfigs[`${tab.type}:${tab.addonId}`] = normalizeAddonConfig({
                    activationRules: tab.activationRules,
                    display: tab.display,
                    instructions: tab.instructions
                });
            }
            setAddonConfigs(nextConfigs);
        } catch (loadError) {
            console.error('Failed to load event addons summary:', loadError);
            setError(loadError.response?.data?.message || t('events.addons.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (eventId) {
            loadAddons();
        }
    }, [eventId, clientId, t]);

    if (loading) {
        return <div className="event-addons-loading">{t('common.loading')}</div>;
    }

    function toggleAddon(addonId, checked) {
        setFormData((prev) => {
            const nextAddIns = checked
                ? Array.from(new Set([...prev.addIns, addonId]))
                : prev.addIns.filter((id) => id !== addonId);
            return {
                ...prev,
                addIns: nextAddIns,
                pollId: addonId === 'poll' && !checked ? '' : prev.pollId,
                questionnaireId: addonId === 'questionnaire' && !checked ? '' : prev.questionnaireId,
                instructionId: addonId === 'instructions' && !checked ? '' : prev.instructionId
            };
        });
    }

    function selectAddon(type, addonId) {
        const key = type === 'poll' ? 'pollId' : type === 'questionnaire' ? 'questionnaireId' : 'instructionId';
        setFormData((prev) => ({ ...prev, [key]: addonId || '' }));
        if (!addonId) {
            return;
        }
        const configKey = `${type}:${addonId}`;
        setAddonConfigs((prev) => ({
            ...prev,
            [configKey]: prev[configKey] ? normalizeAddonConfig(prev[configKey]) : normalizeAddonConfig()
        }));
    }

    async function saveAddonsSetup() {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const tabs = [];
            if (formData.addIns.includes('poll') && formData.pollId) {
                const rules = normalizeAddonConfig(addonConfigs[`poll:${formData.pollId}`]);
                tabs.push({
                    type: 'poll',
                    addonId: formData.pollId,
                    sortOrder: tabs.length,
                    activationRules: rules.activationRules,
                    display: rules.display
                });
            }
            if (formData.addIns.includes('questionnaire') && formData.questionnaireId) {
                const rules = normalizeAddonConfig(addonConfigs[`questionnaire:${formData.questionnaireId}`]);
                tabs.push({
                    type: 'questionnaire',
                    addonId: formData.questionnaireId,
                    sortOrder: tabs.length,
                    activationRules: rules.activationRules,
                    display: rules.display
                });
            }
            if (formData.addIns.includes('instructions') && formData.instructionId) {
                const rules = normalizeAddonConfig(addonConfigs[`instructions:${formData.instructionId}`]);
                tabs.push({
                    type: 'instructions',
                    addonId: formData.instructionId,
                    title: linkedInstruction?.name || linkedInstruction?.title || localize(i18n, 'Instructions', 'التعليمات'),
                    titleAr: linkedInstruction?.name_ar || linkedInstruction?.title_ar || 'تعليمات',
                    sortOrder: tabs.length,
                    activationRules: rules.activationRules,
                    display: rules.display
                });
            }

            await api.patch(`/admin/events/${eventId}/invitation-setup`, {
                addIns: formData.addIns,
                invitationSetup: { tabs }
            });
            setSuccess(localize(i18n, 'Add-ons saved successfully.', 'تم حفظ إعدادات الإضافات بنجاح.'));
            await loadAddons();
        } catch (saveError) {
            console.error('Failed to save add-ons setup:', saveError);
            setError(saveError.response?.data?.message || localize(i18n, 'Failed to save add-ons.', 'تعذر حفظ إعدادات الإضافات.'));
        } finally {
            setSaving(false);
        }
    }

    function updateAddonConfig(type, id, patch) {
        const key = `${type}:${id}`;
        setAddonConfigs((prev) => {
            const current = normalizeAddonConfig(prev[key]);
            const next = {
                ...current,
                ...patch,
                activationRules: {
                    ...current.activationRules,
                    ...(patch.activationRules || {})
                },
                display: {
                    ...current.display,
                    ...(patch.display || {})
                },
                instructions: {
                    ...(current.instructions || {}),
                    ...(patch.instructions || {})
                }
            };
            return { ...prev, [key]: next };
        });
    }

    function renderAddonRulesEditor(type, itemId) {
        const cfg = normalizeAddonConfig(addonConfigs[`${type}:${itemId}`]);
        return (
            <div className="addon-rules-editor">
                <div className="addon-rules-block">
                    <h5>{localize(i18n, 'Activation Rules', 'قواعد التفعيل')}</h5>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.activationRules.liveAfterQrScanned)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { liveAfterQrScanned: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Live after QR scanned', 'يظهر بعد مسح رمز QR')}</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.activationRules.liveWhenScannerEnabled)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { liveWhenScannerEnabled: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Live if scanner user enables', 'يظهر إذا فعّله مستخدم الماسح')}</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.activationRules.liveOnSchedule)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { liveOnSchedule: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Live by date/time schedule', 'يظهر وفق الجدولة الزمنية')}</span>
                    </label>
                    {cfg.activationRules.liveOnSchedule && (
                        <div className="addon-schedule-grid">
                            <label>
                                <span>{localize(i18n, 'Start', 'البداية')}</span>
                                <input
                                    type="datetime-local"
                                    value={cfg.activationRules.scheduleStartAt || ''}
                                    onChange={(event) => updateAddonConfig(type, itemId, {
                                        activationRules: { scheduleStartAt: event.target.value }
                                    })}
                                />
                            </label>
                            <label>
                                <span>{localize(i18n, 'End', 'النهاية')}</span>
                                <input
                                    type="datetime-local"
                                    value={cfg.activationRules.scheduleEndAt || ''}
                                    onChange={(event) => updateAddonConfig(type, itemId, {
                                        activationRules: { scheduleEndAt: event.target.value }
                                    })}
                                />
                            </label>
                        </div>
                    )}
                    <label>
                        <span>{localize(i18n, 'Unlock logic', 'منطق الإتاحة')}</span>
                        <select
                            value={cfg.activationRules.unlockLogic}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { unlockLogic: event.target.value === 'all' ? 'all' : 'any' }
                            })}
                        >
                            <option value="any">{localize(i18n, 'Any rule can unlock', 'يكفي تحقق أي قاعدة')}</option>
                            <option value="all">{localize(i18n, 'All rules required', 'يجب تحقق جميع القواعد')}</option>
                        </select>
                    </label>
                </div>
                <div className="addon-rules-block">
                    <h5>{localize(i18n, 'Display & Submission', 'العرض والإرسال')}</h5>
                    <label>
                        <span>{localize(i18n, 'Display mode', 'نمط العرض')}</span>
                        <select
                            value={cfg.display.mode}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { mode: event.target.value === 'icons' ? 'icons' : 'tabs' }
                            })}
                        >
                            <option value="tabs">{localize(i18n, 'Tabs', 'تبويبات')}</option>
                            <option value="icons">{localize(i18n, 'Icons', 'أيقونات')}</option>
                        </select>
                    </label>
                    <label>
                        <span>{localize(i18n, 'Position', 'الموضع')}</span>
                        <select
                            value={cfg.display.position}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { position: event.target.value }
                            })}
                        >
                            <option value="top">{localize(i18n, 'Top', 'أعلى')}</option>
                            <option value="left">{localize(i18n, 'Left', 'يسار')}</option>
                            <option value="right">{localize(i18n, 'Right', 'يمين')}</option>
                            <option value="bottom">{localize(i18n, 'Bottom', 'أسفل')}</option>
                            <option value="qr_slot">{localize(i18n, 'QR Slot', 'موضع QR')}</option>
                        </select>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.replaceQrSlot)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { replaceQrSlot: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Show add-on in QR place', 'إظهار الإضافة في موضع QR')}</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.showBackButton)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { showBackButton: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Show back button to card', 'إظهار زر الرجوع للبطاقة')}</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.autoReturnAfterSubmit)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { autoReturnAfterSubmit: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Auto return after submit', 'العودة التلقائية بعد الإرسال')}</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.disableAfterSubmission)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { disableAfterSubmission: event.target.checked }
                            })}
                        />
                        <span>{localize(i18n, 'Disable after guest submits', 'تعطيل بعد إرسال الضيف')}</span>
                    </label>
                </div>
            </div>
        );
    }

    return (
        <div className="event-addons-tab">
            {error && <div className="form-error">{error}</div>}
            {success && <div className="status-banner success">{success}</div>}
            <div className="event-addons-header">
                <h3>{t('events.addons.title')}</h3>
                <p>{localize(i18n, 'Enable each add-on, then choose one linked record of that type for this event.', 'فعّل كل إضافة ثم اختر سجلًا مرتبطًا واحدًا من هذا النوع لهذه الفعالية.')}</p>
            </div>

            <div className="event-addons-workspace">
                <aside className="event-addons-sidebar">
                    <h4>{localize(i18n, 'Add-on List', 'قائمة الإضافات')}</h4>
                    {ADDON_CATALOG.map((addon) => {
                        const Icon = addon.icon;
                        const isActive = activeAddon === addon.id;
                        const isEnabled = enabledAddonSet.has(addon.id);
                        return (
                            <div key={addon.id} className="event-addon-nav-item">
                                <button
                                    type="button"
                                    className={`event-addon-nav-btn ${isActive ? 'active' : ''}`}
                                    onClick={() => setActiveAddon(addon.id)}
                                >
                                    <Icon size={16} />
                                    <span>{addon.label}</span>
                                    {addon.comingSoon && <small className="addon-soon-badge">{localize(i18n, 'Soon', 'قريبًا')}</small>}
                                </button>
                                <label className="event-addon-toggle">
                                    <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(eventParam) => toggleAddon(addon.id, eventParam.target.checked)}
                                    />
                                    <span>{localize(i18n, 'Enabled', 'مفعّلة')}</span>
                                </label>
                            </div>
                        );
                    })}
                </aside>

                <section className="event-addons-panel">
                    {activeAddon === 'poll' && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>{localize(i18n, 'Poll tabs linked to invitation card', 'تبويبات الاستطلاع المرتبطة ببطاقة الدعوة')}</h4>
                                <Link to={`/addons/polls/new${eventId ? `?eventId=${eventId}` : ''}${clientId ? `${eventId ? '&' : '?'}clientId=${clientId}` : ''}`} className="btn btn-secondary">{localize(i18n, 'Create Poll', 'إنشاء استطلاع')}</Link>
                            </div>
                            {!enabledAddonSet.has('poll') ? (
                                <p className="event-addons-empty">{localize(i18n, 'Enable Poll addon from the left menu first.', 'فعّل إضافة الاستطلاع من القائمة اليسرى أولًا.')}</p>
                            ) : polls.length === 0 ? (
                                <p className="event-addons-empty">{t('events.invitationSetup.noPolls')}</p>
                            ) : (
                                <div className="event-addons-polls event-addon-selection-card">
                                    <label>
                                        <span>{localize(i18n, 'Select Poll', 'اختر استطلاعًا')}</span>
                                        <select value={formData.pollId} onChange={(event) => selectAddon('poll', event.target.value)}>
                                            <option value="">{localize(i18n, 'Select poll...', 'اختر استطلاعًا...')}</option>
                                            {polls.map((poll) => (
                                                <option key={poll.id} value={poll.id}>
                                                    {localizedText(i18n, poll.title, poll.title_ar)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {linkedPoll ? (
                                        <div className="event-addon-poll-item">
                                            <div>
                                                <strong>{localizedText(i18n, linkedPoll.title, linkedPoll.title_ar)}</strong>
                                                <small>{t(`addons.polls.status.${linkedPoll.status}`) || linkedPoll.status}</small>
                                            </div>
                                            <Link to={`/addons/polls/${linkedPoll.id}`} className="btn btn-secondary">{t('events.addons.openPoll')}</Link>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}

                    {activeAddon === 'questionnaire' && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>{localize(i18n, 'Questionnaire tabs linked to invitation card', 'تبويبات الاستبيان المرتبطة ببطاقة الدعوة')}</h4>
                                <Link to={`/addons/questionnaires/new?eventId=${eventId}&clientId=${event?.client_id || ''}`} className="btn btn-secondary">
                                    Create Questionnaire
                                </Link>
                            </div>
                            {!enabledAddonSet.has('questionnaire') ? (
                                <p className="event-addons-empty">{localize(i18n, 'Enable Questionnaire addon from the left menu first.', 'فعّل إضافة الاستبيان من القائمة اليسرى أولًا.')}</p>
                            ) : questionnaires.length === 0 ? (
                                <p className="event-addons-empty">{localize(i18n, 'No questionnaires found for this event.', 'لم يتم العثور على استبيانات لهذه الفعالية.')}</p>
                            ) : (
                                <div className="event-addons-polls event-addon-selection-card">
                                    <label>
                                        <span>{localize(i18n, 'Select Questionnaire', 'اختر استبيانًا')}</span>
                                        <select value={formData.questionnaireId} onChange={(event) => selectAddon('questionnaire', event.target.value)}>
                                            <option value="">{localize(i18n, 'Select questionnaire...', 'اختر استبيانًا...')}</option>
                                            {questionnaires.map((questionnaire) => (
                                                <option key={questionnaire.id} value={questionnaire.id}>
                                                    {localizedText(i18n, questionnaire.title, questionnaire.title_ar)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {linkedQuestionnaire ? (
                                        <div className="event-addon-poll-item">
                                            <div>
                                                <strong>{localizedText(i18n, linkedQuestionnaire.title, linkedQuestionnaire.title_ar)}</strong>
                                                <small>{linkedQuestionnaire.status} · {linkedQuestionnaire.question_count || 0} questions · {linkedQuestionnaire.submission_count || 0} submissions</small>
                                            </div>
                                            <Link to={`/addons/questionnaires/${linkedQuestionnaire.id}`} className="btn btn-secondary">{localize(i18n, 'Open', 'فتح')}</Link>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}

                    {activeAddon === 'instructions' && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>{localize(i18n, 'Instructions linked to invitation card', 'التعليمات المرتبطة ببطاقة الدعوة')}</h4>
                                <Link to="/addons/instructions/new" className="btn btn-secondary">{localize(i18n, 'Create Instructions', 'إنشاء تعليمات')}</Link>
                            </div>
                            {!enabledAddonSet.has('instructions') ? (
                                <p className="event-addons-empty">{localize(i18n, 'Enable Instructions addon from the left menu first.', 'فعّل إضافة التعليمات من القائمة اليسرى أولًا.')}</p>
                            ) : instructions.length === 0 ? (
                                <p className="event-addons-empty">{localize(i18n, 'No instructions found for this client.', 'لم يتم العثور على تعليمات لهذا العميل.')}</p>
                            ) : (
                                <div className="event-addons-polls event-addon-selection-card">
                                    <label>
                                        <span>{localize(i18n, 'Select Instructions', 'اختر التعليمات')}</span>
                                        <select value={formData.instructionId} onChange={(event) => selectAddon('instructions', event.target.value)}>
                                            <option value="">{localize(i18n, 'Select instructions...', 'اختر التعليمات...')}</option>
                                            {instructions.map((instruction) => (
                                                <option key={instruction.id} value={instruction.id}>
                                                    {localizedText(i18n, instruction.name || instruction.title, instruction.name_ar || instruction.title_ar)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {linkedInstruction ? (
                                        <div className="event-addon-poll-item">
                                        <div>
                                            <strong>{localizedText(i18n, linkedInstruction.name || linkedInstruction.title, linkedInstruction.name_ar || linkedInstruction.title_ar)}</strong>
                                            <small>{linkedInstruction.status || 'draft'}</small>
                                        </div>
                                        <Link to={`/addons/instructions/${linkedInstruction.id}`} className="btn btn-secondary">{localize(i18n, 'Open', 'فتح')}</Link>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}

                    {!['poll', 'questionnaire', 'instructions'].includes(activeAddon) && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>{(ADDON_CATALOG.find((item) => item.id === activeAddon)?.label || localize(i18n, 'Addon', 'إضافة'))} {localize(i18n, 'setup', 'إعداد')}</h4>
                            </div>
                            <p className="event-addons-empty">
                                This add-on is currently in rollout. You can enable/disable it now, and full content management will be added in next phase.
                            </p>
                        </>
                    )}
                </section>
            </div>

            <div className="event-addons-actions">
                <button type="button" className="btn btn-primary" onClick={saveAddonsSetup} disabled={saving}>
                    {saving ? t('common.loading') : localize(i18n, 'Save Add-ons Setup', 'حفظ إعدادات الإضافات')}
                </button>
                <span className="event-addons-meta">
                    {localize(i18n, `Enabled: ${formData.addIns.length} · Linked tabs: ${[formData.pollId, formData.questionnaireId, formData.instructionId].filter(Boolean).length}`, `المفعّل: ${formData.addIns.length} · التبويبات المرتبطة: ${[formData.pollId, formData.questionnaireId, formData.instructionId].filter(Boolean).length}`)}
                </span>
            </div>

            <div className="event-addons-grid">
                <section className="event-addons-card">
                    <div className="event-addons-card-header">
                        <h4>{t('events.addons.enabled')}</h4>
                        <Layers3 size={16} />
                    </div>
                    {formData.addIns.length ? (
                        <div className="addon-chips">
                            {formData.addIns.map((addonId) => (
                                <span key={addonId} className="addon-chip">{addonId}</span>
                            ))}
                        </div>
                    ) : (
                        <p className="event-addons-empty">{t('events.addons.noneEnabled')}</p>
                    )}
                </section>

                <section className="event-addons-card">
                    <div className="event-addons-card-header">
                        <h4>{localize(i18n, 'Card Tabs Preview', 'معاينة تبويبات البطاقة')}</h4>
                        <MessageSquare size={16} />
                    </div>
                    {(formData.pollId || formData.questionnaireId || formData.instructionId) ? (
                        <div className="linked-preview-list">
                            {linkedPoll ? (
                                <div key={`poll-${linkedPoll.id}`} className="linked-preview-item">
                                    <span className="linked-order">1</span>
                                    <div>
                                        <strong>{localize(i18n, 'Poll', 'استطلاع')}</strong>
                                        <small>{localizedText(i18n, linkedPoll.title, linkedPoll.title_ar)}</small>
                                        {renderAddonRulesEditor('poll', linkedPoll.id)}
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={() => selectAddon('poll', '')}>{localize(i18n, 'Unlink', 'إلغاء الربط')}</button>
                                </div>
                            ) : null}
                            {linkedQuestionnaire ? (
                                <div key={`questionnaire-${linkedQuestionnaire.id}`} className="linked-preview-item">
                                    <span className="linked-order">{linkedPoll ? 2 : 1}</span>
                                    <div>
                                        <strong>{localize(i18n, 'Questionnaire', 'استبيان')}</strong>
                                        <small>{localizedText(i18n, linkedQuestionnaire.title, linkedQuestionnaire.title_ar)}</small>
                                        {renderAddonRulesEditor('questionnaire', linkedQuestionnaire.id)}
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={() => selectAddon('questionnaire', '')}>{localize(i18n, 'Unlink', 'إلغاء الربط')}</button>
                                </div>
                            ) : null}
                            {linkedInstruction ? (
                                <div key={`instructions-${linkedInstruction.id}`} className="linked-preview-item">
                                    <span className="linked-order">
                                        {(linkedPoll ? 1 : 0) + (linkedQuestionnaire ? 1 : 0) + 1}
                                    </span>
                                    <div>
                                        <strong>{localize(i18n, 'Instructions', 'التعليمات')}</strong>
                                        <small>{localizedText(i18n, linkedInstruction.name || linkedInstruction.title, linkedInstruction.name_ar || linkedInstruction.title_ar)}</small>
                                        {renderAddonRulesEditor('instructions', linkedInstruction.id)}
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={() => selectAddon('instructions', '')}>{localize(i18n, 'Unlink', 'إلغاء الربط')}</button>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <p className="event-addons-empty">{localize(i18n, 'No card tabs linked yet.', 'لا توجد تبويبات بطاقة مرتبطة بعد.')}</p>
                    )}
                </section>
            </div>
        </div>
    );
}
