import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import InvitationProjectFormPage from './InvitationProjectFormPage';

export default function InvitationProjectEditPage() {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProject();
    }, [id]);

    async function fetchProject() {
        try {
            const response = await api.get(`/admin/invitation-projects/${id}`);
            setProject(response.data.data.project);
        } catch (error) {
            console.error('Failed to fetch invitation project:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (!project) {
        return <div className="error">Invitation project not found</div>;
    }

    return <InvitationProjectFormPage mode="edit" initialData={project} />;
}
