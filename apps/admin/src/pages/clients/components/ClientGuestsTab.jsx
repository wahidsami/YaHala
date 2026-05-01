import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Ban,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    Filter,
    ImagePlus,
    Pencil,
    Plus,
    Search,
    Trash2,
    Upload,
    UserCheck,
    UserRound,
    X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../../../services/api';
import RoleGuard from '../../../components/auth/RoleGuard';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import './ClientGuestsTab.css';

const DEFAULT_FORM = {
    name: '',
    position: '',
    organization: '',
    email: '',
    mobileNumber: '',
    gender: 'male'
};

const DEFAULT_PAGINATION = {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
};

const GUEST_TEMPLATE_HEADERS = ['name', 'position', 'organization', 'email', 'mobileNumber', 'gender', 'status'];
const GUEST_TEMPLATE_SAMPLE = [['John Doe', 'Manager', 'Alpha Entity', 'john@example.com', '+966500000000', 'male', 'active']];

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

function normalizeCsvHeader(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}

function splitCsvLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (char === '"') {
            if (insideQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
            continue;
        }

        if (char === ',' && !insideQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values;
}

function normalizeGuestRecord(record) {
    const normalized = Object.entries(record || {}).reduce((accumulator, [key, value]) => {
        accumulator[normalizeCsvHeader(key)] = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return accumulator;
    }, {});

    const name = normalized.name || '';
    if (!name.trim()) {
        return null;
    }

    return {
        name: name.trim(),
        position: normalized.position || '',
        organization: normalized.organization || normalized.org || normalized.company || normalized.companyname || normalized.workplace || '',
        email: normalized.email || '',
        mobileNumber: normalized.mobilenumber || normalized.mobile || normalized.mobilephone || '',
        gender: (normalized.gender || 'male').trim().toLowerCase(),
        status: (normalized.status || 'active').trim().toLowerCase()
    };
}

function parseGuestsCsv(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return [];
    }

    const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);
    const rows = [];

    for (const line of lines.slice(1)) {
        const values = splitCsvLine(line);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] ?? '';
        });

        const normalized = normalizeGuestRecord(row);
        if (normalized) {
            rows.push(normalized);
        }
    }

    return rows;
}

async function parseGuestsSpreadsheetFile(file) {
    const fileName = (file?.name || '').toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return [];
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        return rows.map(normalizeGuestRecord).filter(Boolean);
    }

    const text = await file.text();
    return parseGuestsCsv(text);
}

function downloadGuestTemplate() {
    const link = document.createElement('a');
    link.href = '/templates/YaHala.xls';
    link.download = 'YaHala.xls';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function genderLabel(t, gender) {
    if (gender === 'female') {
        return t('clients.guests.genderFemale');
    }

    if (gender === 'other') {
        return t('clients.guests.genderOther');
    }

    return t('clients.guests.genderMale');
}

function statusLabel(t, status) {
    if (status === 'banned') {
        return t('clients.guests.statusBanned');
    }

    return t('clients.guests.statusActive');
}

function genderIconClass(gender) {
    if (gender === 'female') {
        return 'guest-avatar guest-avatar--female';
    }

    if (gender === 'other') {
        return 'guest-avatar guest-avatar--other';
    }

    return 'guest-avatar guest-avatar--male';
}

function isValidEmail(value) {
    const email = String(value || '').trim();
    if (!email) {
        return true;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidSaudiMobileNumber(value) {
    const mobileNumber = String(value || '').trim();
    if (!mobileNumber) {
        return true;
    }

    const sanitized = mobileNumber.replace(/[\s()-]/g, '');
    return /^05\d{8}$/.test(sanitized) || /^\+9665\d{8}$/.test(sanitized);
}

function getGuestSaveError(t, error, fallbackKey) {
    const code = error?.response?.data?.code;

    if (code === 'DUPLICATE_GUEST') {
        return t('clients.guests.duplicateGuest');
    }

    return error?.response?.data?.message || error?.message || t(fallbackKey);
}

export default function ClientGuestsTab({ clientId }) {
    const { t } = useTranslation();
    const [guests, setGuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
    const [filters, setFilters] = useState({ search: '', status: 'all', gender: 'all' });
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [editorMode, setEditorMode] = useState('create');
    const [editorOpen, setEditorOpen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [importError, setImportError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [formData, setFormData] = useState(DEFAULT_FORM);
    const [avatarPreview, setAvatarPreview] = useState('');
    const [avatarDataUrl, setAvatarDataUrl] = useState('');
    const [importFile, setImportFile] = useState(null);

    useEffect(() => {
        fetchGuests();
        setSelectedIds([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId, pagination.page, pagination.pageSize, filters.search, filters.status, filters.gender]);

    async function fetchGuests() {
        setLoading(true);
        setError('');

        try {
            const params = new URLSearchParams({
                page: pagination.page,
                pageSize: pagination.pageSize,
                sortBy: 'created_at',
                sortOrder: 'desc',
                ...(filters.search && { search: filters.search }),
                ...(filters.status !== 'all' && { status: filters.status }),
                ...(filters.gender !== 'all' && { gender: filters.gender })
            });

            const response = await api.get(`/admin/clients/${clientId}/guests?${params}`);
            setGuests(response.data.data);
            setPagination((prev) => ({
                ...prev,
                ...response.data.pagination
            }));
            setSelectedIds([]);
        } catch (fetchError) {
            console.error('Failed to fetch client guests:', fetchError);
            setError(fetchError.response?.data?.message || t('clients.guests.loadFailed'));
        } finally {
            setLoading(false);
        }
    }

    function openCreateGuest() {
        setEditorMode('create');
        setSelectedGuest(null);
        setFormData(DEFAULT_FORM);
        setAvatarPreview('');
        setAvatarDataUrl('');
        setFormError('');
        setEditorOpen(true);
    }

    function openEditGuest(guest) {
        setEditorMode('edit');
        setSelectedGuest(guest);
        setFormData({
            name: guest.name || '',
            position: guest.position || '',
            organization: guest.organization || '',
            email: guest.email || '',
            mobileNumber: guest.mobile_number || '',
            gender: guest.gender || 'male'
        });
        setAvatarPreview(resolveAssetUrl(guest.avatar_path));
        setAvatarDataUrl('');
        setFormError('');
        setEditorOpen(true);
    }

    function openViewGuest(guest) {
        setSelectedGuest(guest);
        setViewerOpen(true);
    }

    function closeEditor() {
        setEditorOpen(false);
        setSelectedGuest(null);
        setAvatarDataUrl('');
        setAvatarPreview('');
        setFormError('');
    }

    function closeViewer() {
        setViewerOpen(false);
        setSelectedGuest(null);
    }

    function closeImport() {
        setImportOpen(false);
        setImportError('');
        setImportResult(null);
        setImportFile(null);
    }

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPagination((prev) => ({ ...prev, page: 1 }));
    }

    function handlePageSizeChange(event) {
        setPagination((prev) => ({
            ...prev,
            pageSize: Number(event.target.value),
            page: 1
        }));
    }

    function handleSelectAllChange(event) {
        if (event.target.checked) {
            setSelectedIds(guests.map((guest) => guest.id));
            return;
        }

        setSelectedIds([]);
    }

    function handleSelectGuest(guestId, checked) {
        setSelectedIds((prev) => {
            if (checked) {
                return prev.includes(guestId) ? prev : [...prev, guestId];
            }

            return prev.filter((id) => id !== guestId);
        });
    }

    function handleFormChange(event) {
        const { name, value } = event.target;
        const nextValue = name === 'mobileNumber'
            ? String(value || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
            : value;
        setFormData((prev) => ({ ...prev, [name]: nextValue }));
    }

    async function handleAvatarUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            setAvatarPreview(editorMode === 'edit' ? resolveAssetUrl(selectedGuest?.avatar_path) : '');
            setAvatarDataUrl('');
            return;
        }

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error(t('clients.guests.failedToLoadAvatar')));
                reader.readAsDataURL(file);
            });
            setAvatarPreview(dataUrl);
            setAvatarDataUrl(dataUrl);
        } catch (uploadError) {
            setFormError(uploadError.message || t('clients.guests.failedToLoadAvatar'));
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSaving(true);
        setFormError('');

        if (!isValidEmail(formData.email)) {
            setFormError(t('clients.guests.invalidEmail'));
            setSaving(false);
            return;
        }

        if (!isValidSaudiMobileNumber(formData.mobileNumber)) {
            setFormError(t('clients.guests.invalidMobileNumber'));
            setSaving(false);
            return;
        }

        const payload = {
            ...formData,
            avatarDataUrl: avatarDataUrl || undefined
        };

        try {
            if (editorMode === 'edit' && selectedGuest?.id) {
                await api.put(`/admin/clients/${clientId}/guests/${selectedGuest.id}`, payload);
            } else {
                await api.post(`/admin/clients/${clientId}/guests`, payload);
            }

            closeEditor();
            await fetchGuests();
        } catch (submitError) {
            console.error('Failed to save guest:', submitError);
            setFormError(getGuestSaveError(t, submitError, 'clients.guests.failedToSave'));
        } finally {
            setSaving(false);
        }
    }

    function handleBanToggle(guest) {
        const isBanned = guest.status === 'banned';
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: isBanned ? t('clients.guests.unbanConfirm') : t('clients.guests.banConfirm'),
            confirmLabel: isBanned ? t('clients.guests.unban') : t('clients.guests.ban'),
            variant: 'warning',
            onConfirm: async () => {
                await api.patch(`/admin/clients/${clientId}/guests/${guest.id}/status`, {
                    status: isBanned ? 'active' : 'banned'
                });
                await fetchGuests();
            }
        });
    }

    function handleDeleteGuest(guest) {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('clients.guests.deleteConfirm'),
            confirmLabel: t('common.delete'),
            variant: 'danger',
            onConfirm: async () => {
                await api.delete(`/admin/clients/${clientId}/guests/${guest.id}`);
                await fetchGuests();
            }
        });
    }

    function handleBulkBan() {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('clients.guests.bulkBanConfirm', { count: selectedIds.length }),
            confirmLabel: t('clients.guests.banSelected'),
            variant: 'warning',
            onConfirm: async () => {
                await Promise.all(
                    selectedIds.map((guestId) =>
                        api.patch(`/admin/clients/${clientId}/guests/${guestId}/status`, {
                            status: 'banned'
                        })
                    )
                );
                setSelectedIds([]);
                await fetchGuests();
            }
        });
    }

    function handleBulkDelete() {
        setConfirmDialog({
            title: t('common.confirmAction'),
            description: t('clients.guests.bulkDeleteConfirm', { count: selectedIds.length }),
            confirmLabel: t('common.delete'),
            variant: 'danger',
            onConfirm: async () => {
                await Promise.all(
                    selectedIds.map((guestId) =>
                        api.delete(`/admin/clients/${clientId}/guests/${guestId}`)
                    )
                );
                setSelectedIds([]);
                await fetchGuests();
            }
        });
    }

    async function handleImportSubmit(event) {
        event.preventDefault();
        setImportError('');
        setImportResult(null);

        if (!importFile) {
            setImportError(t('clients.guests.importNoFile'));
            return;
        }

        try {
            const parsedGuests = await parseGuestsSpreadsheetFile(importFile);

            if (!parsedGuests.length) {
                throw new Error(t('clients.guests.importEmpty'));
            }

            const response = await api.post(`/admin/clients/${clientId}/guests/import`, {
                guests: parsedGuests
            });

            setImportResult(response.data.meta || { imported: 0 });
            setImportFile(null);
            await fetchGuests();
        } catch (importSubmitError) {
            console.error('Failed to import guests:', importSubmitError);
            setImportError(getGuestSaveError(t, importSubmitError, 'clients.guests.importFailed'));
        }
    }

    const allSelected = guests.length > 0 && guests.every((guest) => selectedIds.includes(guest.id));

    return (
        <div className="client-guests-tab">
            <div className="tab-header">
                <div>
                    <h3>{t('clients.guests.title')}</h3>
                    <p>{t('clients.guests.subtitle')}</p>
                </div>

                <div className="guest-actions">
                    <RoleGuard permission="clients.edit">
                        {selectedIds.length > 0 && (
                            <div className="guest-bulk-actions">
                                <button type="button" className="btn btn-secondary btn-small" onClick={handleBulkBan}>
                                    {t('clients.guests.banSelected')} ({selectedIds.length})
                                </button>
                                <button type="button" className="btn btn-danger btn-small" onClick={handleBulkDelete}>
                                    {t('clients.guests.deleteSelected')} ({selectedIds.length})
                                </button>
                            </div>
                        )}
                    </RoleGuard>
                    <RoleGuard permission="clients.edit">
                        <button type="button" className="btn btn-secondary" onClick={downloadGuestTemplate}>
                            <Download size={16} />
                            <span>{t('clients.guests.downloadTemplate')}</span>
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
                            <Upload size={16} />
                            <span>{t('clients.guests.importGuests')}</span>
                        </button>
                        <button type="button" className="btn btn-primary" onClick={openCreateGuest}>
                            <Plus size={16} />
                            <span>{t('clients.guests.addGuest')}</span>
                        </button>
                    </RoleGuard>
                </div>
            </div>

            <div className="guests-toolbar">
                <div className="guests-search">
                    <Search size={16} />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(event) => handleFilterChange('search', event.target.value)}
                        placeholder={t('clients.guests.searchPlaceholder')}
                    />
                </div>

                <div className="guests-filters">
                    <div className="filter-pill">
                        <Filter size={14} />
                        <select value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)}>
                            <option value="all">{t('clients.guests.allStatuses')}</option>
                            <option value="active">{t('clients.guests.statusActive')}</option>
                            <option value="banned">{t('clients.guests.statusBanned')}</option>
                        </select>
                    </div>

                    <div className="filter-pill">
                        <UserRound size={14} />
                        <select value={filters.gender} onChange={(event) => handleFilterChange('gender', event.target.value)}>
                            <option value="all">{t('clients.guests.allGenders')}</option>
                            <option value="male">{t('clients.guests.genderMale')}</option>
                            <option value="female">{t('clients.guests.genderFemale')}</option>
                            <option value="other">{t('clients.guests.genderOther')}</option>
                        </select>
                    </div>

                    <select value={pagination.pageSize} onChange={handlePageSizeChange}>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>

            {error && <div className="guests-error">{error}</div>}

            <div className="guests-table-wrap">
                <table className="guests-table">
                    <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={handleSelectAllChange}
                                    aria-label={t('clients.guests.selectAll')}
                                />
                            </th>
                            <th>{t('clients.guests.avatar')}</th>
                            <th>{t('clients.guests.name')}</th>
                            <th>{t('clients.guests.position')}</th>
                            <th>{t('clients.guests.organization')}</th>
                            <th>{t('clients.guests.email')}</th>
                            <th>{t('clients.guests.mobileNumber')}</th>
                            <th>{t('clients.guests.status')}</th>
                            <th>{t('clients.guests.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="9" className="loading-cell">{t('common.loading')}</td>
                            </tr>
                        ) : guests.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="empty-cell">{t('clients.guests.noGuests')}</td>
                            </tr>
                        ) : (
                            guests.map((guest) => {
                                const isSelected = selectedIds.includes(guest.id);
                                return (
                                    <tr key={guest.id} className={isSelected ? 'is-selected' : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(event) => handleSelectGuest(guest.id, event.target.checked)}
                                                aria-label={guest.name}
                                            />
                                        </td>
                                        <td>
                                            {guest.avatar_path ? (
                                                <img className="guest-avatar-image" src={resolveAssetUrl(guest.avatar_path)} alt={guest.name} />
                                            ) : (
                                                <div className={genderIconClass(guest.gender)}>
                                                    <UserRound size={16} />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="guest-name-cell">
                                                <strong>{guest.name}</strong>
                                                <span>{genderLabel(t, guest.gender)}</span>
                                            </div>
                                        </td>
                                        <td>{guest.position || 'N/A'}</td>
                                        <td>{guest.organization || 'N/A'}</td>
                                        <td>{guest.email || 'N/A'}</td>
                                        <td>{guest.mobile_number || 'N/A'}</td>
                                        <td>
                                            <span className={`status-badge status-${guest.status}`}>{statusLabel(t, guest.status)}</span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button type="button" className="action-btn" title={t('common.view')} onClick={() => openViewGuest(guest)}>
                                                    <Eye size={16} />
                                                </button>
                                                <RoleGuard permission="clients.edit">
                                                    <button type="button" className="action-btn" title={t('common.edit')} onClick={() => openEditGuest(guest)}>
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-btn"
                                                        title={guest.status === 'banned' ? t('clients.guests.unban') : t('clients.guests.ban')}
                                                        onClick={() => handleBanToggle(guest)}
                                                    >
                                                        {guest.status === 'banned' ? <UserCheck size={16} /> : <Ban size={16} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-btn action-btn--danger"
                                                        title={t('common.delete')}
                                                        onClick={() => handleDeleteGuest(guest)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </RoleGuard>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pagination">
                <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                    <ChevronLeft size={16} />
                    <span>{t('common.previous')}</span>
                </button>
                <span>{t('common.pageOf', { page: pagination.page, totalPages: pagination.totalPages || 1 })}</span>
                <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                    <span>{t('common.next')}</span>
                    <ChevronRight size={16} />
                </button>
            </div>

            {editorOpen && (
                <div className="guest-modal" role="dialog" aria-modal="true">
                    <button type="button" className="guest-modal__backdrop" aria-label={t('common.cancel')} onClick={closeEditor} />
                    <div className="guest-modal__panel">
                        <div className="guest-modal__header">
                            <div>
                                <p className="guest-modal__eyebrow">
                                    {editorMode === 'edit' ? t('clients.guests.editGuest') : t('clients.guests.addGuest')}
                                </p>
                                <h3>{editorMode === 'edit' ? formData.name : t('clients.guests.newGuest')}</h3>
                            </div>
                            <button type="button" className="icon-button" onClick={closeEditor} aria-label={t('common.cancel')}>
                                <X size={18} />
                            </button>
                        </div>

                        {formError && <div className="guest-modal__error">{formError}</div>}

                        <form className="guest-form" onSubmit={handleSubmit}>
                            <div className="guest-form__avatar">
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt={formData.name || t('clients.guests.avatar')} />
                                ) : (
                                    <div className={`guest-form__avatar-fallback guest-form__avatar-fallback--${formData.gender}`}>
                                        <UserRound size={34} />
                                    </div>
                                )}
                                <label className="file-button">
                                    <ImagePlus size={16} />
                                    <span>{t('clients.guests.uploadPhoto')}</span>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                        onChange={handleAvatarUpload}
                                    />
                                </label>
                            </div>

                            <div className="guest-form__grid">
                                <div className="field">
                                    <label>{t('clients.guests.name')}</label>
                                    <input name="name" type="text" value={formData.name} onChange={handleFormChange} required />
                                </div>

                                <div className="field">
                                    <label>{t('clients.guests.position')}</label>
                                    <input name="position" type="text" value={formData.position} onChange={handleFormChange} />
                                </div>

                                <div className="field">
                                    <label>{t('clients.guests.organization')}</label>
                                    <input name="organization" type="text" value={formData.organization} onChange={handleFormChange} />
                                </div>

                                <div className="field">
                                    <label>{t('clients.guests.email')}</label>
                                    <input name="email" type="email" value={formData.email} onChange={handleFormChange} />
                                </div>

                                <div className="field">
                                    <label>{t('clients.guests.mobileNumber')}</label>
                                    <input
                                        name="mobileNumber"
                                        type="tel"
                                        value={formData.mobileNumber}
                                        onChange={handleFormChange}
                                        inputMode="numeric"
                                        maxLength={13}
                                        autoComplete="tel"
                                    />
                                    <small className="field-hint">{t('clients.guests.mobilePatternHint')}</small>
                                </div>

                                <div className="field">
                                    <label>{t('clients.guests.gender')}</label>
                                    <select name="gender" value={formData.gender} onChange={handleFormChange}>
                                        <option value="male">{t('clients.guests.genderMale')}</option>
                                        <option value="female">{t('clients.guests.genderFemale')}</option>
                                        <option value="other">{t('clients.guests.genderOther')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="guest-form__actions">
                                <button type="button" className="btn btn-secondary" onClick={closeEditor}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? t('common.loading') : t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewerOpen && selectedGuest && (
                <div className="guest-modal" role="dialog" aria-modal="true">
                    <button type="button" className="guest-modal__backdrop" aria-label={t('common.cancel')} onClick={closeViewer} />
                    <div className="guest-modal__panel guest-modal__panel--view">
                        <div className="guest-modal__header">
                            <div>
                                <p className="guest-modal__eyebrow">{t('clients.guests.guestProfile')}</p>
                                <h3>{selectedGuest.name}</h3>
                            </div>
                            <button type="button" className="icon-button" onClick={closeViewer} aria-label={t('common.cancel')}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="guest-view">
                            <div className="guest-view__avatar">
                                {selectedGuest.avatar_path ? (
                                    <img src={resolveAssetUrl(selectedGuest.avatar_path)} alt={selectedGuest.name} />
                                ) : (
                                    <div className={genderIconClass(selectedGuest.gender)}>
                                        <UserRound size={34} />
                                    </div>
                                )}
                            </div>

                            <div className="guest-view__details">
                                <div className="guest-view__row">
                                    <span>{t('clients.guests.position')}</span>
                                    <strong>{selectedGuest.position || 'N/A'}</strong>
                                </div>
                                <div className="guest-view__row">
                                    <span>{t('clients.guests.organization')}</span>
                                    <strong>{selectedGuest.organization || 'N/A'}</strong>
                                </div>
                                <div className="guest-view__row">
                                    <span>{t('clients.guests.email')}</span>
                                    <strong>{selectedGuest.email || 'N/A'}</strong>
                                </div>
                                <div className="guest-view__row">
                                    <span>{t('clients.guests.mobileNumber')}</span>
                                    <strong>{selectedGuest.mobile_number || 'N/A'}</strong>
                                </div>
                                <div className="guest-view__row">
                                    <span>{t('clients.guests.gender')}</span>
                                    <strong>{genderLabel(t, selectedGuest.gender)}</strong>
                                </div>
                                <div className="guest-view__row">
                                    <span>{t('clients.guests.status')}</span>
                                    <strong>
                                        <span className={`status-badge status-${selectedGuest.status}`}>
                                            {statusLabel(t, selectedGuest.status)}
                                        </span>
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {importOpen && (
                <div className="guest-modal" role="dialog" aria-modal="true">
                    <button type="button" className="guest-modal__backdrop" aria-label={t('common.cancel')} onClick={closeImport} />
                    <div className="guest-modal__panel">
                        <div className="guest-modal__header">
                        <div>
                            <p className="guest-modal__eyebrow">{t('clients.guests.importGuests')}</p>
                            <h3>{t('clients.guests.importTitle')}</h3>
                        </div>
                            <button type="button" className="icon-button" onClick={closeImport} aria-label={t('common.cancel')}>
                                <X size={18} />
                            </button>
                        </div>

                        {importError && <div className="guest-modal__error">{importError}</div>}
                        {importResult && <div className="guest-modal__success">{t('clients.guests.importSuccess', { count: importResult.imported || 0 })}</div>}

                        <form className="guest-form" onSubmit={handleImportSubmit}>
                            <div className="template-download">
                                <div>
                                    <strong>{t('clients.guests.templateTitle')}</strong>
                                    <p>{t('clients.guests.templateHelp')}</p>
                                </div>
                                <button type="button" className="btn btn-secondary" onClick={downloadGuestTemplate}>
                                    <Download size={16} />
                                    <span>{t('clients.guests.downloadTemplate')}</span>
                                </button>
                            </div>

                            <div className="field">
                                <label>{t('clients.guests.importFile')}</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                                />
                                <small className="field-hint">{t('clients.guests.importHint')}</small>
                            </div>

                            <div className="import-sample">
                                <span>{t('clients.guests.importColumns')}</span>
                                <code>{GUEST_TEMPLATE_HEADERS.join(', ')}</code>
                                <small>{t('clients.guests.importAvatarNote')}</small>
                            </div>

                            <div className="guest-form__actions">
                                <button type="button" className="btn btn-secondary" onClick={closeImport}>
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {t('clients.guests.importGuests')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(confirmDialog)}
                title={confirmDialog?.title || ''}
                description={confirmDialog?.description || ''}
                confirmLabel={confirmDialog?.confirmLabel || t('common.confirm')}
                cancelLabel={t('common.cancel')}
                variant={confirmDialog?.variant || 'danger'}
                onConfirm={confirmDialog?.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
}
