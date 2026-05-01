import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './ClientFormPage.css';

const COMPANY_TYPES = [
    { value: 'gov', labelKey: 'clients.form.type.gov' },
    { value: 'private', labelKey: 'clients.form.type.private' }
];

const COMPANY_SECTORS = [
    'Government / Public Sector',
    'Banking',
    'Financial Services',
    'Insurance',
    'Real Estate',
    'Construction',
    'Infrastructure',
    'Transportation & Logistics',
    'Aviation',
    'Healthcare',
    'Pharmaceuticals',
    'Education',
    'Retail',
    'E-commerce',
    'Hospitality & Tourism',
    'Food & Beverage',
    'Agriculture',
    'Manufacturing',
    'Technology & Telecom',
    'Media & Entertainment',
    'Mining & Metals',
    'Energy & Utilities',
    'Oil & Gas',
    'Petrochemicals',
    'Professional Services',
    'Automotive',
    'Defense & Security',
    'Non-Profit',
    'Other'
];

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

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read logo file'));
        reader.readAsDataURL(file);
    });
}

export default function ClientFormPage({ mode = 'create', initialData = {} }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [logoPreview, setLogoPreview] = useState(resolveAssetUrl(initialData.logo_path));
    const [logoDataUrl, setLogoDataUrl] = useState('');

    const [formData, setFormData] = useState({
        name: initialData.name || '',
        nameAr: initialData.name_ar || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        websiteUrl: initialData.website_url || '',
        contactPerson: initialData.contact_person || '',
        companyType: initialData.company_type || '',
        companySector: initialData.company_sector || '',
        addressRegion: initialData.address_region || '',
        addressCity: initialData.address_city || '',
        addressDistrict: initialData.address_district || '',
        addressStreet: initialData.address_street || '',
        addressBuildingNumber: initialData.address_building_number || '',
        addressAdditionalNumber: initialData.address_additional_number || '',
        addressPostalCode: initialData.address_postal_code || '',
        addressUnitNumber: initialData.address_unit_number || '',
        status: initialData.status || 'active',
        subscriptionTier: initialData.subscription_tier || 'basic',
        eventLimit: initialData.event_limit || 10,
        guestLimit: initialData.guest_limit || 1000
    });

    useEffect(() => {
        setLogoPreview(resolveAssetUrl(initialData.logo_path));
    }, [initialData.logo_path]);

    function handleChange(e) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    async function handleLogoChange(e) {
        const file = e.target.files?.[0];
        if (!file) {
            setLogoDataUrl('');
            setLogoPreview(resolveAssetUrl(initialData.logo_path));
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setLogoDataUrl(dataUrl);
            setLogoPreview(dataUrl);
        } catch (readError) {
            setError(readError.message || t('clients.form.failedToLoadLogo'));
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const payload = {
            ...formData,
            logoDataUrl: logoDataUrl || undefined
        };

        try {
            if (mode === 'edit') {
                await api.put(`/admin/clients/${initialData.id}`, payload);
            } else {
                await api.post('/admin/clients', payload);
            }
            navigate('/clients');
        } catch (err) {
            setError(err.response?.data?.message || t('clients.form.failedToSave'));
        } finally {
            setIsSubmitting(false);
        }
    }

    function getSectorLabel(sector) {
        if (!sector) {
            return '';
        }

        if (!i18n.language?.startsWith('ar')) {
            return sector;
        }

        const labels = {
            'Government / Public Sector': 'حكومي / قطاع عام',
            Banking: 'الخدمات المصرفية',
            'Financial Services': 'الخدمات المالية',
            Insurance: 'التأمين',
            'Real Estate': 'العقارات',
            Construction: 'الإنشاءات',
            Infrastructure: 'البنية التحتية',
            'Transportation & Logistics': 'النقل والخدمات اللوجستية',
            Aviation: 'الطيران',
            Healthcare: 'الرعاية الصحية',
            Pharmaceuticals: 'الأدوية',
            Education: 'التعليم',
            Retail: 'التجزئة',
            'E-commerce': 'التجارة الإلكترونية',
            'Hospitality & Tourism': 'الضيافة والسياحة',
            'Food & Beverage': 'الأغذية والمشروبات',
            Agriculture: 'الزراعة',
            Manufacturing: 'التصنيع',
            'Technology & Telecom': 'التقنية والاتصالات',
            'Media & Entertainment': 'الإعلام والترفيه',
            'Mining & Metals': 'التعدين والمعادن',
            'Energy & Utilities': 'الطاقة والمرافق',
            'Oil & Gas': 'النفط والغاز',
            Petrochemicals: 'البتروكيماويات',
            'Professional Services': 'الخدمات المهنية',
            Automotive: 'السيارات',
            'Defense & Security': 'الدفاع والأمن',
            'Non-Profit': 'غير ربحي',
            Other: 'أخرى'
        };

        return labels[sector] || sector;
    }

    return (
        <div className="client-form-page">
            <div className="page-header">
                <div>
                    <button type="button" className="back-link" onClick={() => navigate('/clients')}>
                        ← {t('clients.form.backToClients')}
                    </button>
                    <h1>{mode === 'edit' ? t('clients.form.editTitle') : t('clients.form.createTitle')}</h1>
                    <p>{t('clients.form.subtitle')}</p>
                </div>
            </div>

            <form className="client-form" onSubmit={handleSubmit}>
                {error && <div className="form-error">{error}</div>}

                <div className="form-section">
                    <h3>{t('clients.form.branding')}</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="logoUpload">{t('clients.form.uploadLogo')}</label>
                            <input
                                id="logoUpload"
                                name="logoUpload"
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={handleLogoChange}
                            />
                            <small className="form-hint">{t('clients.form.logoHint')}</small>
                        </div>

                        <div className="form-group">
                            <label>{t('clients.form.logoPreview')}</label>
                            <div className="logo-preview">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Client logo preview" />
                                ) : (
                                    <div className="logo-placeholder">{t('clients.form.noLogoSelected')}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('clients.form.basicInformation')}</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="name">{t('clients.form.nameEn')}</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="nameAr">{t('clients.form.nameAr')}</label>
                            <input
                                id="nameAr"
                                name="nameAr"
                                type="text"
                                value={formData.nameAr}
                                onChange={handleChange}
                                dir="rtl"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="email">{t('clients.form.email')}</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone">{t('clients.form.phone')}</label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="+966 5..."
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="websiteUrl">{t('clients.form.websiteUrl')}</label>
                            <input
                                id="websiteUrl"
                                name="websiteUrl"
                                type="url"
                                value={formData.websiteUrl}
                                onChange={handleChange}
                                placeholder="https://example.com"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="contactPerson">{t('clients.form.contactPerson')}</label>
                            <input
                                id="contactPerson"
                                name="contactPerson"
                                type="text"
                                value={formData.contactPerson}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="companyType">{t('clients.form.companyType')}</label>
                            <select
                                id="companyType"
                                name="companyType"
                                value={formData.companyType}
                                onChange={handleChange}
                            >
                                <option value="">{t('clients.form.selectCompanyType')}</option>
                                {COMPANY_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>
                                        {t(type.labelKey)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="companySector">{t('clients.form.companySector')}</label>
                            <select
                                id="companySector"
                                name="companySector"
                                value={formData.companySector}
                                onChange={handleChange}
                            >
                                <option value="">{t('clients.form.selectSector')}</option>
                                {COMPANY_SECTORS.map(sector => (
                                    <option key={sector} value={sector}>
                                        {getSectorLabel(sector)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('clients.form.address')}</h3>

                    <div className="address-grid">
                        <div className="form-group">
                            <label htmlFor="addressRegion">{t('clients.form.region')}</label>
                            <input
                                id="addressRegion"
                                name="addressRegion"
                                type="text"
                                value={formData.addressRegion}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressCity">{t('clients.form.city')}</label>
                            <input
                                id="addressCity"
                                name="addressCity"
                                type="text"
                                value={formData.addressCity}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressDistrict">{t('clients.form.district')}</label>
                            <input
                                id="addressDistrict"
                                name="addressDistrict"
                                type="text"
                                value={formData.addressDistrict}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressStreet">{t('clients.form.street')}</label>
                            <input
                                id="addressStreet"
                                name="addressStreet"
                                type="text"
                                value={formData.addressStreet}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressBuildingNumber">{t('clients.form.buildingNumber')}</label>
                            <input
                                id="addressBuildingNumber"
                                name="addressBuildingNumber"
                                type="text"
                                value={formData.addressBuildingNumber}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressAdditionalNumber">{t('clients.form.additionalNumber')}</label>
                            <input
                                id="addressAdditionalNumber"
                                name="addressAdditionalNumber"
                                type="text"
                                value={formData.addressAdditionalNumber}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressPostalCode">{t('clients.form.postalCode')}</label>
                            <input
                                id="addressPostalCode"
                                name="addressPostalCode"
                                type="text"
                                value={formData.addressPostalCode}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="addressUnitNumber">{t('clients.form.unitNumber')}</label>
                            <input
                                id="addressUnitNumber"
                                name="addressUnitNumber"
                                type="text"
                                value={formData.addressUnitNumber}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>{t('clients.form.subscription')}</h3>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="subscriptionTier">{t('clients.form.plan')}</label>
                            <select
                                id="subscriptionTier"
                                name="subscriptionTier"
                                value={formData.subscriptionTier}
                                onChange={handleChange}
                            >
                                <option value="basic">{t('clients.plan.basic')}</option>
                                <option value="pro">{t('clients.plan.pro')}</option>
                                <option value="enterprise">{t('clients.plan.enterprise')}</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="status">{t('clients.form.status')}</label>
                            <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                <option value="active">{t('clients.status.active')}</option>
                                <option value="inactive">{t('clients.status.inactive')}</option>
                                <option value="suspended">{t('clients.status.suspended')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="eventLimit">{t('clients.form.eventLimit')}</label>
                            <input
                                id="eventLimit"
                                name="eventLimit"
                                type="number"
                                min="1"
                                value={formData.eventLimit}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="guestLimit">{t('clients.form.guestLimit')}</label>
                            <input
                                id="guestLimit"
                                name="guestLimit"
                                type="number"
                                min="100"
                                value={formData.guestLimit}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/clients')}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? t('clients.form.saving') : mode === 'edit' ? t('clients.form.saveChanges') : t('clients.form.createClient')}
                    </button>
                </div>
            </form>
        </div>
    );
}
