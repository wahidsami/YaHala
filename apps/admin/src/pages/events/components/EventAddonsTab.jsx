import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers3, MessageSquare, ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import './EventAddonsTab.css';

function localizedText(i18n, enText, arText) {
    return i18n.language?.startsWith('ar') ? (arText || enText || '') : (enText || arText || '');
}

export default function EventAddonsTab({ eventId }) {
    const { t, i18n } = useTranslation();
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
                    tabs.push({ type: 'poll', addonId: pollId, sortOrder: index });
                });
            }
            if (formData.addIns.includes('questionnaire')) {
                formData.questionnaireIds.forEach((questionnaireId, index) => {
                    tabs.push({ type: 'questionnaire', addonId: questionnaireId, sortOrder: formData.pollIds.length + index });
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
                    <div className="event-addon-nav-item">
                        <button
                            type="button"
                            className={`event-addon-nav-btn ${activeAddon === 'poll' ? 'active' : ''}`}
                            onClick={() => setActiveAddon('poll')}
                        >
                            <MessageSquare size={16} />
                            <span>{t('addons.pollTab')}</span>
                        </button>
                        <label className="event-addon-toggle">
                            <input
                                type="checkbox"
                                checked={enabledAddonSet.has('poll')}
                                onChange={(event) => toggleAddon('poll', event.target.checked)}
                            />
                            <span>Enabled</span>
                        </label>
                    </div>
                    <div className="event-addon-nav-item">
                        <button
                            type="button"
                            className={`event-addon-nav-btn ${activeAddon === 'questionnaire' ? 'active' : ''}`}
                            onClick={() => setActiveAddon('questionnaire')}
                        >
                            <ClipboardList size={16} />
                            <span>{t('addons.questionnaireTab')}</span>
                        </button>
                        <label className="event-addon-toggle">
                            <input
                                type="checkbox"
                                checked={enabledAddonSet.has('questionnaire')}
                                onChange={(event) => toggleAddon('questionnaire', event.target.checked)}
                            />
                            <span>Enabled</span>
                        </label>
                    </div>
                    <div className="event-addon-coming-soon">Quiz, Instructions, Files: coming next.</div>
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
                                                {checked && <span className="linked-pill">Linked</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
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
