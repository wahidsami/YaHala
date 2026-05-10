import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Users, ClipboardCheck, BarChart3, ListChecks } from 'lucide-react';
import api from '../../../services/api';
import './EventObservationTab.css';

export default function EventObservationTab({ event }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshSec, setRefreshSec] = useState(20);

    useEffect(() => {
        let active = true;
        let timer = null;

        async function loadObservation() {
            try {
                if (!data) {
                    setLoading(true);
                }
                const response = await api.get(`/admin/events/${event.id}/observation`);
                if (!active) return;
                setData(response.data?.data || null);
                setError('');
            } catch (loadError) {
                if (!active) return;
                setError(loadError.response?.data?.message || 'Failed to load observation center data.');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadObservation();
        timer = setInterval(loadObservation, Math.max(5, Number(refreshSec || 20)) * 1000);

        return () => {
            active = false;
            if (timer) clearInterval(timer);
        };
    }, [event.id, refreshSec]);

    const kpis = useMemo(() => {
        const invitation = data?.invitation || {};
        const attendance = data?.attendance || {};
        const walkIns = data?.walkIns || {};
        const questionnaire = data?.questionnaire || {};
        const poll = data?.poll || {};
        const invitedCheckedIn = Number(attendance.invited_checked_in || 0);
        const walkInCheckedIn = Number(walkIns.walk_in_checked_in || 0);
        return {
            invited: Number(invitation.recipients || 0),
            invitedCheckedIn,
            walkInCheckedIn,
            checkedInTotal: invitedCheckedIn + walkInCheckedIn,
            responded: Number(invitation.responded || 0),
            opened: Number(invitation.opened || 0),
            questionnaireSubmissions: Number(questionnaire.submissions_total || 0),
            pollVotes: Number(poll.total_votes || 0)
        };
    }, [data]);

    if (loading) return <div className="event-observation-loading">Loading observation center...</div>;
    if (error) return <div className="event-observation-error">{error}</div>;

    return (
        <div className="event-observation-tab">
            <div className="event-observation-header">
                <div>
                    <h3>Observation Center</h3>
                    <p>Live event operations, attendance, and addon interactions.</p>
                </div>
                <div className="event-observation-actions">
                    <label>
                        Refresh
                        <select value={refreshSec} onChange={(e) => setRefreshSec(Number(e.target.value) || 20)}>
                            <option value={10}>10s</option>
                            <option value={20}>20s</option>
                            <option value={30}>30s</option>
                            <option value={60}>60s</option>
                        </select>
                    </label>
                    <button type="button" className="btn btn-secondary" onClick={async () => {
                        setLoading(true);
                        try {
                            const response = await api.get(`/admin/events/${event.id}/observation`);
                            setData(response.data?.data || null);
                        } finally {
                            setLoading(false);
                        }
                    }}>
                        <RefreshCw size={16} /> Refresh now
                    </button>
                </div>
            </div>

            <div className="event-observation-kpis">
                <div className="obs-kpi"><Users size={16} /><span>Invited</span><strong>{kpis.invited}</strong></div>
                <div className="obs-kpi"><ClipboardCheck size={16} /><span>Checked-in (Total)</span><strong>{kpis.checkedInTotal}</strong></div>
                <div className="obs-kpi"><ClipboardCheck size={16} /><span>Invited Checked-in</span><strong>{kpis.invitedCheckedIn}</strong></div>
                <div className="obs-kpi"><ClipboardCheck size={16} /><span>Walk-ins Checked-in</span><strong>{kpis.walkInCheckedIn}</strong></div>
                <div className="obs-kpi"><Activity size={16} /><span>Opened</span><strong>{kpis.opened}</strong></div>
                <div className="obs-kpi"><ListChecks size={16} /><span>RSVP Responded</span><strong>{kpis.responded}</strong></div>
                <div className="obs-kpi"><BarChart3 size={16} /><span>Questionnaire Submissions</span><strong>{kpis.questionnaireSubmissions}</strong></div>
                <div className="obs-kpi"><BarChart3 size={16} /><span>Poll Votes</span><strong>{kpis.pollVotes}</strong></div>
            </div>

            <div className="event-observation-grid">
                <section className="obs-card">
                    <h4>Addon Runtime</h4>
                    <div className="obs-list">
                        <div><span>Enabled Addons</span><strong>{data?.addons?.enabledCount || 0}</strong></div>
                        <div><span>Linked Tabs</span><strong>{data?.addons?.linkedTabsCount || 0}</strong></div>
                        <div><span>Total Questionnaires</span><strong>{data?.questionnaire?.total_questionnaires || 0}</strong></div>
                        <div><span>Active Questionnaires</span><strong>{data?.questionnaire?.active_questionnaires || 0}</strong></div>
                        <div><span>Total Polls</span><strong>{data?.poll?.total_polls || 0}</strong></div>
                        <div><span>Total Walk-ins</span><strong>{data?.walkIns?.walk_in_total || 0}</strong></div>
                    </div>
                </section>

                <section className="obs-card">
                    <h4>Checked-In Guests</h4>
                    <div className="obs-table-wrap">
                        <table className="obs-table">
                            <thead><tr><th>Name</th><th>Email</th></tr></thead>
                            <tbody>
                                {(data?.checkedInGuests || []).slice(0, 20).map((guest) => (
                                    <tr key={guest.recipient_id}>
                                        <td>{guest.display_name_ar || guest.display_name || 'Guest'}</td>
                                        <td>{guest.email || '—'}</td>
                                    </tr>
                                ))}
                                {(!data?.checkedInGuests || data.checkedInGuests.length === 0) && (
                                    <tr><td colSpan="2">No checked-in guests yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="obs-card">
                    <h4>Walk-in Guests</h4>
                    <div className="obs-table-wrap">
                        <table className="obs-table">
                            <thead><tr><th>Name</th><th>Phone</th></tr></thead>
                            <tbody>
                                {(data?.walkInGuests || []).slice(0, 20).map((guest) => (
                                    <tr key={guest.walk_in_id}>
                                        <td>{guest.display_name || 'Walk-in guest'}</td>
                                        <td>{guest.phone || '—'}</td>
                                    </tr>
                                ))}
                                {(!data?.walkInGuests || data.walkInGuests.length === 0) && (
                                    <tr><td colSpan="2">No walk-ins yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <section className="obs-card obs-card-full">
                <h4>Live Activity Feed</h4>
                <div className="obs-feed">
                    {(data?.recentActivity || []).map((row) => (
                        <div key={row.id} className="obs-feed-item">
                            <strong>{row.display_name_ar || row.display_name || row.email || 'Guest'}</strong>
                            <span>{row.event_name || row.event_type}</span>
                            <time>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</time>
                        </div>
                    ))}
                    {(!data?.recentActivity || data.recentActivity.length === 0) && (
                        <div className="obs-feed-item">No activity recorded yet.</div>
                    )}
                </div>
            </section>
        </div>
    );
}
