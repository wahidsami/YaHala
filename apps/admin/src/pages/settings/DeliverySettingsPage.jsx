import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Mail, Clock3, AlertTriangle, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './DeliverySettingsPage.css';

export default function DeliverySettingsPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('email');

    async function fetchSettings() {
        try {
            const response = await api.get('/admin/delivery/providers');
            setData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || t('common.loading'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        fetchSettings();
    }, []);

    async function handleRefresh() {
        setRefreshing(true);
        setError(null);
        await fetchSettings();
    }

    if (loading) {
        return <div className="delivery-settings-page loading">{t('common.loading')}</div>;
    }

    if (error && !data) {
        return (
            <div className="delivery-settings-page">
                <div className="settings-error">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="delivery-settings-page">
            <div className="page-header hub-display-title">
                <div className="hub-display-title__copy">
                    <span className="hub-display-title__eyebrow">{t('nav.settings')}</span>
                    <h1>{t('settings.deliverySettings')}</h1>
                </div>

                <div className="hub-display-title__actions">
                    <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                        <RefreshCw size={16} />
                        <span>{refreshing ? t('common.loading') : t('common.refresh')}</span>
                    </button>
                </div>
            </div>

                <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw size={16} />
                    <span>{refreshing ? t('common.loading') : t('common.refresh')}</span>
                </button>
            </div>

            {error && <div className="settings-error">{error}</div>}

            <div className="guest-tabs" role="tablist" style={{ marginBottom: '2rem' }}>
                <button
                    className={activeTab === 'email' ? 'active' : ''}
                    onClick={() => setActiveTab('email')}
                >
                    {t('settings.email', 'Email')}
                </button>
                <button
                    className={activeTab === 'whatsapp' ? 'active' : ''}
                    onClick={() => setActiveTab('whatsapp')}
                >
                    {t('settings.whatsapp', 'WhatsApp')}
                </button>
                <button
                    className={activeTab === 'sms' ? 'active' : ''}
                    onClick={() => setActiveTab('sms')}
                >
                    {t('settings.sms', 'SMS')}
                </button>
                <button
                    className={activeTab === 'worker' ? 'active' : ''}
                    onClick={() => setActiveTab('worker')}
                >
                    {t('settings.queueHealth', 'Queue Health')}
                </button>
            </div>

            <div className="settings-content">
                {activeTab === 'email' && (
                    <div className="settings-grid">
                        <section className="settings-card">
                            <div className="card-head">
                                <Mail size={18} />
                                <h2>{t('settings.provider')}</h2>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.provider')}</span>
                                <strong>{data?.email?.provider || '—'}</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.configured')}</span>
                                <strong className={data?.email?.configured ? 'status-ok' : 'status-bad'}>
                                    {data?.email?.configured ? t('settings.ready') : t('settings.off')}
                                </strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.fromEmail')}</span>
                                <strong>{data?.email?.fromEmail || '—'}</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.publicBaseUrl')}</span>
                                <strong>{data?.email?.baseUrl || '—'}</strong>
                            </div>
                        </section>
                        
                        <section className="settings-card">
                            <div className="card-head">
                                <ShieldCheck size={18} />
                                <h2>{t('settings.channelReadiness')}</h2>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.email')}</span>
                                <strong className={data?.channels?.email ? 'status-ok' : 'status-bad'}>{data?.channels?.email ? t('settings.ready') : t('settings.off')}</strong>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'whatsapp' && (
                    <div className="settings-grid">
                        <section className="settings-card">
                            <div className="card-head">
                                <ShieldCheck size={18} />
                                <h2>{t('settings.channelReadiness')}</h2>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.whatsapp')}</span>
                                <strong className={data?.channels?.whatsapp ? 'status-ok' : 'status-bad'}>{data?.channels?.whatsapp ? t('settings.ready') : t('settings.pendingApi')}</strong>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'sms' && (
                    <div className="settings-grid">
                        <section className="settings-card">
                            <div className="card-head">
                                <ShieldCheck size={18} />
                                <h2>{t('settings.channelReadiness')}</h2>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.sms')}</span>
                                <strong className={data?.channels?.sms ? 'status-ok' : 'status-bad'}>{data?.channels?.sms ? t('settings.ready') : t('settings.pendingApi')}</strong>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'worker' && (
                    <div className="settings-grid">
                        <section className="settings-card">
                            <div className="card-head">
                                <Clock3 size={18} />
                                <h2>{t('settings.worker')}</h2>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.pollInterval')}</span>
                                <strong>{data?.worker?.pollIntervalMs || 0} ms</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.maxRetries')}</span>
                                <strong>{data?.worker?.maxRetries || 0}</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.retryDelay')}</span>
                                <strong>{data?.worker?.retryBaseDelayMs || 0} ms</strong>
                            </div>
                        </section>

                        <section className="settings-card">
                            <div className="card-head">
                                <Send size={18} />
                                <h2>{t('settings.queueHealth')}</h2>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.queued')}</span>
                                <strong>{data?.queue?.queued || 0}</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.processing')}</span>
                                <strong>{data?.queue?.processing || 0}</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.retryScheduled')}</span>
                                <strong>{data?.queue?.retryScheduled || 0}</strong>
                            </div>
                            <div className="setting-row">
                                <span>{t('settings.failed')}</span>
                                <strong>{data?.queue?.failed || 0}</strong>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}


