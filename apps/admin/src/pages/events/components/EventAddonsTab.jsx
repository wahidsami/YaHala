import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers3, MessageSquare } from 'lucide-react';
import api from '../../../services/api';
import './EventAddonsTab.css';

function localizedText(i18n, enText, arText) {
    return i18n.language?.startsWith('ar') ? (arText || enText || '') : (enText || arText || '');
}

export default function EventAddonsTab({ eventId }) {
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [addons, setAddons] = useState(null);

    useEffect(() => {
        async function loadAddons() {
            setLoading(true);
            setError('');
            try {
                const response = await api.get(`/admin/events/${eventId}/addons-summary`);
                setAddons(response.data?.data || null);
            } catch (loadError) {
                console.error('Failed to load event addons summary:', loadError);
                setError(loadError.response?.data?.message || t('events.addons.loadFailed'));
            } finally {
                setLoading(false);
            }
        }

        if (eventId) {
            loadAddons();
        }
    }, [eventId, t]);

    if (loading) {
        return <div className="event-addons-loading">{t('common.loading')}</div>;
    }

    return (
        <div className="event-addons-tab">
            {error && <div className="form-error">{error}</div>}
            <div className="event-addons-header">
                <h3>{t('events.addons.title')}</h3>
                <p>{t('events.addons.subtitle')}</p>
            </div>

            <div className="event-addons-grid">
                <section className="event-addons-card">
                    <div className="event-addons-card-header">
                        <h4>{t('events.addons.enabled')}</h4>
                        <Layers3 size={16} />
                    </div>
                    {addons?.addInsEnabled?.length ? (
                        <div className="addon-chips">
                            {addons.addInsEnabled.map((addonId) => (
                                <span key={addonId} className="addon-chip">{addonId}</span>
                            ))}
                        </div>
                    ) : (
                        <p className="event-addons-empty">{t('events.addons.noneEnabled')}</p>
                    )}
                </section>

                <section className="event-addons-card">
                    <div className="event-addons-card-header">
                        <h4>{t('events.addons.pollTabs')}</h4>
                        <MessageSquare size={16} />
                    </div>
                    {addons?.addons?.poll?.polls?.length ? (
                        <div className="event-addons-polls">
                            {addons.addons.poll.polls.map((poll) => (
                                <div key={poll.id} className="event-addon-poll-item">
                                    <div>
                                        <strong>{localizedText(i18n, poll.title, poll.title_ar)}</strong>
                                        <small>{t(`addons.polls.status.${poll.status}`) || poll.status}</small>
                                    </div>
                                    <Link to={`/addons/polls/${poll.id}`} className="btn btn-secondary">
                                        {t('events.addons.openPoll')}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="event-addons-empty">{t('events.addons.noPollTabs')}</p>
                    )}
                </section>

                <section className="event-addons-card">
                    <div className="event-addons-card-header">
                        <h4>{t('addons.questionnaireTab')}</h4>
                        <MessageSquare size={16} />
                    </div>
                    {addons?.addons?.questionnaire?.questionnaires?.length ? (
                        <div className="event-addons-polls">
                            {addons.addons.questionnaire.questionnaires.map((questionnaire) => (
                                <div key={questionnaire.id} className="event-addon-poll-item">
                                    <div>
                                        <strong>{localizedText(i18n, questionnaire.title, questionnaire.title_ar)}</strong>
                                        <small>{questionnaire.status} · {questionnaire.question_count || 0} questions · {questionnaire.submission_count || 0} submissions</small>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="event-addons-empty">{t('events.addons.noQuestionnaireTabs')}</p>
                    )}
                </section>
            </div>
        </div>
    );
}
