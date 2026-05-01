import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import ClientFormPage from './ClientFormPage';

export default function ClientEditPage() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchClient();
    }, [id]);

    async function fetchClient() {
        try {
            const response = await api.get(`/admin/clients/${id}`);
            setClient(response.data.data);
        } catch (error) {
            console.error('Failed to fetch client:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="loading">{t('common.loading')}</div>;
    if (!client) return <div className="error">{t('common.notFound')}</div>;

    return <ClientFormPage mode="edit" initialData={client} />;
}
