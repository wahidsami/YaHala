import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Mic, MessageSquare, Filter } from 'lucide-react';
import api from '../../../services/api';
import './SubmissionsViewer.css';

export default function SubmissionsViewer({ eventId }) {
    const { t } = useTranslation();
    const [submissions, setSubmissions] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ type: 'all', status: 'all' });
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        fetchSubmissions();
        fetchStats();
    }, [eventId, filters]);

    async function fetchSubmissions() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                ...(filters.type !== 'all' && { type: filters.type }),
                ...(filters.status !== 'all' && { status: filters.status })
            });
            const response = await api.get(`/admin/events/${eventId}/submissions?${params}`);
            setSubmissions(response.data.data);
        } catch (error) {
            console.error('Failed to fetch submissions:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchStats() {
        try {
            const response = await api.get(`/admin/events/${eventId}/submissions/stats`);
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    async function handleApprove(id) {
        try {
            await api.put(`/admin/events/submissions/${id}/approve`);
            fetchSubmissions();
            fetchStats();
        } catch (error) {
            console.error('Approve failed:', error);
        }
    }

    async function handleHide(id) {
        try {
            await api.put(`/admin/events/submissions/${id}/hide`);
            fetchSubmissions();
            fetchStats();
        } catch (error) {
            console.error('Hide failed:', error);
        }
    }

    async function handleBulkApprove() {
        if (!selectedIds.length) return;
        try {
            await api.post('/admin/events/submissions/bulk-approve', { ids: selectedIds });
            setSelectedIds([]);
            fetchSubmissions();
            fetchStats();
        } catch (error) {
            console.error('Bulk approve failed:', error);
        }
    }

    function toggleSelect(id) {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }

    function toggleSelectAll() {
        if (selectedIds.length === submissions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(submissions.map(s => s.id));
        }
    }

    return (
        <div className="submissions-viewer">
            <div className="viewer-header">
                <h3>{t('events.submissionsTitle')}</h3>
                {stats && (
                    <div className="stats-row">
                        <span className="stat"><Mic size={14} /> {stats.voice_count} {t('events.submissionsVoice')}</span>
                        <span className="stat"><MessageSquare size={14} /> {stats.text_count} {t('events.submissionsText')}</span>
                        <span className="stat approved">{stats.approved_count} {t('events.submissionsApproved')}</span>
                        <span className="stat pending">{stats.pending_count} {t('events.submissionsPending')}</span>
                    </div>
                )}
            </div>

            <div className="filters-row">
                <select value={filters.type} onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}>
                    <option value="all">{t('events.submissionsFiltersType')}</option>
                    <option value="voice">{t('events.submissionsFilterVoice')}</option>
                    <option value="text">{t('events.submissionsFilterText')}</option>
                </select>
                <select value={filters.status} onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}>
                    <option value="all">{t('events.submissionsFiltersStatus')}</option>
                    <option value="pending">{t('events.submissionsFilterPending')}</option>
                    <option value="approved">{t('events.submissionsFilterApproved')}</option>
                    <option value="hidden">{t('events.submissionsFilterHidden')}</option>
                </select>
                {selectedIds.length > 0 && (
                    <button className="btn btn-success" onClick={handleBulkApprove}>
                        <Check size={16} />
                        {t('events.submissionsApproveSelected', { count: selectedIds.length })}
                    </button>
                )}
            </div>

            <div className="submissions-list">
                {loading ? (
                    <p className="loading">{t('common.loading')}</p>
                ) : submissions.length === 0 ? (
                    <p className="empty">{t('events.submissionsNoSubmissions')}</p>
                ) : (
                    <>
                        <div className="list-header">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.length === submissions.length && submissions.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </label>
                            <span>{t('events.submissionsType')}</span>
                            <span>{t('events.submissionsGuest')}</span>
                            <span>{t('events.submissionsContent')}</span>
                            <span>{t('events.submissionsStatus')}</span>
                            <span>{t('events.submissionsActions')}</span>
                        </div>
                        {submissions.map(submission => (
                            <div key={submission.id} className={`submission-row ${submission.status}`}>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(submission.id)}
                                        onChange={() => toggleSelect(submission.id)}
                                    />
                                </label>
                                <div className="type-cell">
                                    {submission.submission_type === 'voice' ? <Mic size={18} /> : <MessageSquare size={18} />}
                                </div>
                                <div className="guest-cell">
                                    <span>{submission.guest_name_ar || submission.guest_name || t('events.submissionsAnonymous')}</span>
                                    {submission.guest_group && <span className="group-badge">{submission.guest_group}</span>}
                                </div>
                                <div className="content-cell">
                                    {submission.submission_type === 'voice' ? (
                                        <audio controls src={submission.file_url} />
                                    ) : (
                                        <p className="text-content">{submission.content}</p>
                                    )}
                                </div>
                                <div className="status-cell">
                                    <span className={`status-badge ${submission.status}`}>
                                        {submission.status === 'approved'
                                            ? t('events.submissionsFilterApproved')
                                            : submission.status === 'pending'
                                                ? t('events.submissionsFilterPending')
                                                : submission.status === 'hidden'
                                                    ? t('events.submissionsFilterHidden')
                                                    : submission.status}
                                    </span>
                                </div>
                                <div className="actions-cell">
                                    {submission.status !== 'approved' && (
                                        <button className="action-btn approve" onClick={() => handleApprove(submission.id)} title={t('events.submissionsApprove')}>
                                            <Check size={16} />
                                        </button>
                                    )}
                                    {submission.status !== 'hidden' && (
                                        <button className="action-btn hide" onClick={() => handleHide(submission.id)} title={t('events.submissionsHide')}>
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
