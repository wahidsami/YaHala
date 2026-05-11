import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoginPage from './pages/LoginPage';
import HomeHubPage from './pages/HomeHubPage';
import HubChrome from './components/layout/HubChrome';
import ProtectedRoute from './components/auth/ProtectedRoute';
import api from './services/api';

// Client pages
import ClientListPage from './pages/clients/ClientListPage';
import ClientFormPage from './pages/clients/ClientFormPage';
import ClientProfilePage from './pages/clients/ClientProfilePage';
import ClientEditPage from './pages/clients/ClientEditPage';

// Event pages
import EventListPage from './pages/events/EventListPage';
import EventFormPage from './pages/events/EventFormPage';
import EventDashboardPage from './pages/events/EventDashboardPage';
import CreateEventWizardPage from './pages/events/CreateEventWizardPage';

// Template pages
import TemplateBuilderPage from './pages/templates/TemplateBuilderPage';
import TemplatePreviewPage from './pages/templates/TemplatePreviewPage';
import LibraryPage from './pages/library/LibraryPage';
import AddonsPage from './pages/addons/AddonsPage';
import PollBuilderPage from './pages/addons/PollBuilderPage';
import QuestionnaireBuilderPage from './pages/addons/QuestionnaireBuilderPage';
import InstructionsBuilderPage from './pages/addons/InstructionsBuilderPage';
import InvitationProjectListPage from './pages/invitation-projects/InvitationProjectListPage';
import InvitationProjectFormPage from './pages/invitation-projects/InvitationProjectFormPage';
import InvitationProjectDetailPage from './pages/invitation-projects/InvitationProjectDetailPage';
import InvitationProjectEditPage from './pages/invitation-projects/InvitationProjectEditPage';
import PublicInvitationPage from './pages/public-invitations/PublicInvitationPage';
import DeliverySettingsPage from './pages/settings/DeliverySettingsPage';
import GuestsPage from './pages/guests/GuestsPage';
import LogsPage from './pages/logs/LogsPage';
import ReportsPage from './pages/reports/ReportsPage';
import SendInvitationsPage from './pages/send/SendInvitationsPage';

function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/invite/:token" element={<PublicInvitationPage />} />
            <Route path="/i/:token" element={<PublicInvitationPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
                <Route element={<HubChrome />}>
                    <Route path="/" element={<HomeHubPage />} />
                    <Route path="/dashboard" element={<Navigate to="/" replace />} />

                    {/* Clients */}
                    <Route path="/clients" element={<ClientListPage />} />
                    <Route path="/clients/new" element={<ClientFormPage />} />
                    <Route path="/clients/:id" element={<ClientProfilePage />} />
                    <Route path="/clients/:id/edit" element={<ClientEditPage />} />

                    {/* Events */}
                    <Route path="/events" element={<EventListPage />} />
                    <Route path="/events/new" element={<CreateEventWizardPage />} />
                    <Route path="/events/:id" element={<EventDashboardPage />} />
                    <Route path="/events/:id/edit" element={<EventEditWrapper />} />

                    {/* Primary Hub Sections */}
                    <Route path="/send" element={<SendInvitationsPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/templates" element={<LibraryPage />} />

                    {/* Templates */}
                    <Route path="/templates/new" element={<TemplateBuilderPage />} />
                    <Route path="/templates/:id/preview" element={<TemplatePreviewPage />} />
                    <Route path="/templates/:id" element={<TemplateBuilderPage />} />

                    {/* Addons */}
                    <Route path="/addons" element={<AddonsPage />} />
                    <Route path="/addons/:addonType" element={<AddonsPage />} />
                    <Route path="/addons/polls/new-builder" element={<PollBuilderPage mode="create" />} />
                    <Route path="/addons/polls/new" element={<PollBuilderPage mode="create" />} />
                    <Route path="/addons/polls/:id/edit" element={<PollEditWrapper />} />
                    <Route path="/addons/polls/:id" element={<PollEditWrapper />} />
                    <Route path="/addons/questionnaires/new-builder" element={<QuestionnaireBuilderPage mode="create" />} />
                    <Route path="/addons/questionnaires/new" element={<QuestionnaireBuilderPage mode="create" />} />
                    <Route path="/addons/questionnaires/:id/edit" element={<QuestionnaireEditWrapper />} />
                    <Route path="/addons/questionnaires/:id" element={<QuestionnaireEditWrapper />} />
                    <Route path="/addons/instructions/new-builder" element={<InstructionsBuilderPage mode="create" />} />
                    <Route path="/addons/instructions/new" element={<InstructionsBuilderPage mode="create" />} />
                    <Route path="/addons/instructions/:id/edit" element={<InstructionsEditWrapper />} />

                    {/* Invitation Projects */}
                    <Route path="/invitation-projects" element={<InvitationProjectListPage />} />
                    <Route path="/invitation-projects/new" element={<InvitationProjectFormPage />} />
                    <Route path="/invitation-projects/:id" element={<InvitationProjectDetailPage />} />
                    <Route path="/invitation-projects/:id/edit" element={<InvitationProjectEditPage />} />

                    {/* Placeholders */}
                    <Route path="/guests" element={<GuestsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/logs" element={<LogsPage />} />
                    <Route path="/settings" element={<DeliverySettingsPage />} />
                </Route>
            </Route>

            {/* Default Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function EventEditWrapper() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchEvent() {
            try {
                const response = await api.get(`/admin/events/${id}`);
                if (mounted) {
                    setEvent(response.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch event:', error);
                if (mounted) {
                    setEvent(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchEvent();

        return () => {
            mounted = false;
        };
    }, [id]);

    if (loading) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    if (!event) {
        return <div className="error">{t('common.notFound')}</div>;
    }

    return <EventFormPage mode="edit" initialData={event} />;
}

function PollEditWrapper() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [poll, setPoll] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchPoll() {
            try {
                const response = await api.get(`/admin/polls/${id}`);
                if (mounted) {
                    setPoll(response.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch poll:', error);
                if (mounted) {
                    setPoll(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchPoll();

        return () => {
            mounted = false;
        };
    }, [id]);

    if (loading) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    if (!poll) {
        return <div className="error">{t('common.notFound')}</div>;
    }

    return <PollBuilderPage mode="edit" initialData={poll} />;
}

function QuestionnaireEditWrapper() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [questionnaire, setQuestionnaire] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchQuestionnaire() {
            try {
                const response = await api.get(`/admin/questionnaires/${id}`);
                if (mounted) {
                    setQuestionnaire(response.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch questionnaire:', error);
                if (mounted) {
                    setQuestionnaire(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchQuestionnaire();

        return () => {
            mounted = false;
        };
    }, [id]);

    if (loading) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    if (!questionnaire) {
        return <div className="error">{t('common.notFound')}</div>;
    }

    return <QuestionnaireBuilderPage mode="edit" initialData={questionnaire} />;
}

function InstructionsEditWrapper() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [instruction, setInstruction] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchInstruction() {
            try {
                const response = await api.get(`/admin/instructions/${id}`);
                if (mounted) {
                    setInstruction(response.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch instruction:', error);
                if (mounted) {
                    setInstruction(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchInstruction();

        return () => {
            mounted = false;
        };
    }, [id]);

    if (loading) {
        return <div className="loading">{t('common.loading')}</div>;
    }

    if (!instruction) {
        return <div className="error">{t('common.notFound')}</div>;
    }

    return <InstructionsBuilderPage mode="edit" initialData={instruction} />;
}

export default App;

