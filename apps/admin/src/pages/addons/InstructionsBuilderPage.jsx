import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../services/api';
import './InstructionsBuilderPage.css';

const DEFAULT_SCHEMA = {
    version: 1,
    page: {
        width: 1080,
        height: 1600,
        responsive: true
    },
    widgets: []
};

const DEFAULT_EDITOR_SETTINGS = {
    showGrid: true,
    snapToGrid: true,
    gridSize: 16,
    pageHeight: 1600
};

export default function InstructionsBuilderPage({ mode = 'create', initialData = null }) {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState(() => ({
        name: initialData?.name || '',
        nameAr: initialData?.name_ar || '',
        clientId: initialData?.client_id || '',
        status: initialData?.status || 'draft',
        contentSchema: initialData?.content_schema || DEFAULT_SCHEMA,
        editorSettings: initialData?.editor_settings || DEFAULT_EDITOR_SETTINGS
    }));

    useEffect(() => {
        fetchClients();
    }, []);

    async function fetchClients() {
        try {
            const response = await api.get('/admin/clients?pageSize=200&status=active');
            setClients(response.data.data || []);
        } catch (fetchError) {
            console.error('Failed to fetch clients:', fetchError);
        }
    }

    function updateField(key, value) {
        setFormData((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSave() {
        const name = formData.name.trim();
        if (!name) {
            setError('Instruction name is required.');
            return;
        }
        if (!formData.clientId) {
            setError('Please select a client.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = {
                name,
                nameAr: formData.nameAr,
                clientId: formData.clientId,
                status: formData.status,
                contentSchema: formData.contentSchema,
                editorSettings: formData.editorSettings
            };

            if (mode === 'edit' && initialData?.id) {
                await api.put(`/admin/instructions/${initialData.id}`, payload);
            } else {
                await api.post('/admin/instructions', payload);
            }

            navigate('/addons/instructions');
        } catch (saveError) {
            setError(saveError.response?.data?.message || 'Failed to save instruction.');
        } finally {
            setSaving(false);
        }
    }

    const widgetCatalog = useMemo(() => ([
        'Title',
        'Text',
        'Image',
        'Background',
        'Item Block'
    ]), []);

    return (
        <div className="instructions-builder-page">
            <div className="page-header instructions-builder-header">
                <div className="instructions-header-left">
                    <button type="button" className="back-link" onClick={() => navigate('/addons/instructions')}>
                        <ArrowLeft size={18} />
                        <span>Back</span>
                    </button>
                    <div className="instructions-top-fields">
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(event) => updateField('name', event.target.value)}
                            placeholder="Instruction name (required)"
                        />
                        <select value={formData.clientId} onChange={(event) => updateField('clientId', event.target.value)}>
                            <option value="">Select client</option>
                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
            </div>

            {error && <div className="form-error">{error}</div>}

            <section className="instructions-editor-layout">
                <aside className="instructions-panel instructions-widgets-panel">
                    <h3>Widgets</h3>
                    <ul>
                        {widgetCatalog.map((widget) => (
                            <li key={widget}><button type="button">{widget}</button></li>
                        ))}
                    </ul>
                </aside>

                <div className="instructions-canvas-wrap">
                    <div
                        className="instructions-canvas"
                        style={{
                            minHeight: `${formData.editorSettings.pageHeight || 1600}px`,
                            backgroundSize: `${formData.editorSettings.gridSize || 16}px ${formData.editorSettings.gridSize || 16}px`,
                            backgroundImage: formData.editorSettings.showGrid
                                ? 'linear-gradient(to right, rgba(148,163,184,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.25) 1px, transparent 1px)'
                                : 'none'
                        }}
                    >
                        <div className="canvas-empty">
                            <h4>Instruction Canvas</h4>
                            <p>Widget renderer will be implemented next (drag/drop + per-widget settings).</p>
                        </div>
                        <div className="canvas-resize-handle" />
                    </div>
                </div>

                <aside className="instructions-panel instructions-settings-panel">
                    <h3>Page Settings</h3>
                    <label>
                        <span>Show grid</span>
                        <input
                            type="checkbox"
                            checked={Boolean(formData.editorSettings.showGrid)}
                            onChange={(event) => updateField('editorSettings', {
                                ...formData.editorSettings,
                                showGrid: event.target.checked
                            })}
                        />
                    </label>
                    <label>
                        <span>Snap to grid</span>
                        <input
                            type="checkbox"
                            checked={Boolean(formData.editorSettings.snapToGrid)}
                            onChange={(event) => updateField('editorSettings', {
                                ...formData.editorSettings,
                                snapToGrid: event.target.checked
                            })}
                        />
                    </label>
                    <label>
                        <span>Grid size</span>
                        <input
                            type="number"
                            min="4"
                            max="80"
                            value={formData.editorSettings.gridSize || 16}
                            onChange={(event) => updateField('editorSettings', {
                                ...formData.editorSettings,
                                gridSize: Number.parseInt(event.target.value, 10) || 16
                            })}
                        />
                    </label>
                    <label>
                        <span>Page height (px)</span>
                        <input
                            type="number"
                            min="600"
                            max="6000"
                            value={formData.editorSettings.pageHeight || 1600}
                            onChange={(event) => updateField('editorSettings', {
                                ...formData.editorSettings,
                                pageHeight: Number.parseInt(event.target.value, 10) || 1600
                            })}
                        />
                    </label>
                </aside>
            </section>
        </div>
    );
}
