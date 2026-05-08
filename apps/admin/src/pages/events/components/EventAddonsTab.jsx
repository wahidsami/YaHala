import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers3, MessageSquare, ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import './EventAddonsTab.css';

function localizedText(i18n, enText, arText) {
    return i18n.language?.startsWith('ar') ? (arText || enText || '') : (enText || arText || '');
}

const ADDON_CATALOG = [
    { id: 'poll', label: 'Poll', icon: MessageSquare, comingSoon: false },
    { id: 'questionnaire', label: 'Questionnaire', icon: ClipboardList, comingSoon: false },
    { id: 'instructions', label: 'Instructions', icon: Layers3, comingSoon: true },
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

export default function EventAddonsTab({ event }) {
    const { t, i18n } = useTranslation();
    const eventId = event?.id;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [polls, setPolls] = useState([]);
    const [questionnaires, setQuestionnaires] = useState([]);
    const [activeAddon, setActiveAddon] = useState('poll');
    const [formData, setFormData] = useState({
        addIns: [],
        pollIds: [],
        questionnaireIds: []
    });
    const [addonConfigs, setAddonConfigs] = useState({});

    const enabledAddonSet = useMemo(() => new Set(formData.addIns), [formData.addIns]);
    const linkedPolls = useMemo(() => {
        const byId = new Map(polls.map((item) => [item.id, item]));
        return formData.pollIds.map((id) => byId.get(id)).filter(Boolean);
    }, [formData.pollIds, polls]);
    const linkedQuestionnaires = useMemo(() => {
        const byId = new Map(questionnaires.map((item) => [item.id, item]));
        return formData.questionnaireIds.map((id) => byId.get(id)).filter(Boolean);
    }, [formData.questionnaireIds, questionnaires]);

    async function loadAddons() {
        setLoading(true);
        setError('');
        try {
            const [summaryResponse, pollsResponse, questionnairesResponse] = await Promise.all([
                api.get(`/admin/events/${eventId}/addons-summary`),
                api.get(`/admin/polls?eventId=${eventId}&pageSize=200`),
                api.get(`/admin/questionnaires?eventId=${eventId}&pageSize=200`)
            ]);

            const summary = summaryResponse.data?.data || null;
            const pollList = pollsResponse.data?.data || [];
            const questionnaireList = questionnairesResponse.data?.data || [];
            setPolls(pollList);
            setQuestionnaires(questionnaireList);
            setFormData({
                addIns: Array.isArray(summary?.addInsEnabled) ? summary.addInsEnabled : [],
                pollIds: Array.isArray(summary?.addons?.poll?.polls)
                    ? summary.addons.poll.polls.map((item) => item.id)
                    : [],
                questionnaireIds: Array.isArray(summary?.addons?.questionnaire?.questionnaires)
                    ? summary.addons.questionnaire.questionnaires.map((item) => item.id)
                    : []
            });
            const tabs = Array.isArray(summary?.invitationTabs) ? summary.invitationTabs : [];
            const nextConfigs = {};
            for (const tab of tabs) {
                if (!tab?.type || !tab?.addonId) {
                    continue;
                }
                nextConfigs[`${tab.type}:${tab.addonId}`] = normalizeAddonConfig({
                    activationRules: tab.activationRules,
                    display: tab.display
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
    }, [eventId, t]);

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
                pollIds: addonId === 'poll' && !checked ? [] : prev.pollIds,
                questionnaireIds: addonId === 'questionnaire' && !checked ? [] : prev.questionnaireIds
            };
        });
    }

    function toggleSelection(key, id, checked) {
        setFormData((prev) => {
            const source = new Set(prev[key]);
            if (checked) {
                source.add(id);
            } else {
                source.delete(id);
            }
            return {
                ...prev,
                [key]: Array.from(source)
            };
        });

        const type = key === 'pollIds' ? 'poll' : key === 'questionnaireIds' ? 'questionnaire' : null;
        if (!type) {
            return;
        }
        const configKey = `${type}:${id}`;
        if (checked) {
            setAddonConfigs((prev) => ({
                ...prev,
                [configKey]: prev[configKey] ? normalizeAddonConfig(prev[configKey]) : normalizeAddonConfig()
            }));
            return;
        }
        setAddonConfigs((prev) => {
            if (!prev[configKey]) {
                return prev;
            }
            const next = { ...prev };
            delete next[configKey];
            return next;
        });
    }

    function unlinkItem(type, id) {
        if (type === 'poll') {
            toggleSelection('pollIds', id, false);
            return;
        }
        if (type === 'questionnaire') {
            toggleSelection('questionnaireIds', id, false);
        }
    }

    async function saveAddonsSetup() {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const tabs = [];
            if (formData.addIns.includes('poll')) {
                formData.pollIds.forEach((pollId, index) => {
                    const rules = normalizeAddonConfig(addonConfigs[`poll:${pollId}`]);
                    tabs.push({
                        type: 'poll',
                        addonId: pollId,
                        sortOrder: index,
                        activationRules: rules.activationRules,
                        display: rules.display
                    });
                });
            }
            if (formData.addIns.includes('questionnaire')) {
                formData.questionnaireIds.forEach((questionnaireId, index) => {
                    const rules = normalizeAddonConfig(addonConfigs[`questionnaire:${questionnaireId}`]);
                    tabs.push({
                        type: 'questionnaire',
                        addonId: questionnaireId,
                        sortOrder: formData.pollIds.length + index,
                        activationRules: rules.activationRules,
                        display: rules.display
                    });
                });
            }

            await api.patch(`/admin/events/${eventId}/invitation-setup`, {
                addIns: formData.addIns,
                invitationSetup: { tabs }
            });
            setSuccess('Add-ons saved successfully.');
            await loadAddons();
        } catch (saveError) {
            console.error('Failed to save add-ons setup:', saveError);
            setError(saveError.response?.data?.message || 'Failed to save add-ons.');
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
                    <h5>Activation Rules</h5>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.activationRules.liveAfterQrScanned)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { liveAfterQrScanned: event.target.checked }
                            })}
                        />
                        <span>Live after QR scanned</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.activationRules.liveWhenScannerEnabled)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { liveWhenScannerEnabled: event.target.checked }
                            })}
                        />
                        <span>Live if scanner user enables</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.activationRules.liveOnSchedule)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { liveOnSchedule: event.target.checked }
                            })}
                        />
                        <span>Live by date/time schedule</span>
                    </label>
                    {cfg.activationRules.liveOnSchedule && (
                        <div className="addon-schedule-grid">
                            <label>
                                <span>Start</span>
                                <input
                                    type="datetime-local"
                                    value={cfg.activationRules.scheduleStartAt || ''}
                                    onChange={(event) => updateAddonConfig(type, itemId, {
                                        activationRules: { scheduleStartAt: event.target.value }
                                    })}
                                />
                            </label>
                            <label>
                                <span>End</span>
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
                        <span>Unlock logic</span>
                        <select
                            value={cfg.activationRules.unlockLogic}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                activationRules: { unlockLogic: event.target.value === 'all' ? 'all' : 'any' }
                            })}
                        >
                            <option value="any">Any rule can unlock</option>
                            <option value="all">All rules required</option>
                        </select>
                    </label>
                </div>
                <div className="addon-rules-block">
                    <h5>Display & Submission</h5>
                    <label>
                        <span>Display mode</span>
                        <select
                            value={cfg.display.mode}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { mode: event.target.value === 'icons' ? 'icons' : 'tabs' }
                            })}
                        >
                            <option value="tabs">Tabs</option>
                            <option value="icons">Icons</option>
                        </select>
                    </label>
                    <label>
                        <span>Position</span>
                        <select
                            value={cfg.display.position}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { position: event.target.value }
                            })}
                        >
                            <option value="top">Top</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                            <option value="bottom">Bottom</option>
                            <option value="qr_slot">QR Slot</option>
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
                        <span>Show add-on in QR place</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.showBackButton)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { showBackButton: event.target.checked }
                            })}
                        />
                        <span>Show back button to card</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.autoReturnAfterSubmit)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { autoReturnAfterSubmit: event.target.checked }
                            })}
                        />
                        <span>Auto return after submit</span>
                    </label>
                    <label className="addon-rule-check">
                        <input
                            type="checkbox"
                            checked={Boolean(cfg.display.disableAfterSubmission)}
                            onChange={(event) => updateAddonConfig(type, itemId, {
                                display: { disableAfterSubmission: event.target.checked }
                            })}
                        />
                        <span>Disable after guest submits</span>
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
                <p>Enable add-ons on the left, then select linked content on the right.</p>
            </div>

            <div className="event-addons-workspace">
                <aside className="event-addons-sidebar">
                    <h4>Add-on List</h4>
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
                                    {addon.comingSoon && <small className="addon-soon-badge">Soon</small>}
                                </button>
                                <label className="event-addon-toggle">
                                    <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(eventParam) => toggleAddon(addon.id, eventParam.target.checked)}
                                    />
                                    <span>Enabled</span>
                                </label>
                            </div>
                        );
                    })}
                </aside>

                <section className="event-addons-panel">
                    {activeAddon === 'poll' && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>Poll tabs linked to invitation card</h4>
                                <Link to="/addons/polls/new" className="btn btn-secondary">Create Poll</Link>
                            </div>
                            {!enabledAddonSet.has('poll') ? (
                                <p className="event-addons-empty">Enable Poll addon from the left menu first.</p>
                            ) : polls.length === 0 ? (
                                <p className="event-addons-empty">{t('events.invitationSetup.noPolls')}</p>
                            ) : (
                                <div className="event-addons-polls">
                                    {polls.map((poll) => {
                                        const checked = formData.pollIds.includes(poll.id);
                                        return (
                                            <label key={poll.id} className={`event-addon-poll-item selectable ${checked ? 'selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => toggleSelection('pollIds', poll.id, event.target.checked)}
                                                />
                                                <div>
                                                    <strong>{localizedText(i18n, poll.title, poll.title_ar)}</strong>
                                                    <small>{t(`addons.polls.status.${poll.status}`) || poll.status}</small>
                                                </div>
                                                {checked && <span className="linked-pill">Linked</span>}
                                                <Link to={`/addons/polls/${poll.id}`} className="btn btn-secondary">
                                                    {t('events.addons.openPoll')}
                                                </Link>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {activeAddon === 'questionnaire' && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>Questionnaire tabs linked to invitation card</h4>
                                <Link to={`/addons/questionnaires/new?eventId=${eventId}&clientId=${event?.client_id || ''}`} className="btn btn-secondary">
                                    Create Questionnaire
                                </Link>
                            </div>
                            {!enabledAddonSet.has('questionnaire') ? (
                                <p className="event-addons-empty">Enable Questionnaire addon from the left menu first.</p>
                            ) : questionnaires.length === 0 ? (
                                <p className="event-addons-empty">No questionnaires found for this event.</p>
                            ) : (
                                <div className="event-addons-polls">
                                    {questionnaires.map((questionnaire) => {
                                        const checked = formData.questionnaireIds.includes(questionnaire.id);
                                        return (
                                            <label key={questionnaire.id} className={`event-addon-poll-item selectable ${checked ? 'selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => toggleSelection('questionnaireIds', questionnaire.id, event.target.checked)}
                                                />
                                                <div>
                                                    <strong>{localizedText(i18n, questionnaire.title, questionnaire.title_ar)}</strong>
                                                    <small>{questionnaire.status} · {questionnaire.question_count || 0} questions · {questionnaire.submission_count || 0} submissions</small>
                                                </div>
                                                <Link to={`/addons/questionnaires/${questionnaire.id}`} className="btn btn-secondary">Open</Link>
                                                {checked && <span className="linked-pill">Linked</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {!['poll', 'questionnaire'].includes(activeAddon) && (
                        <>
                            <div className="event-addons-card-header">
                                <h4>{ADDON_CATALOG.find((item) => item.id === activeAddon)?.label || 'Addon'} setup</h4>
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
                    {saving ? t('common.loading') : 'Save Add-ons Setup'}
                </button>
                <span className="event-addons-meta">
                    Enabled: {formData.addIns.length} · Linked tabs: {formData.pollIds.length + formData.questionnaireIds.length}
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
                        <h4>Card Tabs Preview</h4>
                        <MessageSquare size={16} />
                    </div>
                    {(formData.pollIds.length + formData.questionnaireIds.length) > 0 ? (
                        <div className="linked-preview-list">
                            {linkedPolls.map((poll, index) => (
                                <div key={`poll-${poll.id}`} className="linked-preview-item">
                                    <span className="linked-order">{index + 1}</span>
                                    <div>
                                        <strong>Poll</strong>
                                        <small>{localizedText(i18n, poll.title, poll.title_ar)}</small>
                                        {renderAddonRulesEditor('poll', poll.id)}
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={() => unlinkItem('poll', poll.id)}>Unlink</button>
                                </div>
                            ))}
                            {linkedQuestionnaires.map((questionnaire, index) => (
                                <div key={`questionnaire-${questionnaire.id}`} className="linked-preview-item">
                                    <span className="linked-order">{linkedPolls.length + index + 1}</span>
                                    <div>
                                        <strong>Questionnaire</strong>
                                        <small>{localizedText(i18n, questionnaire.title, questionnaire.title_ar)}</small>
                                        {renderAddonRulesEditor('questionnaire', questionnaire.id)}
                                    </div>
                                    <button type="button" className="btn btn-secondary" onClick={() => unlinkItem('questionnaire', questionnaire.id)}>Unlink</button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="event-addons-empty">No card tabs linked yet.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
