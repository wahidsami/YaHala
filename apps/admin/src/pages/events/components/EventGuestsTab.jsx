import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, Users } from 'lucide-react';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import './EventGuestsTab.css';

function localizedText(i18n, primary, secondary) {
    return i18n.language?.startsWith('ar') ? (secondary || primary || '') : (primary || secondary || '');
}

export default function EventGuestsTab({ event }) {
    const { t, i18n } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [guests, setGuests] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [filters, setFilters] = useState({ search: '', status: 'active' });
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });

    async function loadGuests(nextPage = pagination.page) {
        if (!event?.id) {
            return;
        }
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams();
            params.append('page', String(nextPage));
            params.append('pageSize', String(pagination.pageSize));
            params.append('status', filters.status);
            if (filters.search.trim()) {
                params.append('search', filters.search.trim());
            }

            const response = await api.get(`/admin/events/${event.id}/guest-directory?${params.toString()}`);
            setGuests(response.data?.data || []);
            setPagination(response.data?.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 0 });
            setSelectedIds([]);
        } catch (loadError) {
            console.error('Failed to load event guest directory:', loadError);
            setError(loadError.response?.data?.message || t('events.guests.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadGuests(1);
    }, [event?.id, filters.status]);

    const allSelectableIds = useMemo(
        () => guests.map((guest) => guest.id),
        [guests]
    );

    const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.includes(id));

    function toggleGuest(guestId, checked) {
        setSelectedIds((prev) => {
            if (checked) {
                return [...new Set([...prev, guestId])];
            }
            return prev.filter((id) => id !== guestId);
        });
    }

    function toggleAll(checked) {
        if (checked) {
            setSelectedIds(allSelectableIds);
            return;
        }
        setSelectedIds([]);
    }

    async function assignSelectedGuests() {
        if (!selectedIds.length || !event?.id) {
            return;
        }
        setSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.post(`/admin/events/${event.id}/guest-directory/assign`, {
                guestIds: selectedIds
            });
            const result = response.data?.data;
            const createdCount = result?.created || 0;
            const updatedCount = result?.updated || 0;
            if (createdCount === 0 && updatedCount > 0) {
                setSuccess(`Guests already linked to event: ${updatedCount} refreshed.`);
            } else {
                setSuccess(
                    t('events.guests.assignSuccess', {
                        created: createdCount,
                        updated: updatedCount
                    })
                );
            }
            await loadGuests(pagination.page);
        } catch (assignError) {
            console.error('Failed to assign guests to event:', assignError);
            setError(assignError.response?.data?.message || t('events.guests.assignFailed'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="event-guests-tab">
            <div className="event-guests-header">
                <div>
                    <h3>{t('events.guests.title')}</h3>
                    <p>{t('events.guests.subtitle', { client: localizedText(i18n, event?.client_name, event?.client_name_ar) })}</p>
                </div>
                <div className="event-guests-summary-chip">
                    <Users size={15} />
                    <span>{t('events.guests.total', { total: pagination.total || 0 })}</span>
                </div>
            </div>

            <div className="event-guests-toolbar">
                <div className="event-guests-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder={t('events.guests.searchPlaceholder')}
                        value={filters.search}
                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                loadGuests(1);
                            }
                        }}
                    />
                </div>
                <select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                >
                    <option value="active">{t('clients.guests.statusActive')}</option>
                    <option value="all">{t('clients.guests.allStatuses')}</option>
                    <option value="banned">{t('clients.guests.statusBanned')}</option>
                </select>
                <button type="button" className="btn btn-secondary" onClick={() => loadGuests(1)} disabled={loading}>
                    {t('common.refresh')}
                </button>
            </div>

            {error && <div className="form-error">{error}</div>}
            {success && <div className="status-banner success">{success}</div>}

            <div className="event-guests-table-wrap">
                <table className="event-guests-table">
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => toggleAll(e.target.checked)}
                                    aria-label={t('clients.guests.selectAll')}
                                />
                            </th>
                            <th>{t('clients.guests.name')}</th>
                            <th>{t('clients.guests.organization')}</th>
                            <th>{t('clients.guests.email')}</th>
                            <th>{t('clients.guests.mobileNumber')}</th>
                            <th>{t('events.guests.state')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" className="empty-cell">{t('common.loading')}</td></tr>
                        ) : guests.length === 0 ? (
                            <tr><td colSpan="6" className="empty-cell">{t('clients.guests.noGuests')}</td></tr>
                        ) : (
                            guests.map((guest) => {
                                const isAssigned = Boolean(guest.is_assigned);
                                const checked = selectedIds.includes(guest.id);
                                return (
                                    <tr key={guest.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) => toggleGuest(guest.id, e.target.checked)}
                                            />
                                        </td>
                                        <td>{guest.name}</td>
                                        <td>{guest.organization || '-'}</td>
                                        <td>{guest.email || '-'}</td>
                                        <td>{guest.mobile_number || '-'}</td>
                                        <td>
                                            <span className={`event-guest-state ${isAssigned ? 'assigned' : 'available'}`}>
                                                {isAssigned ? t('events.guests.assigned') : t('events.guests.available')}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="event-guests-footer">
                <span>{t('common.pageOf', { page: pagination.page || 1, totalPages: pagination.totalPages || 1 })}</span>
                <div className="event-guests-footer-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={(pagination.page || 1) <= 1 || loading}
                        onClick={() => loadGuests((pagination.page || 1) - 1)}
                    >
                        {t('common.previous')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={(pagination.page || 1) >= (pagination.totalPages || 1) || loading}
                        onClick={() => loadGuests((pagination.page || 1) + 1)}
                    >
                        {t('common.next')}
                    </button>
                    <RoleGuard permission="events.edit">
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!selectedIds.length || submitting}
                            onClick={assignSelectedGuests}
                        >
                            <UserPlus size={16} />
                            <span>{submitting ? t('common.loading') : t('events.guests.assignSelected', { count: selectedIds.length })}</span>
                        </button>
                    </RoleGuard>
                </div>
            </div>
        </div>
    );
}
