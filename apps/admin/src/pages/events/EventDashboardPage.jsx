import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Users, Send, CheckCircle, Clock, Clock3, Mail, MapPin, Image, Link2, Layers3, Activity } from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import EventInvitationSetupTab from './components/EventInvitationSetupTab';
import EventInvitationOpsTab from './components/EventInvitationOpsTab';
import EventAddonsTab from './components/EventAddonsTab';
import EventGuestsTab from './components/EventGuestsTab';
import EventObservationTab from './components/EventObservationTab';
import './EventDashboardPage.css';

function getStorageBaseUrl() {
    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    return baseUrl.replace(/\/api\/?$/, '');
}

function resolveStorageUrl(storagePath) {
    if (!storagePath) {
        return '';
    }

    if (/^https?:\/\//i.test(storagePath)) {
        return storagePath;
    }

    return `${getStorageBaseUrl()}${storagePath}`;
}

export default function EventDashboardPage() {
    const { t, i18n } = useTranslation();
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const isArabic = i18n.language?.startsWith('ar');

    function localizedText(primary, secondary) {
        return isArabic ? (secondary || primary) : (primary || secondary);
    }

    useEffect(() => {
        fetchEvent();
    }, [id]);

    async function fetchEvent() {
        try {
            const [eventResponse, invitationSummaryResponse, attendanceSummaryResponse] = await Promise.all([
                api.get(`/admin/events/${id}`),
                api.get(`/admin/events/${id}/invitation-summary`),
                api.get(`/admin/events/${id}/attendance-summary`)
            ]);

            const eventData = eventResponse.data?.data || null;
            const invitationTotals = invitationSummaryResponse.data?.data?.totals || {};
            const attendanceTotals = attendanceSummaryResponse.data?.data?.totals || {};

            const invitesSent = Number(invitationTotals.sent || 0)
                + Number(invitationTotals.delivered || 0)
                + Number(invitationTotals.opened || 0)
                + Number(invitationTotals.responded || 0);

            const overviewStats = {
                totalGuests: Number(attendanceTotals.invitedTotal || 0) + Number(attendanceTotals.walkInTotal || 0),
                checkedIn: Number(attendanceTotals.checkedInTotal || 0),
                invitesSent,
                pending: Number(attendanceTotals.invitedPending || 0)
            };

            setEvent(eventData);
            setStats(overviewStats);
        } catch (error) {
            console.error('Failed to fetch event:', error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateString) {
        const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';
        return new Date(dateString).toLocaleDateString(locale, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function formatDateTimeLine(startDate, endDate) {
        if (!startDate) {
            return t('common.notFound');
        }

        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;
        const locale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US';

        const datePart = start.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const timePart = start.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (!end) {
            return `${datePart}, ${timePart}`;
        }

        const endTimePart = end.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `${datePart}, ${timePart} - ${endTimePart}`;
    }

    function formatDuration(startDate, endDate) {
        if (!startDate || !endDate) {
            return t('common.notFound');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        if (hours <= 0) {
            return `${minutes}m`;
        }

        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    function formatEventLocation(eventData) {
        const venue = eventData?.venue || '';
        const venueAr = eventData?.venue_ar || '';
        const addressParts = [
            eventData?.address_street,
            eventData?.address_district,
            eventData?.address_city,
            eventData?.address_region,
            eventData?.address_building_number && `Bldg ${eventData.address_building_number}`,
            eventData?.address_additional_number && `Addl ${eventData.address_additional_number}`,
            eventData?.address_unit_number && `Unit ${eventData.address_unit_number}`,
            eventData?.address_postal_code && `P.O. ${eventData.address_postal_code}`
        ].filter(Boolean);

        return {
            venue,
            venueAr,
            address: addressParts.join(', '),
            mapUrl: eventData?.google_map_url || '',
            locationMode: eventData?.location_mode || 'maps'
        };
    }

    const eventLocation = formatEventLocation(event);

    if (loading) return <div className="loading">{t('common.loading')}</div>;
    if (!event) return <div className="error">{t('common.notFound')}</div>;

    return (
        <div className="event-dashboard-page">
            <div className="event-header">
                <Link to="/events" className="back-link">
                    <ArrowLeft size={18} />
                    <span>{t('events.dashboardBackToEvents')}</span>
                </Link>

                <div className="header-content">
                    <div className="header-info">
                        <div className="event-header-row">
                            {event.event_logo_path && (
                                <div className="event-logo-preview">
                                    <img src={resolveStorageUrl(event.event_logo_path)} alt={`${event.name} logo`} />
                                </div>
                            )}

                            <div className="event-title-block">
                                <div className="event-meta">
                                    <span className={`type-badge type-${event.event_type}`}>{t(`events.type.${event.event_type}`)}</span>
                                    <span className={`status-badge status-${event.status}`}>{t(`events.status.${event.status}`)}</span>
                                </div>

                                <div className="event-title-line">
                                    <h1>{localizedText(event.name, event.name_ar)}</h1>
                                    {event.name_ar && event.name && <span className="name-ar">{localizedText(event.name_ar, event.name)}</span>}
                                    <span className="event-date">{formatDate(event.start_datetime)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="header-actions">
                        <RoleGuard permission="events.edit">
                            <Link to={`/events/${id}/edit`} className="btn btn-secondary">
                                <Edit size={18} />
                                <span>{t('events.dashboardEditEvent')}</span>
                            </Link>
                        </RoleGuard>
                    </div>
                </div>
            </div>

            <div className="dashboard-tabs">
                <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                    {t('events.dashboardOverview')}
                </button>
                <button className={activeTab === 'invitation-setup' ? 'active' : ''} onClick={() => setActiveTab('invitation-setup')}>
                    <Layers3 size={16} /> {t('events.dashboardInvitationSetup')}
                </button>
                <button className={activeTab === 'invitation-ops' ? 'active' : ''} onClick={() => setActiveTab('invitation-ops')}>
                    <Mail size={16} /> {t('events.dashboardInvitationOps')}
                </button>
                <button className={activeTab === 'guests' ? 'active' : ''} onClick={() => setActiveTab('guests')}>
                    <Users size={16} /> {t('events.dashboardGuests')}
                </button>
                <button className={activeTab === 'addons' ? 'active' : ''} onClick={() => setActiveTab('addons')}>
                    <Layers3 size={16} /> {t('events.dashboardAddons')}
                </button>
                <button className={activeTab === 'observation' ? 'active' : ''} onClick={() => setActiveTab('observation')}>
                    <Activity size={16} /> Observation Center
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-layout">
                        <div className="kpi-grid">
                            <div className="kpi-card">
                                <div className="kpi-icon">
                                    <Users size={24} />
                                </div>
                                <div className="kpi-content">
                                    <span className="kpi-value">{stats?.totalGuests || 0}</span>
                                    <span className="kpi-label">{t('events.dashboardTotalGuests')}</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-icon success">
                                    <CheckCircle size={24} />
                                </div>
                                <div className="kpi-content">
                                    <span className="kpi-value">{stats?.checkedIn || 0}</span>
                                    <span className="kpi-label">{t('events.dashboardCheckedIn')}</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-icon primary">
                                    <Send size={24} />
                                </div>
                                <div className="kpi-content">
                                    <span className="kpi-value">{stats?.invitesSent || 0}</span>
                                    <span className="kpi-label">{t('events.dashboardInvitesSent')}</span>
                                </div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-icon warning">
                                    <Clock size={24} />
                                </div>
                                <div className="kpi-content">
                                    <span className="kpi-value">{stats?.pending || 0}</span>
                                    <span className="kpi-label">{t('events.dashboardPending')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="overview-grid">
                            <section className="overview-card overview-card--wide">
                                <div className="overview-card-header">
                                    <div>
                                        <p className="overview-eyebrow">{t('events.dashboardOverviewSummary')}</p>
                                        <h3>{t('events.dashboardEventDetails')}</h3>
                                    </div>
                                    <span className={`status-badge status-${event.status}`}>
                                        {t(`events.status.${event.status}`)}
                                    </span>
                                </div>

                                <div className="overview-summary">
                                    <div className="overview-logo-panel">
                                        {event.event_logo_path ? (
                                            <img src={resolveStorageUrl(event.event_logo_path)} alt={`${event.name} logo`} />
                                        ) : (
                                            <div className="overview-logo-placeholder">
                                                <Image size={30} />
                                                <span>{t('events.dashboardNoLogo')}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="overview-summary-copy">
                                        <div className="overview-title-stack">
                                            <h2>{localizedText(event.name, event.name_ar)}</h2>
                                            {event.name_ar && event.name && <p className="name-ar">{localizedText(event.name_ar, event.name)}</p>}
                                        </div>

                                        <div className="overview-chip-row">
                                            <span className="overview-chip">
                                                {t(`events.type.${event.event_type}`)}
                                            </span>
                                            <span className="overview-chip">{localizedText(event.client_name, event.client_name_ar)}</span>
                                            <span className="overview-chip">
                                                {localizedText(event.template_name, event.template_name_ar) || t('events.dashboardTemplateNotAssigned')}
                                            </span>
                                        </div>

                                        <div className="overview-fields-grid">
                                            <div className="overview-field">
                                                <span>{t('events.dashboardClient')}</span>
                                                <strong>{localizedText(event.client_name, event.client_name_ar)}</strong>
                                            </div>
                                            <div className="overview-field">
                                                <span>{t('events.dashboardEventType')}</span>
                                                <strong>{t(`events.type.${event.event_type}`)}</strong>
                                            </div>
                                            <div className="overview-field">
                                                <span>{t('events.dashboardTimezone')}</span>
                                                <strong>{event.timezone || 'Asia/Riyadh'}</strong>
                                            </div>
                                            <div className="overview-field">
                                                <span>{t('events.dashboardTemplate')}</span>
                                                <strong>{localizedText(event.template_name, event.template_name_ar) || event.template_id || t('events.dashboardTemplateNotAssigned')}</strong>
                                            </div>
                                            <div className="overview-field">
                                                <span>{t('events.dashboardStatus')}</span>
                                                <strong>{t(`events.status.${event.status}`)}</strong>
                                            </div>
                                            <div className="overview-field">
                                                <span>{t('events.dashboardArabicName')}</span>
                                                <strong>{event.name_ar || t('common.notFound')}</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="overview-card">
                                <div className="overview-card-header">
                                    <div>
                                        <p className="overview-eyebrow">{t('events.dashboardOverviewSchedule')}</p>
                                        <h3>{t('events.dashboardDateAndTime')}</h3>
                                    </div>
                                    <Clock3 size={18} />
                                </div>

                                <div className="overview-list">
                                    <div className="overview-list-item">
                                        <span>{t('events.dashboardStart')}</span>
                                        <strong>{formatDate(event.start_datetime)}</strong>
                                    </div>
                                    <div className="overview-list-item">
                                        <span>{t('events.dashboardEnd')}</span>
                                        <strong>{event.end_datetime ? formatDate(event.end_datetime) : t('common.notFound')}</strong>
                                    </div>
                                    <div className="overview-list-item">
                                        <span>{t('events.dashboardDuration')}</span>
                                        <strong>{formatDuration(event.start_datetime, event.end_datetime)}</strong>
                                    </div>
                                    <div className="overview-list-item">
                                        <span>{t('events.dashboardTimezone')}</span>
                                        <strong>{event.timezone || 'Asia/Riyadh'}</strong>
                                    </div>
                                </div>
                            </section>

                            <section className="overview-card">
                                <div className="overview-card-header">
                                    <div>
                                        <p className="overview-eyebrow">{t('events.dashboardOverviewLocation')}</p>
                                        <h3>{t('events.dashboardVenue')}</h3>
                                    </div>
                                    <MapPin size={18} />
                                </div>

                                <div className="overview-list">
                                    <div className="overview-list-item">
                                        <span>{t('events.dashboardLocationMode')}</span>
                                        <strong>
                                            {eventLocation.locationMode === 'manual'
                                                ? t('events.form.manualAddress')
                                                : t('events.form.googleMaps')}
                                        </strong>
                                    </div>
                                    <div className="overview-list-item">
                                        <span>{t('events.dashboardVenue')}</span>
                                        <strong>{localizedText(eventLocation.venue, eventLocation.venueAr) || t('common.notFound')}</strong>
                                    </div>
                                    {eventLocation.venueAr && (
                                        <div className="overview-list-item">
                                            <span>{t('events.dashboardVenueAr')}</span>
                                            <strong>{eventLocation.venueAr}</strong>
                                        </div>
                                    )}
                                </div>

                                {eventLocation.address && (
                                    <div className="overview-address-block">
                                        <span>{t('events.form.manualAddress')}</span>
                                        <p>{eventLocation.address}</p>
                                    </div>
                                )}

                                {eventLocation.mapUrl && eventLocation.locationMode !== 'manual' ? (
                                    <a
                                        href={eventLocation.mapUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="overview-link-button"
                                    >
                                        <Link2 size={16} />
                                        <span>{t('events.dashboardOpenInGoogleMaps')}</span>
                                    </a>
                                ) : (
                                    <div className="overview-map-note">{t('events.dashboardMapLinkUnavailable')}</div>
                                )}
                            </section>
                        </div>

                        <div className="event-details">
                            <div className="detail-card">
                                <h3>{t('events.dashboardQuickActions')}</h3>
                                <div className="action-list">
                                    <button type="button" className="action-item" onClick={() => setActiveTab('guests')}>
                                        <Users size={18} />
                                        <span>{t('events.dashboardManageGuestsInEvent')}</span>
                                    </button>
                                    <RoleGuard permission="events.edit">
                                        <button className="action-item" type="button">
                                            <Send size={18} />
                                            <span>{t('events.dashboardSendInvitations')}</span>
                                        </button>
                                    </RoleGuard>
                                    <RoleGuard permission="events.create">
                                        <Link to={`/invitation-projects/new?eventId=${id}`} className="action-item">
                                            <Mail size={18} />
                                            <span>{t('events.dashboardCreateInvitationProjectAdvanced')}</span>
                                        </Link>
                                    </RoleGuard>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'invitation-setup' && (
                    <EventInvitationSetupTab event={event} onUpdated={fetchEvent} />
                )}

                {activeTab === 'invitation-ops' && (
                    <EventInvitationOpsTab event={event} />
                )}

                {activeTab === 'guests' && <EventGuestsTab event={event} />}

                {activeTab === 'addons' && <EventAddonsTab event={event} />}

                {activeTab === 'observation' && <EventObservationTab event={event} />}
            </div>
        </div>
    );
}
