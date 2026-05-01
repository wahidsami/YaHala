export const BACKGROUND_TYPES = [
    { value: 'solid', label: 'Solid Color' },
    { value: 'gradient', label: 'Gradient' },
    { value: 'image', label: 'Image' }
];

export const GRADIENT_TYPES = [
    { value: 'linear', label: 'Linear' },
    { value: 'radial', label: 'Radial' },
    { value: 'conic', label: 'Conic' }
];

export const BACKGROUND_EFFECT_TYPES = [
    { value: 'grain', label: 'Grain' },
    { value: 'dots', label: 'Dots' },
    { value: 'glow', label: 'Glow' },
    { value: 'waves', label: 'Waves' }
];

export function createBackgroundId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `bg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createDefaultBackgroundEffect() {
    return {
        id: createBackgroundId(),
        type: 'grain',
        amount: 40,
        speed: 30,
        opacity: 0.18,
        color: '#ffffff'
    };
}

export function normalizeBackgroundEffect(effect = {}) {
    const settings = effect.settings && typeof effect.settings === 'object' ? { ...effect.settings } : {};

    return {
        ...effect,
        id: effect.id || createBackgroundId(),
        type: effect.type || 'grain',
        previewVariant: effect.previewVariant || effect.type || 'grain',
        amount: Number.isFinite(Number(settings.amount))
            ? Number(settings.amount)
            : (Number.isFinite(Number(effect.amount)) ? Number(effect.amount) : 40),
        speed: Number.isFinite(Number(settings.speed))
            ? Number(settings.speed)
            : (Number.isFinite(Number(effect.speed)) ? Number(effect.speed) : 30),
        opacity: Number.isFinite(Number(settings.opacity))
            ? Number(settings.opacity)
            : (Number.isFinite(Number(effect.opacity)) ? Number(effect.opacity) : 0.18),
        color: settings.color || effect.color || '#ffffff',
        settings
    };
}

export function normalizeLayout(layout = {}) {
    const backgroundType = layout.backgroundType || (layout.backgroundImage ? 'image' : layout.backgroundGradient ? 'gradient' : 'solid');
    const fallbackColor = layout.backgroundColor || layout.background || '#ffffff';
    const backgroundGradient = layout.backgroundGradient || {};

    return {
        ...layout,
        backgroundType,
        backgroundColor: fallbackColor,
        backgroundImage: layout.backgroundImage || '',
        backgroundSize: layout.backgroundSize || 'cover',
        showGrid: layout.showGrid !== false,
        backgroundGradient: {
            type: backgroundGradient.type || 'linear',
            angle: Number.isFinite(Number(backgroundGradient.angle)) ? Number(backgroundGradient.angle) : 135,
            from: backgroundGradient.from || fallbackColor,
            to: backgroundGradient.to || '#dbeafe',
            middle: backgroundGradient.middle || '',
            position: backgroundGradient.position || 'center'
        },
        backgroundEffects: Array.isArray(layout.backgroundEffects)
            ? layout.backgroundEffects.map((effect) => normalizeBackgroundEffect(effect))
            : []
    };
}

export function buildGradientCss(gradient = {}, fallbackColor = '#ffffff') {
    const type = gradient.type || 'linear';
    const from = gradient.from || fallbackColor;
    const middle = gradient.middle;
    const to = gradient.to || fallbackColor;
    const angle = Number.isFinite(Number(gradient.angle)) ? Number(gradient.angle) : 135;
    const position = gradient.position || 'center';

    if (type === 'radial') {
        return middle
            ? `radial-gradient(circle at ${position}, ${from} 0%, ${middle} 48%, ${to} 100%)`
            : `radial-gradient(circle at ${position}, ${from} 0%, ${to} 100%)`;
    }

    if (type === 'conic') {
        return middle
            ? `conic-gradient(from ${angle}deg at ${position}, ${from} 0deg, ${middle} 180deg, ${to} 360deg)`
            : `conic-gradient(from ${angle}deg at ${position}, ${from}, ${to})`;
    }

    return middle
        ? `linear-gradient(${angle}deg, ${from} 0%, ${middle} 50%, ${to} 100%)`
        : `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
}

export function buildCanvasBackgroundStyle(layout = {}) {
    const normalizedLayout = normalizeLayout(layout);

    if (normalizedLayout.backgroundType === 'image' && normalizedLayout.backgroundImage) {
        return {
            backgroundColor: normalizedLayout.backgroundColor,
            backgroundImage: `url(${normalizedLayout.backgroundImage})`,
            backgroundSize: normalizedLayout.backgroundSize || 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        };
    }

    if (normalizedLayout.backgroundType === 'gradient') {
        return {
            backgroundColor: normalizedLayout.backgroundColor,
            backgroundImage: buildGradientCss(normalizedLayout.backgroundGradient, normalizedLayout.backgroundColor),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        };
    }

    return {
        backgroundColor: normalizedLayout.backgroundColor,
        backgroundImage: 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
    };
}
