import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { normalizeLayout } from './backgroundUtils';
import TemplatePreviewCanvas from './components/TemplatePreviewCanvas';
import './TemplatePreviewPage.css';

function readPreviewState(storageKey) {
    try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) {
            return null;
        }

        return JSON.parse(raw);
    } catch (error) {
        console.warn('Failed to read preview state:', error);
        return null;
    }
}

export default function TemplatePreviewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const storageKey = `template-preview:${id || 'new'}`;
    const locationState = location.state || {};
    const storedState = useMemo(() => readPreviewState(storageKey), [storageKey]);
    const initialState = locationState.designData ? locationState : storedState;

    const [previewState, setPreviewState] = useState(initialState);
    const [loading, setLoading] = useState(!initialState);

    useEffect(() => {
        let mounted = true;

        async function loadTemplate() {
            if (locationState.designData || storedState?.designData) {
                setLoading(false);
                return;
            }

            if (!id || id === 'new') {
                setLoading(false);
                return;
            }

            try {
                const response = await api.get(`/admin/templates/${id}`);
                if (!mounted) {
                    return;
                }

                const template = response.data.data;
                const layout = normalizeLayout(template.design_data?.layout || {});

                setPreviewState({
                    templateId: template.id,
                    templateName: template.name,
                    templateHash: template.design_data_hash || '',
                    activeLanguage: layout.direction === 'rtl' ? 'ar' : 'en',
                    designData: {
                        ...template.design_data,
                        layout
                    }
                });
            } catch (error) {
                console.error('Failed to load template preview:', error);
                if (mounted) {
                    setPreviewState(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadTemplate();

        return () => {
            mounted = false;
        };
    }, [id, locationState.designData, storedState?.designData]);

    const templateName = previewState?.templateName || 'Template Preview';
    const templateHash = previewState?.templateHash || '';
    const language = previewState?.activeLanguage || 'ar';
    const designData = previewState?.designData || null;
    const canvasHeight = Math.max(640, Number(normalizeLayout(designData?.layout || {}).height) || 640);

    return (
        <div className="template-preview-page">
            <header className="template-preview-page__bar">
                <button
                    type="button"
                    className="template-preview-page__back"
                    onClick={() => {
                        if (window.history.length > 1) {
                            navigate(-1);
                            return;
                        }
                        navigate(id && id !== 'new' ? `/templates/${id}` : '/templates/new');
                    }}
                >
                    <ArrowLeft size={18} />
                    <span>Back to editor</span>
                </button>

                <div className="template-preview-page__title">
                    <h1>{templateName}</h1>
                    {templateHash && (
                        <span className="template-preview-page__chip" title={templateHash}>
                            v {templateHash.slice(0, 8)}
                        </span>
                    )}
                </div>
            </header>

            <main className="template-preview-page__content">
                {loading ? (
                    <div className="template-preview-page__loading">
                        <Loader2 size={32} className="spinner" />
                        <p>Loading preview...</p>
                    </div>
                ) : designData ? (
                    <div
                        className="template-preview-page__canvas"
                        style={{ '--preview-canvas-height': `${canvasHeight}px` }}
                    >
                        <TemplatePreviewCanvas
                            designData={designData}
                            language={language}
                            canvasHeight={canvasHeight}
                        />
                    </div>
                ) : (
                    <div className="template-preview-page__empty">
                        <Eye size={32} />
                        <h2>Preview unavailable</h2>
                        <p>We could not find a saved template snapshot for this preview.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
