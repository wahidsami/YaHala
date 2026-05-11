import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Activity,
    CheckCircle2,
    CheckSquare2,
    Copy,
    AlertCircle,
    Eye,
    Mail,
    Search,
    Send,
    RefreshCw,
    Layers3,
    UserPlus,
    Users
} from 'lucide-react';
import api from '../../services/api';
import RoleGuard from '../../components/auth/RoleGuard';
import './InvitationProjectsPage.css';

const PAGE_TYPE_LABELS = {
    rsvp: 'RSVP',
    poll: 'Poll',
    questionnaire: 'Questionnaire',
    quiz: 'Quiz',
    competition: 'Competition',
    terms: 'Terms',
    custom: 'Custom'
};

const INVITATION_STATUS_CLASS = {
    draft: 'status-draft',
    queued: 'status-paused',
    processing: 'status-paused',
    retry_scheduled: 'status-paused',
    sent: 'status-active',
    delivered: 'status-completed',
    opened: 'status-completed',
    responded: 'status-active',
    failed: 'status-archived',
    opted_out: 'status-archived',
    bounced: 'status-archived'
};

const TRACE_STEP_LABELS = {
    job_loaded: 'invitationProjects.traceStep.jobLoaded',
    provider_send_start: 'invitationProjects.traceStep.providerSendStart',
    provider_send_success: 'invitationProjects.traceStep.providerSendSuccess',
    provider_send_failed: 'invitationProjects.traceStep.providerSendFailed'
};

function resolveAssetUrl(assetPath) {
    if (!assetPath) {
        return '';
    }

    if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
        return assetPath;
    }

    const baseUrl = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const origin = baseUrl.replace(/\/api\/?$/, '');
    return `${origin}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
}

function getGuestInitials(name) {
    return String(name || '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || 'G';
}

export default function InvitationProjectDetailPage() {
    const { id } = useParams();
    const { t, i18n } = useTranslation();
    const [projectData, setProjectData] = useState(null);
    const [invitations, setInvitations] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [savingPage, setSavingPage] = useState(false);
    const [launchingProject, setLaunchingProject] = useState(false);
    const [syncingTemplate, setSyncingTemplate] = useState(false);
    const [sendingEmails, setSendingEmails] = useState(false);
    const [loadingEmailTrace, setLoadingEmailTrace] = useState(false);
    const [loadingEmailDebug, setLoadingEmailDebug] = useState(false);
    const [scheduledFor, setScheduledFor] = useState('');
    const [deliveryNotice, setDeliveryNotice] = useState(null);
    const [emailDebugResult, setEmailDebugResult] = useState(null);
    const [emailTraceResult, setEmailTraceResult] = useState(null);
    const [deliveries, setDeliveries] = useState([]);
    const [deliveryPagination, setDeliveryPagination] = useState({ page: 1, pageSize: 10, total: 0 });
    const [loadingDeliveries, setLoadingDeliveries] = useState(false);
    const [clientGuests, setClientGuests] = useState([]);
    const [loadingClientGuests, setLoadingClientGuests] = useState(false);
    const [selectedClientGuestIds, setSelectedClientGuestIds] = useState([]);
    const [guestSearch, setGuestSearch] = useState('');
    const [savingInvitation, setSavingInvitation] = useState(false);
    const [error, setError] = useState(null);

    const [pageForm, setPageForm] = useState({
        pageType: 'rsvp',
        title: '',
        titleAr: '',
        description: '',
        descriptionAr: '',
        sortOrder: 0
    });

    useEffect(() => {
        fetchProject();
        fetchInvitations();
    }, [id]);

    useEffect(() => {
        if (activeTab === 'deliveries') {
            fetchDeliveries();
        }
    }, [activeTab, id]);

    useEffect(() => {
        if (projectData?.project?.client_id) {
            fetchClientGuests(projectData.project.client_id);
        }
    }, [projectData?.project?.client_id]);

    async function fetchProject() {
        setLoading(true);
        try {
            const response = await api.get(`/admin/invitation-projects/${id}`);
            setProjectData(response.data.data);
        } catch (err) {
            console.error('Failed to fetch invitation project:', err);
            setError(err.response?.data?.message || t('invitationProjects.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    async function fetchClientGuests(clientId) {
        if (!clientId) {
            setClientGuests([]);
            return;
        }

        setLoadingClientGuests(true);
        try {
            const response = await api.get(`/admin/clients/${clientId}/guests?page=1&pageSize=500&status=active`);
            setClientGuests(response.data.data || []);
        } catch (err) {
            console.error('Failed to fetch client guests:', err);
            setError(err.response?.data?.message || t('clients.guests.loadFailed'));
        } finally {
            setLoadingClientGuests(false);
        }
    }

    async function fetchInvitations(page = pagination.page) {
        try {
            const response = await api.get(`/admin/invitation-projects/${id}/invitations?page=${page}&pageSize=${pagination.pageSize}`);
            setInvitations(response.data.data);
            setPagination(prev => ({ ...prev, ...response.data.pagination, page }));
        } catch (err) {
            console.error('Failed to fetch invitations:', err);
        }
    }

    async function fetchDeliveries(page = deliveryPagination.page) {
        setLoadingDeliveries(true);
        try {
            const response = await api.get(`/admin/invitation-projects/${id}/deliveries?page=${page}&pageSize=${deliveryPagination.pageSize}`);
            setDeliveries(response.data.data || []);
            setDeliveryPagination(prev => ({ ...prev, ...response.data.pagination, page }));
        } catch (err) {
            console.error('Failed to fetch delivery logs:', err);
            setError(err.response?.data?.message || t('invitationProjects.saveFailed'));
        } finally {
            setLoadingDeliveries(false);
        }
    }

    const project = projectData?.project;
    const summary = projectData?.summary;
    const pages = projectData?.pages || [];
    const coverTemplateId = project?.cover_template_id || null;
    const eventTemplateId = project?.event_template_id || null;
    const coverTemplateHash = project?.cover_template_hash || null;
    const eventTemplateHash = project?.event_template_hash || null;
    const templateMatchesEvent = Boolean(
        coverTemplateId &&
        (
            (coverTemplateHash && eventTemplateHash && coverTemplateHash === eventTemplateHash) ||
            (!coverTemplateHash && !eventTemplateHash && coverTemplateId === eventTemplateId)
        )
    );
    const hasTemplate = Boolean(coverTemplateId);
    const primaryInvitation = invitations[0] || null;
    const publicInviteLink = primaryInvitation?.public_token ? buildInviteLink(primaryInvitation.public_token) : null;

    const invitationChecklist = useMemo(() => {
        const recipientCount = summary?.recipient_count || 0;
        const hasAddonPages = pages.some((page) => page.page_type !== 'cover');
        const hasEmailRecipients = invitations.some((invitation) => Boolean(invitation.email));
        const hasQrReadyRecipients = invitations.some((invitation) => Boolean(invitation.public_token));

        return [
            {
                label: t('invitationProjects.checklistTemplate'),
                done: hasTemplate && templateMatchesEvent
            },
            {
                label: t('invitationProjects.checklistPages'),
                done: hasAddonPages
            },
            {
                label: t('invitationProjects.checklistGuests'),
                done: recipientCount > 0
            },
            {
                label: t('invitationProjects.checklistEmails'),
                done: hasEmailRecipients
            },
            {
                label: t('invitationProjects.checklistQr'),
                done: hasQrReadyRecipients
            }
        ];
    }, [coverTemplateHash, eventTemplateHash, hasTemplate, invitations, pages, summary?.recipient_count, templateMatchesEvent, t]);

    const readyToLaunch = useMemo(() => {
        const recipientCount = summary?.recipient_count || 0;
        const hasEmailRecipients = invitations.some((invitation) => Boolean(invitation.email));
        const hasQrReadyRecipients = invitations.some((invitation) => Boolean(invitation.public_token));

        return Boolean(hasTemplate && templateMatchesEvent && recipientCount > 0 && hasEmailRecipients && hasQrReadyRecipients);
    }, [coverTemplateHash, eventTemplateHash, hasTemplate, invitations, summary?.recipient_count, templateMatchesEvent]);

    const visibleClientGuests = useMemo(() => {
        const query = guestSearch.trim().toLowerCase();
        return clientGuests.filter((guest) => {
            if (!query) {
                return true;
            }

            return [
                guest.name,
                guest.position,
                guest.email,
                guest.mobile_number
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });
    }, [clientGuests, guestSearch]);

    const selectableClientGuests = useMemo(
        () => visibleClientGuests.filter((guest) => Boolean(guest.email)),
        [visibleClientGuests]
    );

    const selectedGuestRows = useMemo(
        () => clientGuests.filter((guest) => selectedClientGuestIds.includes(guest.id)),
        [clientGuests, selectedClientGuestIds]
    );

    const locale = useMemo(() => (i18n.language === 'ar' ? 'ar-EG' : 'en-US'), [i18n.language]);

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function localized(primary, secondary) {
        return i18n.language === 'ar' ? (secondary || primary) : (primary || secondary);
    }

    function pageTypeLabel(pageType) {
        if (pageType === 'poll') {
            return t('addons.pollTab');
        }

        return PAGE_TYPE_LABELS[pageType] || pageType;
    }

    function buildInviteLink(token) {
        return `${window.location.origin}/invite/${token}`;
    }

    function debugReasonLabel(reason) {
    const reasonMap = {
        missing_email: 'invitationProjects.debugReason.missingEmail',
        channel_not_email: 'invitationProjects.debugReason.channelNotEmail',
        status_opted_out: 'invitationProjects.debugReason.statusOptedOut',
        status_bounced: 'invitationProjects.debugReason.statusBounced',
        status_already_sent: 'invitationProjects.debugReason.statusAlreadySent',
        not_requested: 'invitationProjects.debugReason.notRequested'
    };

        return t(reasonMap[reason] || reason);
    }

    function traceStepLabel(step) {
        return t(TRACE_STEP_LABELS[step] || step);
    }

    function traceStepSummary(step) {
        const summaryParts = [];

        if (step.to) {
            summaryParts.push(step.to);
        }

        if (step.providerMessageId) {
            summaryParts.push(step.providerMessageId);
        }

        if (step.httpStatus) {
            summaryParts.push(`HTTP ${step.httpStatus}`);
        }

        if (step.responseSummary) {
            summaryParts.push(String(step.responseSummary));
        }

        if (step.errorSummary) {
            summaryParts.push(String(step.errorSummary));
        }

        return summaryParts.join(' · ');
    }

    function traceStepPayload(step) {
        const payload = step.responseBody || step.errorBody;

        if (!payload) {
            return null;
        }

        return JSON.stringify(payload, null, 2);
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            console.warn('Clipboard copy failed');
        }
    }

    function handlePageChange(event) {
        const { name, value } = event.target;
        setPageForm(prev => ({ ...prev, [name]: value }));
    }

    async function handleAddPage(event) {
        event.preventDefault();
        setSavingPage(true);
        setError(null);

        try {
            await api.post(`/admin/invitation-projects/${id}/pages`, {
                ...pageForm,
                sortOrder: Number(pageForm.sortOrder) || 0,
                settings: {}
            });
            setPageForm({
                pageType: 'rsvp',
                title: '',
                titleAr: '',
                description: '',
                descriptionAr: '',
                sortOrder: pages.length
            });
            await fetchProject();
        } catch (err) {
            setError(err.response?.data?.message || t('invitationProjects.saveFailed'));
        } finally {
            setSavingPage(false);
        }
    }

    function handleToggleGuest(guestId, checked) {
        setSelectedClientGuestIds((prev) => {
            if (checked) {
                return prev.includes(guestId) ? prev : [...prev, guestId];
            }

            return prev.filter((id) => id !== guestId);
        });
    }

    function handleToggleAllGuests(checked) {
        const selectableIds = visibleClientGuests
            .filter((guest) => Boolean(guest.email))
            .map((guest) => guest.id);

        setSelectedClientGuestIds((prev) => {
            if (checked) {
                return Array.from(new Set([...prev, ...selectableIds]));
            }

            return prev.filter((id) => !selectableIds.includes(id));
        });
    }

    async function handleAddSelectedGuests() {
        if (!project?.id || !selectedClientGuestIds.length) {
            return;
        }

        setSavingInvitation(true);
        setError(null);

        try {
            const recipients = clientGuests
                .filter((guest) => selectedClientGuestIds.includes(guest.id))
                .map((guest) => ({
                    clientGuestId: guest.id,
                    preferredLanguage: project.default_language || 'ar',
                    preferredChannel: 'email',
                    position: guest.position || '',
                    metadata: {
                        position: guest.position || ''
                    }
                }));

            await api.post(`/admin/invitation-projects/${id}/invitations/bulk`, {
                recipients
            });

            setSelectedClientGuestIds([]);
            await fetchProject();
            await fetchInvitations();
        } catch (err) {
            setError(err.response?.data?.message || t('invitationProjects.saveFailed'));
        } finally {
            setSavingInvitation(false);
        }
    }

    async function handleSendEmailInvites(mode = 'send') {
        setSendingEmails(true);
        setError(null);
        setDeliveryNotice(null);

        try {
            const response = await api.post(`/admin/invitation-projects/${id}/send-email`, {
                scheduledFor: mode === 'schedule' ? scheduledFor : null
            });
            const summary = response.data?.data?.summary || { sent: 0, failed: 0 };
            const noticeKey = summary.queued ? 'invitationProjects.sendQueued' : 'invitationProjects.sendSuccess';
            setDeliveryNotice(t(noticeKey, {
                queued: summary.queued || 0,
                sent: summary.sent || 0,
                failed: summary.failed || 0
            }));
            if (mode === 'schedule') {
                setScheduledFor('');
            }
            await fetchProject();
            await fetchInvitations();
            if (activeTab === 'deliveries') {
                await fetchDeliveries();
            }
            return true;
        } catch (err) {
            setError(err.response?.data?.message || t('invitationProjects.sendFailed'));
            return false;
        } finally {
            setSendingEmails(false);
        }
    }

    async function handleDebugEmailInvites() {
        setLoadingEmailDebug(true);
        setError(null);

        try {
            const response = await api.post(`/admin/invitation-projects/${id}/send-email/debug`);
            setEmailDebugResult(response.data?.data || null);
        } catch (err) {
            setError(err.response?.data?.message || t('invitationProjects.debugFailed'));
        } finally {
            setLoadingEmailDebug(false);
        }
    }

    async function handleTraceEmailInvites() {
        setLoadingEmailTrace(true);
        setError(null);
        setDeliveryNotice(null);

        try {
            const response = await api.post(`/admin/invitation-projects/${id}/send-email/trace`, {
                scheduledFor: scheduledFor || null
            });

            setEmailTraceResult(response.data?.data || null);
        } catch (err) {
            setError(err.response?.data?.message || t('invitationProjects.traceFailed'));
        } finally {
            setLoadingEmailTrace(false);
        }
    }

    async function handleSyncTemplate() {
        setSyncingTemplate(true);
        setError(null);
        setDeliveryNotice(null);

        try {
            await api.post(`/admin/invitation-projects/${id}/sync-template`);
            await fetchProject();
            setDeliveryNotice(t('invitationProjects.syncTemplateSuccess'));
        } catch (syncError) {
            console.error('Failed to sync invitation template:', syncError);
            setError(syncError.response?.data?.message || t('invitationProjects.syncTemplateFailed'));
        } finally {
            setSyncingTemplate(false);
        }
    }

    async function handleLaunchProject() {
        if (!readyToLaunch) {
            setError(t('invitationProjects.launchNotReady'));
            return;
        }

        setLaunchingProject(true);
        setError(null);
        setDeliveryNotice(null);

        try {
            await api.put(`/admin/invitation-projects/${id}`, {
                status: 'active'
            });

            const sendResult = await handleSendEmailInvites('send');
            if (sendResult === false) {
                return;
            }

            setDeliveryNotice(t('invitationProjects.launchSuccess'));
            await fetchProject();
            setActiveTab('invitations');
        } catch (launchError) {
            console.error('Failed to launch invitation project:', launchError);
            setError(launchError.response?.data?.message || t('invitationProjects.launchFailed'));
        } finally {
            setLaunchingProject(false);
        }
    }

    if (loading) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    if (!project) {
        return <div className="error">{error || t('invitationProjects.notFound')}</div>;
    }

    return (
        <div className="invitation-project-detail-page">
            <div className="hub-profile-header">
                <Link to="/invitation-projects" className="hub-profile-back">
                    <ArrowLeft size={16} />
                    <span>{t('common.back')}</span>
                </Link>

                <div className="hub-profile-content">
                    <div className="hub-profile-identity">
                        <div className="hub-profile-logo">
                            <Mail size={40} strokeWidth={1.5} />
                        </div>
                        <div className="hub-profile-title">
                            <div className="hub-profile-name-row">
                                <h1>{localized(project.name, project.name_ar)}</h1>
                                {project.name_ar && project.name && project.name_ar !== project.name && <span className="hub-profile-name-ar">{project.name_ar}</span>}
                                <span className={`status-badge status-${project.status}`}>
                                    {t(`invitationProjects.status.${project.status}`)}
                                </span>
                            </div>
                            <p className="hub-profile-meta">
                                {localized(project.event_name, project.event_name_ar)} &bull; {localized(project.client_name, project.client_name_ar)}
                            </p>
                        </div>
                    </div>

                    <div className="hub-profile-actions">
                        <RoleGuard permission="events.edit">
                            <Link to={`/invitation-projects/${id}/edit`} className="btn btn-secondary">
                                <Layers3 size={16} />
                                <span>{t('common.edit')}</span>
                            </Link>
                        </RoleGuard>
                        {!templateMatchesEvent && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleSyncTemplate}
                                disabled={syncingTemplate}
                                title={t('invitationProjects.syncTemplateHint')}
                            >
                                <RefreshCw size={16} />
                                <span>{syncingTemplate ? t('common.loading') : t('invitationProjects.syncTemplate')}</span>
                            </button>
                        )}
                        {project.status !== 'active' && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleLaunchProject}
                                disabled={launchingProject || !readyToLaunch}
                                title={!readyToLaunch ? t('invitationProjects.launchNotReady') : undefined}
                            >
                                <Send size={16} />
                                <span>{launchingProject ? t('common.loading') : t('invitationProjects.launchProject')}</span>
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={() => setActiveTab('invitations')}>
                            <Mail size={16} />
                            <span>{t('invitationProjects.manageInvitations')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {!templateMatchesEvent && (
                <div className="status-banner warning">
                    <div className="status-banner-copy">
                        <strong>{t('invitationProjects.templateMismatchTitle')}</strong>
                        <span>{t('invitationProjects.templateMismatchHint')}</span>
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={handleSyncTemplate} disabled={syncingTemplate}>
                        <RefreshCw size={16} />
                        <span>{syncingTemplate ? t('common.loading') : t('invitationProjects.syncTemplate')}</span>
                    </button>
                </div>
            )}

            <div className="summary-grid">
                <div className="summary-card">
                    <span className="summary-label">{t('invitationProjects.recipients')}</span>
                    <strong>{summary?.recipient_count || 0}</strong>
                </div>
                <div className="summary-card">
                    <span className="summary-label">{t('invitationProjects.pages')}</span>
                    <strong>{summary?.page_count || 0}</strong>
                </div>
                <div className="summary-card">
                    <span className="summary-label">{t('invitationProjects.modules')}</span>
                    <strong>{summary?.module_count || 0}</strong>
                </div>
                <div className="summary-card">
                    <span className="summary-label">{t('invitationProjects.responded')}</span>
                    <strong>{summary?.responded_count || 0}</strong>
                </div>
            </div>

            {deliveryNotice && (
                <div className="status-banner success">
                    {deliveryNotice}
                </div>
            )}
            {error && (
                <div className="status-banner error">
                    {error}
                </div>
            )}

            <div className="guest-tabs">
                <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                    {t('invitationProjects.overview')}
                </button>
                <button className={`tab-secondary ${activeTab === 'pages' ? 'active' : ''}`} onClick={() => setActiveTab('pages')}>
                    <span>{t('invitationProjects.pages')}</span>
                    <small>{t('common.advanced')}</small>
                </button>
                <button className={activeTab === 'invitations' ? 'active' : ''} onClick={() => setActiveTab('invitations')}>
                    {t('invitationProjects.invitations')}
                </button>
                <button className={activeTab === 'deliveries' ? 'active' : ''} onClick={() => setActiveTab('deliveries')}>
                    {t('invitationProjects.deliveries')}
                </button>
            </div>

            <div className="detail-grid">
                {activeTab === 'overview' && (
                    <>
                        <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.projectDetails')}</h3>
                                    <p>{t('invitationProjects.overviewSubtitle')}</p>
                                </div>
                            </div>

                            <div className="info-list">
                                <div className="info-row">
                                    <span>{t('invitationProjects.client')}</span>
                                    <strong>{localized(project.client_name, project.client_name_ar)}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.event')}</span>
                                    <strong>{localized(project.event_name, project.event_name_ar)}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.defaultLanguage')}</span>
                                    <strong>{project.default_language}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.coverTemplate')}</span>
                                    <strong>{project.cover_template_name || t('invitationProjects.noTemplate')}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.eventTemplate')}</span>
                                    <strong>{project.event_template_name || t('invitationProjects.noTemplate')}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.templateSync')}</span>
                                    <strong>
                                        <span className={`status-badge ${templateMatchesEvent ? 'status-active' : 'status-paused'}`}>
                                            {templateMatchesEvent ? t('invitationProjects.templateSynced') : t('invitationProjects.templateOutOfSync')}
                                        </span>
                                    </strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.createdAt')}</span>
                                    <strong>{formatDate(project.created_at)}</strong>
                                </div>
                                <div className="info-row">
                                    <span>{t('invitationProjects.updatedAt')}</span>
                                    <strong>{formatDate(project.updated_at)}</strong>
                                </div>
                            </div>
                        </section>

                        <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.quickLink')}</h3>
                                    <p>{t('invitationProjects.quickLinkSubtitle')}</p>
                                </div>
                            </div>

                            <div className="token-box">
                                {publicInviteLink ? (
                                    <div className="link-stack">
                                        <code>{publicInviteLink}</code>
                                        <div className="link-actions">
                                            <button type="button" className="btn btn-secondary" onClick={() => copyToClipboard(publicInviteLink)}>
                                                <Copy size={16} />
                                                <span>{t('common.copy')}</span>
                                            </button>
                                            <a href={publicInviteLink} target="_blank" rel="noreferrer" className="btn btn-primary">
                                                <Eye size={16} />
                                                <span>{t('common.view')}</span>
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    <code>{t('invitationProjects.quickLinkNote')}</code>
                                )}
                            </div>

                            <p className="muted-copy">{t('invitationProjects.quickLinkNote')}</p>
                        </section>

                        <section className="detail-card invitation-checklist-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.checklistTitle')}</h3>
                                    <p>{t('invitationProjects.checklistHint')}</p>
                                </div>
                                <CheckSquare2 size={18} />
                            </div>

                            <div className="invitation-checklist-list">
                                {invitationChecklist.map((item) => (
                                    <div key={item.label} className={`invitation-checklist-item ${item.done ? 'is-ready' : 'is-pending'}`}>
                                        {item.done ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                        <span>{item.label}</span>
                                        <strong>{item.done ? t('settings.ready') : t('common.pending')}</strong>
                                    </div>
                                ))}
                            </div>
                        </section>

                    </>
                )}

                {activeTab === 'pages' && (
                    <>
                        <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.pageBuilder')}</h3>
                                    <p>{t('invitationProjects.pageBuilderSubtitle')}</p>
                                </div>
                            </div>

                            <form className="inline-form" onSubmit={handleAddPage}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="pageType">{t('invitationProjects.pageType')}</label>
                                        <select id="pageType" name="pageType" value={pageForm.pageType} onChange={handlePageChange}>
                                            <option value="rsvp">{PAGE_TYPE_LABELS.rsvp}</option>
                                            <option value="questionnaire">{PAGE_TYPE_LABELS.questionnaire}</option>
                                            <option value="quiz">{PAGE_TYPE_LABELS.quiz}</option>
                                            <option value="competition">{PAGE_TYPE_LABELS.competition}</option>
                                            <option value="terms">{PAGE_TYPE_LABELS.terms}</option>
                                            <option value="custom">{PAGE_TYPE_LABELS.custom}</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="sortOrder">{t('invitationProjects.sortOrder')}</label>
                                        <input id="sortOrder" name="sortOrder" type="number" min="0" value={pageForm.sortOrder} onChange={handlePageChange} />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="title">{t('invitationProjects.pageTitle')}</label>
                                        <input id="title" name="title" type="text" value={pageForm.title} onChange={handlePageChange} />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="titleAr">{t('invitationProjects.pageTitleAr')}</label>
                                        <input id="titleAr" name="titleAr" type="text" value={pageForm.titleAr} onChange={handlePageChange} dir="rtl" />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="description">{t('invitationProjects.pageDescription')}</label>
                                        <textarea id="description" name="description" rows="3" value={pageForm.description} onChange={handlePageChange} />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="descriptionAr">{t('invitationProjects.pageDescriptionAr')}</label>
                                        <textarea id="descriptionAr" name="descriptionAr" rows="3" value={pageForm.descriptionAr} onChange={handlePageChange} dir="rtl" />
                                    </div>
                                </div>

                                <div className="form-actions compact">
                                    <button className="btn btn-primary" type="submit" disabled={savingPage}>
                                        {savingPage ? t('common.loading') : t('invitationProjects.addPage')}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.pages')}</h3>
                                    <p>{t('invitationProjects.pagesSubtitle')}</p>
                                </div>
                            </div>

                            <div className="nested-table-wrap">
                                <table className="data-table nested-table">
                                    <thead>
                                        <tr>
                                            <th>{t('invitationProjects.pageType')}</th>
                                            <th>{t('invitationProjects.pageTitle')}</th>
                                            <th>{t('invitationProjects.modules')}</th>
                                            <th>{t('invitationProjects.statusLabel')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pages.map(page => (
                                            <tr key={page.id}>
                                                <td>{pageTypeLabel(page.page_type)}</td>
                                                <td>
                                                    <div className="project-name">
                                                        <strong>{localized(page.title, page.title_ar) || page.page_key}</strong>
                                                        {page.title_ar && page.title && page.title_ar !== page.title && <span className="name-ar">{page.title_ar}</span>}
                                                    </div>
                                                </td>
                                                <td>{page.module_count || 0}</td>
                                                <td>
                                                    <span className={`status-badge ${page.is_enabled ? 'status-active' : 'status-archived'}`}>
                                                        {page.is_enabled ? t('common.enabled') : t('common.disabled')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 'invitations' && (
                    <>
                        <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.selectGuestsTitle')}</h3>
                                    <p>{t('invitationProjects.selectGuestsHint')}</p>
                                </div>
                                <div className="section-header-actions">
                                    <span className="muted-copy">
                                        {t('invitationProjects.selectedGuestsCount', { count: selectedClientGuestIds.length })}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleAddSelectedGuests}
                                        disabled={savingInvitation || selectedClientGuestIds.length === 0}
                                    >
                                        <UserPlus size={16} />
                                        <span>{savingInvitation ? t('common.loading') : t('invitationProjects.assignSelectedGuests')}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="guest-picker-toolbar">
                                <div className="form-group guest-picker-search">
                                    <label htmlFor="guestSearch">{t('common.search')}</label>
                                    <div className="guest-picker-search-input">
                                        <Search size={16} />
                                        <input
                                            id="guestSearch"
                                            type="search"
                                            value={guestSearch}
                                            onChange={(event) => setGuestSearch(event.target.value)}
                                            placeholder={t('invitationProjects.selectGuestsSearchPlaceholder')}
                                        />
                                    </div>
                                </div>

                                <div className="guest-picker-note">
                                    <Users size={16} />
                                    <span>{t('invitationProjects.selectGuestsNote')}</span>
                                </div>
                            </div>

                            <div className="nested-table-wrap">
                                <table className="data-table nested-table guest-picker-table">
                                    <thead>
                                        <tr>
                                            <th>
                                                <input
                                                    type="checkbox"
                                                    aria-label={t('clients.guests.selectAll')}
                                                    checked={
                                                        selectableClientGuests.length > 0 &&
                                                        selectableClientGuests.every((guest) => selectedClientGuestIds.includes(guest.id))
                                                    }
                                                    onChange={(event) => handleToggleAllGuests(event.target.checked)}
                                                />
                                            </th>
                                            <th>{t('clients.guests.avatar')}</th>
                                            <th>{t('clients.guests.name')}</th>
                                            <th>{t('clients.guests.position')}</th>
                                            <th>{t('clients.guests.email')}</th>
                                            <th>{t('clients.guests.mobileNumber')}</th>
                                            <th>{t('clients.guests.status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingClientGuests ? (
                                            <tr>
                                                <td colSpan="7" className="empty-cell">{t('common.loading')}</td>
                                            </tr>
                                        ) : visibleClientGuests.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="empty-cell">{t('invitationProjects.noGuestDirectory')}</td>
                                            </tr>
                                        ) : (
                                            visibleClientGuests.map((guest) => {
                                                const selectable = Boolean(guest.email);
                                                const selected = selectedClientGuestIds.includes(guest.id);
                                                const imageUrl = resolveAssetUrl(guest.avatar_path);

                                                return (
                                                    <tr key={guest.id} className={!selectable ? 'is-muted' : ''}>
                                                        <td>
                                                            <input
                                                                type="checkbox"
                                                                disabled={!selectable}
                                                                checked={selected}
                                                                onChange={(event) => handleToggleGuest(guest.id, event.target.checked)}
                                                            />
                                                        </td>
                                                        <td>
                                                            {imageUrl ? (
                                                                <img className="guest-avatar-image" src={imageUrl} alt={guest.name} />
                                                            ) : (
                                                                <div className={`guest-avatar guest-avatar--${guest.gender || 'male'}`}>
                                                                    <span>{getGuestInitials(guest.name)}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="project-name">
                                                                <strong>{guest.name}</strong>
                                                            </div>
                                                        </td>
                                                        <td>{guest.position || t('common.notAvailable')}</td>
                                                        <td>{guest.email || t('common.notAvailable')}</td>
                                                        <td>{guest.mobile_number || t('common.notAvailable')}</td>
                                                        <td>
                                                            <span className={`status-badge ${guest.status === 'banned' ? 'status-archived' : 'status-active'}`}>
                                                                {guest.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="guest-picker-footer">
                                <span className="muted-copy">{t('invitationProjects.selectGuestsFooter')}</span>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAddSelectedGuests}
                                    disabled={savingInvitation || selectedClientGuestIds.length === 0}
                                >
                                    <UserPlus size={16} />
                                    <span>{savingInvitation ? t('common.loading') : t('invitationProjects.assignSelectedGuests')}</span>
                                </button>
                            </div>
                        </section>

                        <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.invitations')}</h3>
                                    <p>{t('invitationProjects.invitationsSubtitle')}</p>
                                </div>
                            </div>

                            <p className="muted-copy">{t('invitationProjects.sendEmailsNote')}</p>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="scheduledFor">{t('invitationProjects.scheduleFor')}</label>
                                    <input
                                        id="scheduledFor"
                                        type="datetime-local"
                                        value={scheduledFor}
                                        onChange={(e) => setScheduledFor(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-actions compact">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => handleSendEmailInvites('schedule')}
                                    disabled={sendingEmails || !summary?.recipient_count || !scheduledFor}
                                >
                                    <Send size={16} />
                                    <span>{sendingEmails ? t('common.loading') : t('invitationProjects.scheduleEmails')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => handleSendEmailInvites('send')}
                                    disabled={sendingEmails || !summary?.recipient_count}
                                >
                                    <Send size={16} />
                                    <span>{sendingEmails ? t('common.loading') : t('invitationProjects.sendEmails')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleDebugEmailInvites}
                                    disabled={loadingEmailDebug}
                                >
                                    <Search size={16} />
                                    <span>{loadingEmailDebug ? t('common.loading') : t('invitationProjects.debugSend')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleTraceEmailInvites}
                                    disabled={loadingEmailTrace}
                                >
                                    <Activity size={16} />
                                    <span>{loadingEmailTrace ? t('common.loading') : t('invitationProjects.traceSend')}</span>
                                </button>
                            </div>

                            {emailDebugResult && (
                                <div className="detail-card invitation-debug-panel">
                                    <div className="section-header">
                                        <div>
                                            <h3>{t('invitationProjects.debugSendTitle')}</h3>
                                            <p>{t('invitationProjects.debugSendSubtitle')}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => copyToClipboard(JSON.stringify(emailDebugResult, null, 2))}
                                        >
                                            <Copy size={16} />
                                            <span>{t('common.copy')}</span>
                                        </button>
                                    </div>

                                    <div className="invitation-debug-summary">
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.debugSelectionMode')}</span>
                                            <strong>{t(`invitationProjects.debugMode.${emailDebugResult.selection?.mode || 'email_channel'}`)}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.debugTotalRecipients')}</span>
                                            <strong>{emailDebugResult.selection?.totalRecipients || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.debugSendableRecipients')}</span>
                                            <strong>{emailDebugResult.selection?.sendableRecipients || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.debugSkippedRecipients')}</span>
                                            <strong>{emailDebugResult.selection?.skippedRecipients || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.debugResendConfigured')}</span>
                                            <strong>
                                                {emailDebugResult.environment?.resendApiKeyConfigured && emailDebugResult.environment?.resendFromEmailConfigured
                                                    ? t('common.yes')
                                                    : t('common.no')}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="nested-table-wrap">
                                        <table className="data-table nested-table invitation-debug-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('invitationProjects.displayName')}</th>
                                                    <th>{t('auth.email')}</th>
                                                    <th>{t('invitationProjects.statusLabel')}</th>
                                                    <th>{t('invitationProjects.debugReasons')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(emailDebugResult.recipients || []).length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="empty-cell">{t('invitationProjects.noInvitations')}</td>
                                                    </tr>
                                                ) : (
                                                    emailDebugResult.recipients.map((recipient) => (
                                                        <tr key={recipient.id} className={recipient.sendable ? 'is-ready' : 'is-muted'}>
                                                            <td>
                                                                <div className="project-name">
                                                                    <strong>{localized(recipient.display_name, recipient.display_name_ar)}</strong>
                                                                    {recipient.email_source && (
                                                                        <span className="name-ar">{t(`invitationProjects.debugEmailSource.${recipient.email_source}`)}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td>{recipient.email || '—'}</td>
                                                            <td>
                                                                <span className={`status-badge ${recipient.sendable ? 'status-active' : 'status-archived'}`}>
                                                                    {recipient.sendable ? t('common.yes') : t('common.no')}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="debug-reason-list">
                                                                    {(recipient.reasons || []).length ? (
                                                                        recipient.reasons.map((reason) => (
                                                                            <span key={reason} className="debug-reason-chip">
                                                                                {debugReasonLabel(reason)}
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="debug-reason-chip is-success">{t('invitationProjects.debugReason.ready')}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <details className="invitation-debug-details">
                                        <summary>{t('invitationProjects.debugRawJson')}</summary>
                                        <pre className="invitation-debug-json">{JSON.stringify(emailDebugResult, null, 2)}</pre>
                                    </details>
                                </div>
                            )}

                            {emailTraceResult && (
                                <div className="detail-card invitation-trace-panel">
                                    <div className="section-header">
                                        <div>
                                            <h3>{t('invitationProjects.traceSendTitle')}</h3>
                                            <p>{t('invitationProjects.traceSendSubtitle')}</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => copyToClipboard(JSON.stringify(emailTraceResult, null, 2))}
                                        >
                                            <Copy size={16} />
                                            <span>{t('common.copy')}</span>
                                        </button>
                                    </div>

                                    <div className="invitation-debug-summary">
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.traceQueuedJobs')}</span>
                                            <strong>{emailTraceResult.trace?.enqueuedJobs?.length || emailTraceResult.jobs?.length || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.traceClaimedJobs')}</span>
                                            <strong>{emailTraceResult.trace?.processing?.claimed || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.traceSentJobs')}</span>
                                            <strong>{emailTraceResult.trace?.processing?.sent || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.traceFailedJobs')}</span>
                                            <strong>{emailTraceResult.trace?.processing?.failed || 0}</strong>
                                        </div>
                                        <div className="invitation-debug-summary-item">
                                            <span>{t('invitationProjects.traceRetryScheduled')}</span>
                                            <strong>{emailTraceResult.trace?.processing?.retryScheduled || 0}</strong>
                                        </div>
                                    </div>

                                    <div className="nested-table-wrap">
                                        <table className="data-table nested-table invitation-debug-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('invitationProjects.deliveryRecipient')}</th>
                                                    <th>{t('invitationProjects.deliveryStatus')}</th>
                                                    <th>{t('invitationProjects.traceSteps')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(emailTraceResult.trace?.processing?.jobs || []).length === 0 ? (
                                                    <tr>
                                                        <td colSpan="3" className="empty-cell">{t('invitationProjects.traceNoData')}</td>
                                                    </tr>
                                                ) : (
                                                    emailTraceResult.trace.processing.jobs.map((job) => {
                                                        const steps = Array.isArray(job.trace) ? job.trace : [];
                                                        const recipientEmail = job.requestPayload?.to || '—';

                                                        return (
                                                            <tr key={job.jobId}>
                                                                <td>
                                                                    <div className="project-name">
                                                                        <strong>{recipientEmail}</strong>
                                                                        <span className="name-ar">{job.recipientId}</span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className={`status-badge ${INVITATION_STATUS_CLASS[job.status] || 'status-draft'}`}>
                                                                        {job.status}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <div className="trace-timeline">
                                                                        {steps.length ? steps.map((step) => {
                                                                            const stepPayload = traceStepPayload(step);
                                                                            const payloadLabel = step.responseBody
                                                                                ? t('invitationProjects.traceResponseBody')
                                                                                : step.errorBody
                                                                                    ? t('invitationProjects.traceErrorBody')
                                                                                    : t('invitationProjects.traceProviderBody');

                                                                            return (
                                                                                <div key={`${job.jobId}-${step.step}-${step.at || 'now'}`} className="trace-timeline-item">
                                                                                    <div className="trace-timeline-head">
                                                                                        <strong>{traceStepLabel(step.step)}</strong>
                                                                                        <span>{step.at ? new Date(step.at).toLocaleString(locale) : '—'}</span>
                                                                                    </div>
                                                                                    <p>{traceStepSummary(step) || '—'}</p>
                                                                                    {stepPayload && (
                                                                                        <details className="trace-step-details">
                                                                                            <summary>{payloadLabel}</summary>
                                                                                            <pre className="invitation-debug-json">{stepPayload}</pre>
                                                                                        </details>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        }) : (
                                                                            <span className="muted-copy">{t('invitationProjects.traceNoData')}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <details className="invitation-debug-details">
                                        <summary>{t('invitationProjects.traceRawJson')}</summary>
                                        <pre className="invitation-debug-json">{JSON.stringify(emailTraceResult, null, 2)}</pre>
                                    </details>
                                </div>
                            )}

                            <div className="nested-table-wrap">
                                <table className="data-table nested-table">
                                    <thead>
                                        <tr>
                                            <th>{t('invitationProjects.displayName')}</th>
                                            <th>{t('auth.email')}</th>
                                            <th>{t('invitationProjects.channel.title')}</th>
                                            <th>{t('invitationProjects.statusLabel')}</th>
                                            <th>{t('invitationProjects.link')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invitations.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="empty-cell">{t('invitationProjects.noInvitations')}</td>
                                            </tr>
                                        ) : (
                                            invitations.map(invitation => {
                                                const link = buildInviteLink(invitation.public_token);

                                                return (
                                                    <tr key={invitation.id}>
                                                        <td>
                                                            <div className="project-name">
                                                                <strong>{localized(invitation.display_name, invitation.display_name_ar)}</strong>
                                                                {invitation.display_name_ar && invitation.display_name && invitation.display_name_ar !== invitation.display_name && <span className="name-ar">{invitation.display_name_ar}</span>}
                                                            </div>
                                                        </td>
                                                        <td>{invitation.email || '—'}</td>
                                                        <td>{t(`invitationProjects.channel.${invitation.preferred_channel}`)}</td>
                                                        <td>
                                                            <span className={`status-badge ${INVITATION_STATUS_CLASS[invitation.overall_status] || 'status-draft'}`}>
                                                                {invitation.overall_status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="row-actions">
                                                                <button className="action-btn" type="button" title={t('common.copy')} onClick={() => copyToClipboard(link)}>
                                                                    <Copy size={16} />
                                                                </button>
                                                                <button className="action-btn" type="button" title={t('common.view')}>
                                                                    <Eye size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {pagination.totalPages > 1 && (
                                <div className="pagination">
                                    <button
                                        disabled={pagination.page === 1}
                                        onClick={() => fetchInvitations(pagination.page - 1)}
                                    >
                                        {t('common.previous')}
                                    </button>
                                    <span>{t('invitationProjects.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}</span>
                                    <button
                                        disabled={pagination.page >= pagination.totalPages}
                                        onClick={() => fetchInvitations(pagination.page + 1)}
                                    >
                                        {t('common.next')}
                                    </button>
                                </div>
                            )}
                        </section>
                    </>
                )}

                {activeTab === 'deliveries' && (
                    <section className="detail-card">
                            <div className="section-header">
                                <div>
                                    <h3>{t('invitationProjects.deliveries')}</h3>
                                    <p>{t('invitationProjects.deliveriesSubtitle')}</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => fetchDeliveries()}
                                    disabled={loadingDeliveries}
                                >
                                    <RefreshCw size={16} />
                                    <span>{loadingDeliveries ? t('common.loading') : t('common.refresh')}</span>
                                </button>
                            </div>

                        <div className="nested-table-wrap">
                            <table className="data-table nested-table">
                                <thead>
                                    <tr>
                                        <th>{t('invitationProjects.deliveryRecipient')}</th>
                                        <th>{t('invitationProjects.deliveryChannel')}</th>
                                        <th>{t('invitationProjects.deliveryStatus')}</th>
                                        <th>{t('invitationProjects.deliveryScheduled')}</th>
                                        <th>{t('invitationProjects.deliveryAttempts')}</th>
                                        <th>{t('invitationProjects.deliveryLastError')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingDeliveries ? (
                                        <tr>
                                            <td colSpan="6" className="empty-cell">{t('common.loading')}</td>
                                        </tr>
                                    ) : deliveries.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="empty-cell">{t('invitationProjects.noDeliveries')}</td>
                                        </tr>
                                    ) : (
                                        deliveries.map((delivery) => {
                                            const recipientName = localized(delivery.display_name, delivery.display_name_ar);
                                            const payload = delivery.payload || {};
                                            const attemptCount = Array.isArray(delivery.attempts) ? delivery.attempts.length : 0;
                                            const lastAttempt = attemptCount > 0 ? delivery.attempts[attemptCount - 1] : null;

                                            return (
                                                <tr key={delivery.id}>
                                                    <td>
                                                        <div className="project-name">
                                                            <strong>{recipientName}</strong>
                                                            <span className="name-ar">{delivery.email || '—'}</span>
                                                        </div>
                                                    </td>
                                                    <td>{t(`invitationProjects.channel.${delivery.channel}`)}</td>
                                                    <td>
                                                        <span className={`status-badge ${INVITATION_STATUS_CLASS[delivery.status] || 'status-draft'}`}>
                                                            {delivery.status}
                                                        </span>
                                                    </td>
                                                    <td>{delivery.scheduled_for ? formatDate(delivery.scheduled_for) : '—'}</td>
                                                    <td>{attemptCount}</td>
                                                    <td className="muted-copy">
                                                        {delivery.last_error || lastAttempt?.error_message || payload.subject || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {deliveryPagination.totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    disabled={deliveryPagination.page === 1}
                                    onClick={() => fetchDeliveries(deliveryPagination.page - 1)}
                                >
                                    {t('common.previous')}
                                </button>
                                <span>{t('invitationProjects.pageOf', { page: deliveryPagination.page, totalPages: deliveryPagination.totalPages })}</span>
                                <button
                                    disabled={deliveryPagination.page >= deliveryPagination.totalPages}
                                    onClick={() => fetchDeliveries(deliveryPagination.page + 1)}
                                >
                                    {t('common.next')}
                                </button>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
