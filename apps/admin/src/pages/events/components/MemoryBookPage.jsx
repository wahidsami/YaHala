import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, RefreshCw, Copy, Download, ExternalLink } from 'lucide-react';
import api from '../../../services/api';
import './MemoryBookPage.css';

export default function MemoryBookPage({ eventId }) {
    const { t } = useTranslation();
    const [memoryBook, setMemoryBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [settings, setSettings] = useState({
        includeGuestNames: true,
        includeVoice: true,
        includeText: true
    });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchMemoryBook();
    }, [eventId]);

    async function fetchMemoryBook() {
        try {
            const response = await api.get(`/admin/events/${eventId}/memory-book`);
            setMemoryBook(response.data.data);
        } catch (error) {
            console.error('Failed to fetch memory book:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerate() {
        setGenerating(true);
        try {
            const response = await api.post(`/admin/events/${eventId}/memory-book/generate`, settings);
            setMemoryBook(response.data.data);
        } catch (error) {
            console.error('Generate failed:', error);
        } finally {
            setGenerating(false);
        }
    }

    function handleCopyLink() {
        if (memoryBook?.html_url) {
            const fullUrl = `${window.location.origin.replace(':5173', ':3001')}${memoryBook.html_url}`;
            navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    function handleOpenLink() {
        if (memoryBook?.html_url) {
            const fullUrl = `${window.location.origin.replace(':5173', ':3001')}${memoryBook.html_url}`;
            window.open(fullUrl, '_blank');
        }
    }

    function handleDownload() {
        if (memoryBook?.html_url) {
            const fullUrl = `${window.location.origin.replace(':5173', ':3001')}${memoryBook.html_url}`;
            const link = document.createElement('a');
            link.href = fullUrl;
            link.download = `memory-book-${eventId}.html`;
            link.click();
        }
    }

    if (loading) return <div className="loading">{t('common.loading')}</div>;

    return (
        <div className="memory-book-page">
            <div className="page-header">
                <div className="header-icon">
                    <Book size={32} />
                </div>
                <div>
                    <h3>{t('events.memoryBookTitle')}</h3>
                    <p>{t('events.memoryBookSubtitle')}</p>
                </div>
            </div>

            <div className="settings-section">
                <h4>{t('events.memoryBookSettings')}</h4>
                <div className="settings-grid">
                    <label className="checkbox-option">
                        <input
                            type="checkbox"
                            checked={settings.includeGuestNames}
                            onChange={(e) => setSettings(prev => ({ ...prev, includeGuestNames: e.target.checked }))}
                        />
                        <span>{t('events.memoryBookIncludeGuestNames')}</span>
                    </label>
                    <label className="checkbox-option">
                        <input
                            type="checkbox"
                            checked={settings.includeVoice}
                            onChange={(e) => setSettings(prev => ({ ...prev, includeVoice: e.target.checked }))}
                        />
                        <span>{t('events.memoryBookIncludeVoice')}</span>
                    </label>
                    <label className="checkbox-option">
                        <input
                            type="checkbox"
                            checked={settings.includeText}
                            onChange={(e) => setSettings(prev => ({ ...prev, includeText: e.target.checked }))}
                        />
                        <span>{t('events.memoryBookIncludeText')}</span>
                    </label>
                </div>
            </div>

            <div className="actions-section">
                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                    <RefreshCw size={18} className={generating ? 'spin' : ''} />
                    <span>{generating ? t('events.memoryBookGenerating') : memoryBook ? t('events.memoryBookRegenerate') : t('events.memoryBookGenerate')}</span>
                </button>
            </div>

            {memoryBook && (
                <div className="result-section">
                    <div className="result-card">
                        <div className="result-info">
                            <h4>{t('events.memoryBookReady')}</h4>
                            <p className="generated-at">
                                {t('events.memoryBookGeneratedAt', { date: new Date(memoryBook.generated_at).toLocaleString() })}
                            </p>
                        </div>
                        <div className="result-actions">
                            <button className="action-btn" onClick={handleOpenLink}>
                                <ExternalLink size={16} />
                                <span>{t('events.memoryBookOpen')}</span>
                            </button>
                            <button className="action-btn" onClick={handleCopyLink}>
                                <Copy size={16} />
                                <span>{copied ? t('events.memoryBookCopied') : t('events.memoryBookCopyLink')}</span>
                            </button>
                            <button className="action-btn" onClick={handleDownload}>
                                <Download size={16} />
                                <span>{t('events.memoryBookDownload')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
