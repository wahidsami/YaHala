import { createBackgroundId } from './backgroundUtils';

export const BACKGROUND_EFFECT_LIBRARY = [
    {
        id: 'grain',
        label: 'Grain',
        group: 'Built-in',
        description: 'Subtle paper-like grain for premium invitation cards.',
        tags: ['paper', 'subtle', 'minimal'],
        installCommand: null,
        componentName: null,
        kind: 'native',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'grain',
        defaults: { amount: 40, speed: 30, opacity: 0.18, color: '#ffffff' },
        controls: [
            { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' }
        ]
    },
    {
        id: 'dots',
        label: 'Dots',
        group: 'Built-in',
        description: 'Soft dotted field for modern and playful invitations.',
        tags: ['pattern', 'light', 'abstract'],
        installCommand: null,
        componentName: null,
        kind: 'native',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'dots',
        defaults: { amount: 45, speed: 28, opacity: 0.18, color: '#ffffff' },
        controls: [
            { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' }
        ]
    },
    {
        id: 'glow',
        label: 'Glow',
        group: 'Built-in',
        description: 'Two soft luminous blobs that add depth and elegance.',
        tags: ['glow', 'soft', 'luxury'],
        installCommand: null,
        componentName: null,
        kind: 'native',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'glow',
        defaults: { amount: 55, speed: 30, opacity: 0.2, color: '#ffffff' },
        controls: [
            { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' }
        ]
    },
    {
        id: 'waves',
        label: 'Waves',
        group: 'Built-in',
        description: 'Subtle moving ribbons for an energetic background layer.',
        tags: ['motion', 'flow', 'accent'],
        installCommand: null,
        componentName: null,
        kind: 'native',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'waves',
        defaults: { amount: 35, speed: 26, opacity: 0.18, color: '#ffffff' },
        controls: [
            { key: 'amount', label: 'Amount', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' }
        ]
    },
    {
        id: 'bubble',
        label: 'Bubble',
        group: 'Motion',
        description: 'Interactive motion-powered bubbles for a playful premium feel.',
        tags: ['fun', 'premium', 'interactive'],
        installCommand: 'npm install motion',
        componentName: 'BubbleBackground',
        kind: 'package',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'bubble',
        defaults: {
            interactive: false,
            transitionStiffness: 100,
            transitionDamping: 20,
            colorFirst: '18,113,255',
            colorSecond: '221,74,255',
            colorThird: '0,220,255',
            colorFourth: '200,50,50',
            colorFifth: '180,180,50',
            colorSixth: '140,100,255'
        },
        controls: [
            { key: 'interactive', label: 'Interactive', type: 'checkbox' },
            { key: 'transitionStiffness', label: 'Spring Stiffness', type: 'range', min: 50, max: 200, step: 1 },
            { key: 'transitionDamping', label: 'Spring Damping', type: 'range', min: 0, max: 40, step: 1 },
            { key: 'colorFirst', label: 'Color 1', type: 'color' },
            { key: 'colorSecond', label: 'Color 2', type: 'color' },
            { key: 'colorThird', label: 'Color 3', type: 'color' },
            { key: 'colorFourth', label: 'Color 4', type: 'color' },
            { key: 'colorFifth', label: 'Color 5', type: 'color' },
            { key: 'colorSixth', label: 'Color 6', type: 'color' }
        ]
    },
    {
        id: 'fireworks',
        label: 'Fireworks',
        group: 'Canvas',
        description: 'Celebratory bursts for launch, approval, and event moments.',
        tags: ['celebration', 'burst', 'spark'],
        installCommand: null,
        componentName: 'FireworksBackground',
        kind: 'package',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'fireworks',
        defaults: {
            population: 1,
            fireworkSpeedMin: 4,
            fireworkSpeedMax: 8,
            fireworkSizeMin: 2,
            fireworkSizeMax: 5,
            particleSpeedMin: 2,
            particleSpeedMax: 7,
            particleSizeMin: 1,
            particleSizeMax: 5,
            color1: '#ff5c7c',
            color2: '#ffd166',
            color3: '#4cc9f0',
            color4: '#b5179e'
        },
        controls: [
            { key: 'population', label: 'Population', type: 'range', min: 1, max: 8, step: 1 },
            { key: 'fireworkSpeedMin', label: 'Firework Speed Min', type: 'range', min: 1, max: 20, step: 1 },
            { key: 'fireworkSpeedMax', label: 'Firework Speed Max', type: 'range', min: 2, max: 24, step: 1 },
            { key: 'fireworkSizeMin', label: 'Firework Size Min', type: 'range', min: 1, max: 10, step: 1 },
            { key: 'fireworkSizeMax', label: 'Firework Size Max', type: 'range', min: 1, max: 12, step: 1 },
            { key: 'particleSpeedMin', label: 'Particle Speed Min', type: 'range', min: 1, max: 15, step: 1 },
            { key: 'particleSpeedMax', label: 'Particle Speed Max', type: 'range', min: 1, max: 20, step: 1 },
            { key: 'particleSizeMin', label: 'Particle Size Min', type: 'range', min: 1, max: 8, step: 1 },
            { key: 'particleSizeMax', label: 'Particle Size Max', type: 'range', min: 1, max: 8, step: 1 },
            { key: 'color1', label: 'Color 1', type: 'color' },
            { key: 'color2', label: 'Color 2', type: 'color' },
            { key: 'color3', label: 'Color 3', type: 'color' },
            { key: 'color4', label: 'Color 4', type: 'color' }
        ]
    },
    {
        id: 'gravity_stars',
        label: 'Gravity Stars',
        group: 'Canvas',
        description: 'A floating starfield with an interactive gravity feel.',
        tags: ['space', 'interactive', 'stars'],
        installCommand: null,
        componentName: 'GravityStarsBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'gravity-stars',
        defaults: {
            starsCount: 75,
            starsSize: 2,
            starsOpacity: 0.75,
            glowIntensity: 15,
            glowAnimation: 'ease',
            movementSpeed: 0.3,
            mouseInfluence: 100,
            mouseGravity: 'attract',
            gravityStrength: 75,
            starsInteraction: false,
            starsInteractionType: 'bounce',
            color: '#f8fafc'
        },
        controls: [
            { key: 'starsCount', label: 'Star Count', type: 'range', min: 0, max: 250, step: 1 },
            { key: 'starsSize', label: 'Star Size', type: 'range', min: 1, max: 8, step: 0.1 },
            { key: 'starsOpacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'glowIntensity', label: 'Glow Intensity', type: 'range', min: 0, max: 40, step: 1 },
            { key: 'glowAnimation', label: 'Glow Animation', type: 'select', options: ['instant', 'ease', 'spring'] },
            { key: 'movementSpeed', label: 'Movement Speed', type: 'range', min: 0, max: 3, step: 0.05 },
            { key: 'mouseInfluence', label: 'Mouse Influence', type: 'range', min: 0, max: 300, step: 1 },
            { key: 'mouseGravity', label: 'Mouse Gravity', type: 'select', options: ['attract', 'repel'] },
            { key: 'gravityStrength', label: 'Gravity Strength', type: 'range', min: 0, max: 200, step: 1 },
            { key: 'starsInteraction', label: 'Star Interaction', type: 'checkbox' },
            { key: 'starsInteractionType', label: 'Interaction Type', type: 'select', options: ['bounce', 'merge'] },
            { key: 'color', label: 'Color', type: 'color' }
        ]
    },
    {
        id: 'hexagon',
        label: 'Hexagon',
        group: 'Canvas',
        description: 'A geometric grid that works well behind formal cards.',
        tags: ['geometry', 'grid', 'formal'],
        installCommand: null,
        componentName: 'HexagonBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'hexagon',
        defaults: {
            hexagonSize: 75,
            hexagonMargin: 3
        },
        controls: [
            { key: 'hexagonSize', label: 'Hexagon Size', type: 'range', min: 50, max: 150, step: 1 },
            { key: 'hexagonMargin', label: 'Hexagon Margin', type: 'range', min: 0, max: 20, step: 1 }
        ]
    },
    {
        id: 'stars',
        label: 'Stars',
        group: 'Motion',
        description: 'A starry field with subtle motion and twinkling points.',
        tags: ['space', 'night', 'twinkle'],
        installCommand: null,
        componentName: 'StarsBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'stars',
        defaults: {
            factor: 0.05,
            speed: 50,
            transitionStiffness: 50,
            transitionDamping: 20,
            starColor: '#ffffff',
            pointerEvents: true
        },
        controls: [
            { key: 'factor', label: 'Parallax Factor', type: 'range', min: 0, max: 0.2, step: 0.01 },
            { key: 'speed', label: 'Layer Speed', type: 'range', min: 10, max: 120, step: 1 },
            { key: 'transitionStiffness', label: 'Spring Stiffness', type: 'range', min: 10, max: 200, step: 1 },
            { key: 'transitionDamping', label: 'Spring Damping', type: 'range', min: 0, max: 50, step: 1 },
            { key: 'starColor', label: 'Star Color', type: 'color' },
            { key: 'pointerEvents', label: 'Pointer Events', type: 'checkbox' }
        ]
    },
    {
        id: 'dark_veil',
        label: 'Dark Veil',
        group: 'OGL',
        description: 'A cinematic dark veil with flame-like motion and scanlines.',
        tags: ['cinematic', 'dark', 'premium'],
        installCommand: null,
        componentName: 'DarkVeilBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient'],
        previewVariant: 'dark-veil',
        defaults: {
            hueShift: 0,
            noiseIntensity: 0,
            scanlineIntensity: 0,
            speed: 0.5,
            scanlineFrequency: 0,
            warpAmount: 0
        },
        controls: [
            { key: 'hueShift', label: 'Hue Shift', type: 'range', min: -180, max: 180, step: 1 },
            { key: 'noiseIntensity', label: 'Noise', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'scanlineIntensity', label: 'Scanlines', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05 },
            { key: 'scanlineFrequency', label: 'Scanline Frequency', type: 'range', min: 0, max: 100, step: 1 },
            { key: 'warpAmount', label: 'Warp', type: 'range', min: 0, max: 100, step: 1 }
        ]
    },
    {
        id: 'light_pillar',
        label: 'Light Pillar',
        group: 'Three',
        description: 'A luminous pillar with adjustable glow, rotation, and noise.',
        tags: ['glow', 'pillar', '3d'],
        installCommand: null,
        componentName: 'LightPillarBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'light-pillar',
        defaults: {
            topColor: '#5227FF',
            bottomColor: '#FF9FFC',
            intensity: 1,
            rotationSpeed: 0.3,
            interactive: false,
            glowAmount: 0.005,
            pillarWidth: 3,
            pillarHeight: 0.4,
            noiseIntensity: 0.5,
            mixBlendMode: 'screen',
            pillarRotation: 25,
            quality: 'high'
        },
        controls: [
            { key: 'topColor', label: 'Top Color', type: 'color' },
            { key: 'bottomColor', label: 'Bottom Color', type: 'color' },
            { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 3, step: 0.05 },
            { key: 'rotationSpeed', label: 'Rotation Speed', type: 'range', min: 0, max: 3, step: 0.05 },
            { key: 'glowAmount', label: 'Glow Amount', type: 'range', min: 0, max: 0.02, step: 0.0005 },
            { key: 'pillarWidth', label: 'Pillar Width', type: 'range', min: 1, max: 10, step: 0.1 },
            { key: 'pillarHeight', label: 'Pillar Height', type: 'range', min: 0.1, max: 2, step: 0.1 },
            { key: 'noiseIntensity', label: 'Noise Intensity', type: 'range', min: 0, max: 1, step: 0.05 },
            { key: 'pillarRotation', label: 'Pillar Rotation', type: 'range', min: -180, max: 180, step: 1 },
            { key: 'interactive', label: 'Interactive', type: 'checkbox' },
            { key: 'mixBlendMode', label: 'Blend Mode', type: 'select', options: ['screen', 'normal', 'overlay', 'multiply', 'lighten'] },
            { key: 'quality', label: 'Quality', type: 'select', options: ['low', 'medium', 'high'] }
        ]
    },
    {
        id: 'silk',
        label: 'Silk',
        group: 'R3F',
        description: 'A smooth flowing silk pattern with soft motion and color depth.',
        tags: ['flow', 'premium', 'texture'],
        installCommand: 'npx shadcn@latest add @react-bits/Silk-JS-CSS',
        componentName: 'SilkBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient', 'image'],
        previewVariant: 'silk',
        defaults: {
            speed: 5,
            scale: 1,
            color: '#7B7481',
            noiseIntensity: 1.5,
            rotation: 0
        },
        controls: [
            { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 10, step: 0.1 },
            { key: 'scale', label: 'Scale', type: 'range', min: 0.2, max: 3, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' },
            { key: 'noiseIntensity', label: 'Noise Intensity', type: 'range', min: 0, max: 5, step: 0.1 },
            { key: 'rotation', label: 'Rotation (deg)', type: 'range', min: -180, max: 180, step: 1 }
        ]
    },
    {
        id: 'prism',
        label: 'Prism',
        group: 'OGL',
        description: 'Spectrum colors with sparks and strong visual energy.',
        tags: ['spectrum', 'bold', 'glow'],
        installCommand: null,
        componentName: 'PrismBackground',
        kind: 'local',
        runtimeMode: 'local',
        compatibility: ['solid', 'gradient'],
        previewVariant: 'prism',
        defaults: {
            animationType: 'rotate',
            timeScale: 0.5,
            height: 3.5,
            baseWidth: 5.5,
            scale: 3.6,
            hueShift: 0,
            colorFrequency: 1,
            noise: 0.5,
            glow: 1,
            transparent: true,
            hoverStrength: 2,
            inertia: 0.05,
            bloom: 1,
            suspendWhenOffscreen: false
        },
        controls: [
            { key: 'animationType', label: 'Animation', type: 'select', options: ['rotate', 'hover', '3drotate'] },
            { key: 'timeScale', label: 'Time Scale', type: 'range', min: 0, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'range', min: 0, max: 10, step: 0.1 },
            { key: 'baseWidth', label: 'Base Width', type: 'range', min: 0, max: 12, step: 0.1 },
            { key: 'scale', label: 'Scale', type: 'range', min: 0, max: 10, step: 0.1 },
            { key: 'hueShift', label: 'Hue Shift', type: 'range', min: -180, max: 180, step: 1 },
            { key: 'colorFrequency', label: 'Color Frequency', type: 'range', min: 0, max: 5, step: 0.1 },
            { key: 'noise', label: 'Noise', type: 'range', min: 0, max: 10, step: 0.1 },
            { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 10, step: 0.1 },
            { key: 'transparent', label: 'Transparent', type: 'checkbox' },
            { key: 'hoverStrength', label: 'Hover Strength', type: 'range', min: 0, max: 5, step: 0.1 },
            { key: 'inertia', label: 'Inertia', type: 'range', min: 0, max: 1, step: 0.01 },
            { key: 'bloom', label: 'Bloom', type: 'range', min: 0, max: 5, step: 0.1 },
            { key: 'suspendWhenOffscreen', label: 'Suspend Offscreen', type: 'checkbox' }
        ]
    }
];

export function getBackgroundEffectDefinition(effectType) {
    return BACKGROUND_EFFECT_LIBRARY.find((effect) => effect.id === effectType) || BACKGROUND_EFFECT_LIBRARY[0];
}

export function createBackgroundEffectFromDefinition(effectType) {
    const definition = getBackgroundEffectDefinition(effectType);
    const defaults = definition.defaults || {};
    const isBubble = definition.id === 'bubble';
    const isFireworks = definition.id === 'fireworks';
    const isGravityStars = definition.id === 'gravity_stars';
    const isHexagon = definition.id === 'hexagon';
    const isStars = definition.id === 'stars';
    const isDarkVeil = definition.id === 'dark_veil';
    const isPrism = definition.id === 'prism';
    const isLightPillar = definition.id === 'light_pillar';
    const isSilk = definition.id === 'silk';

    return {
        id: createBackgroundId(),
        type: definition.id,
        previewVariant: definition.previewVariant || definition.id,
        label: definition.label,
        group: definition.group,
        kind: definition.kind,
        runtimeMode: definition.runtimeMode || 'css',
        tags: definition.tags || [],
        compatibility: definition.compatibility || [],
        source: definition.installCommand || definition.kind,
        installCommand: definition.installCommand,
        componentName: definition.componentName,
        ...(isBubble || isFireworks || isGravityStars || isHexagon || isStars || isPrism || isDarkVeil || isLightPillar || isSilk ? {} : {
            amount: defaults.amount ?? 40,
            speed: defaults.speed ?? 30,
            opacity: defaults.opacity ?? 0.18,
            color: defaults.color ?? '#ffffff'
        }),
        settings: { ...defaults }
    };
}

export function buildBubbleRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        interactive: Boolean(runtimeSettings.interactive),
        transition: {
            stiffness: Number(runtimeSettings.transitionStiffness ?? runtimeSettings.stiffness ?? 100),
            damping: Number(runtimeSettings.transitionDamping ?? runtimeSettings.damping ?? 20)
        },
        colors: {
            first: runtimeSettings.colorFirst || '18,113,255',
            second: runtimeSettings.colorSecond || '221,74,255',
            third: runtimeSettings.colorThird || '0,220,255',
            fourth: runtimeSettings.colorFourth || '200,50,50',
            fifth: runtimeSettings.colorFifth || '180,180,50',
            sixth: runtimeSettings.colorSixth || '140,100,255'
        }
    };
}

export function buildFireworksRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };
    const colors = [
        runtimeSettings.color1,
        runtimeSettings.color2,
        runtimeSettings.color3,
        runtimeSettings.color4
    ].filter(Boolean);

    return {
        population: Number(runtimeSettings.population ?? 1),
        color: colors.length > 1 ? colors : colors[0],
        fireworkSpeed: {
            min: Number(runtimeSettings.fireworkSpeedMin ?? 4),
            max: Number(runtimeSettings.fireworkSpeedMax ?? 8)
        },
        fireworkSize: {
            min: Number(runtimeSettings.fireworkSizeMin ?? 2),
            max: Number(runtimeSettings.fireworkSizeMax ?? 5)
        },
        particleSpeed: {
            min: Number(runtimeSettings.particleSpeedMin ?? 2),
            max: Number(runtimeSettings.particleSpeedMax ?? 7)
        },
        particleSize: {
            min: Number(runtimeSettings.particleSizeMin ?? 1),
            max: Number(runtimeSettings.particleSizeMax ?? 5)
        }
    };
}

export function buildGravityStarsRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        starsCount: Number(runtimeSettings.starsCount ?? runtimeSettings.amount ?? 75),
        starsSize: Number(runtimeSettings.starsSize ?? 2),
        starsOpacity: Number(runtimeSettings.starsOpacity ?? runtimeSettings.opacity ?? 0.75),
        glowIntensity: Number(runtimeSettings.glowIntensity ?? 15),
        glowAnimation: runtimeSettings.glowAnimation || 'ease',
        movementSpeed: Number(runtimeSettings.movementSpeed ?? runtimeSettings.speed ?? 0.3),
        mouseInfluence: Number(runtimeSettings.mouseInfluence ?? 100),
        mouseGravity: runtimeSettings.mouseGravity || 'attract',
        gravityStrength: Number(runtimeSettings.gravityStrength ?? 75),
        starsInteraction: Boolean(runtimeSettings.starsInteraction),
        starsInteractionType: runtimeSettings.starsInteractionType || 'bounce',
        color: runtimeSettings.color || '#f8fafc'
    };
}

export function buildHexagonRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        hexagonSize: Number(runtimeSettings.hexagonSize ?? 75),
        hexagonMargin: Number(runtimeSettings.hexagonMargin ?? 3)
    };
}

export function buildStarsRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        factor: Number(runtimeSettings.factor ?? 0.05),
        speed: Number(runtimeSettings.speed ?? 50),
        transition: {
            stiffness: Number(runtimeSettings.transitionStiffness ?? 50),
            damping: Number(runtimeSettings.transitionDamping ?? 20)
        },
        starColor: runtimeSettings.starColor || '#ffffff',
        pointerEvents: runtimeSettings.pointerEvents !== false
    };
}

export function buildPrismRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        animationType: runtimeSettings.animationType || 'rotate',
        height: Number(runtimeSettings.height ?? 3.5),
        baseWidth: Number(runtimeSettings.baseWidth ?? 5.5),
        glow: Number(runtimeSettings.glow ?? 1),
        offset: {
            x: Number(runtimeSettings.offsetX ?? runtimeSettings.offset?.x ?? 0),
            y: Number(runtimeSettings.offsetY ?? runtimeSettings.offset?.y ?? 0)
        },
        noise: Number(runtimeSettings.noise ?? 0.5),
        transparent: runtimeSettings.transparent !== false,
        scale: Number(runtimeSettings.scale ?? 3.6),
        hueShift: Number(runtimeSettings.hueShift ?? 0),
        colorFrequency: Number(runtimeSettings.colorFrequency ?? 1),
        hoverStrength: Number(runtimeSettings.hoverStrength ?? 2),
        inertia: Number(runtimeSettings.inertia ?? 0.05),
        bloom: Number(runtimeSettings.bloom ?? 1),
        suspendWhenOffscreen: Boolean(runtimeSettings.suspendWhenOffscreen),
        timeScale: Number(runtimeSettings.timeScale ?? 0.5)
    };
}

export function buildDarkVeilRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        hueShift: Number(runtimeSettings.hueShift ?? 0),
        noiseIntensity: Number(runtimeSettings.noiseIntensity ?? 0),
        scanlineIntensity: Number(runtimeSettings.scanlineIntensity ?? 0),
        speed: Number(runtimeSettings.speed ?? 0.5),
        scanlineFrequency: Number(runtimeSettings.scanlineFrequency ?? 0),
        warpAmount: Number(runtimeSettings.warpAmount ?? 0),
        resolutionScale: Number(runtimeSettings.resolutionScale ?? 1)
    };
}

export function buildLightPillarRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        topColor: runtimeSettings.topColor || '#5227FF',
        bottomColor: runtimeSettings.bottomColor || '#FF9FFC',
        intensity: Number(runtimeSettings.intensity ?? 1),
        rotationSpeed: Number(runtimeSettings.rotationSpeed ?? 0.3),
        interactive: Boolean(runtimeSettings.interactive),
        glowAmount: Number(runtimeSettings.glowAmount ?? 0.005),
        pillarWidth: Number(runtimeSettings.pillarWidth ?? 3),
        pillarHeight: Number(runtimeSettings.pillarHeight ?? 0.4),
        noiseIntensity: Number(runtimeSettings.noiseIntensity ?? 0.5),
        mixBlendMode: runtimeSettings.mixBlendMode || 'screen',
        pillarRotation: Number(runtimeSettings.pillarRotation ?? 25),
        quality: runtimeSettings.quality || 'high'
    };
}

export function buildSilkRuntimeProps(effect = {}) {
    const settings = effect.settings || {};
    const runtimeSettings = {
        ...settings,
        ...effect
    };

    return {
        speed: Number(runtimeSettings.speed ?? 5),
        scale: Number(runtimeSettings.scale ?? 1),
        color: runtimeSettings.color || '#7B7481',
        noiseIntensity: Number(runtimeSettings.noiseIntensity ?? 1.5),
        rotation: Number(runtimeSettings.rotation ?? 0) * (Math.PI / 180)
    };
}

export function buildBackgroundEffectThumbnailStyle(effectType) {
    const definition = getBackgroundEffectDefinition(effectType);
    const accent = definition.defaults?.color || '#38bdf8';

    switch (definition.previewVariant) {
        case 'bubble':
            return {
                backgroundImage: `
                    radial-gradient(circle at 20% 25%, rgba(255,255,255,0.85) 0 10%, transparent 12%),
                    radial-gradient(circle at 65% 35%, color-mix(in srgb, ${accent} 45%, white) 0 12%, transparent 15%),
                    radial-gradient(circle at 45% 75%, color-mix(in srgb, ${accent} 70%, white) 0 16%, transparent 19%),
                    linear-gradient(135deg, ${accent} 0%, #0f172a 100%)
                `,
                backgroundSize: 'cover'
            };
        case 'fireworks':
            return {
                backgroundImage: `
                    radial-gradient(circle at 25% 30%, rgba(255,255,255,0.95) 0 7%, transparent 10%),
                    radial-gradient(circle at 70% 35%, ${accent} 0 10%, transparent 14%),
                    radial-gradient(circle at 50% 70%, color-mix(in srgb, ${accent} 70%, white) 0 12%, transparent 16%),
                    linear-gradient(160deg, #020617 0%, #7c2d12 100%)
                `,
                backgroundSize: 'cover'
            };
        case 'gravity-stars':
        case 'stars':
            return {
                backgroundImage: `
                    radial-gradient(circle at 20% 25%, rgba(255,255,255,0.95) 0 2px, transparent 3px),
                    radial-gradient(circle at 62% 42%, rgba(255,255,255,0.8) 0 1.5px, transparent 3px),
                    radial-gradient(circle at 78% 70%, ${accent} 0 2px, transparent 4px),
                    linear-gradient(135deg, #020617 0%, #0f172a 100%)
                `,
                backgroundSize: 'cover'
            };
        case 'hexagon':
            return {
                backgroundImage: `
                    linear-gradient(30deg, ${accent} 12%, transparent 12.5%, transparent 87%, ${accent} 87.5%, ${accent}),
                    linear-gradient(150deg, ${accent} 12%, transparent 12.5%, transparent 87%, ${accent} 87.5%, ${accent}),
                    linear-gradient(90deg, ${accent} 2%, transparent 2.5%, transparent 97%, ${accent} 97.5%, ${accent}),
                    linear-gradient(135deg, #0f172a 0%, #1e293b 100%)
                `,
                backgroundSize: '24px 42px'
            };
        case 'dark-veil':
            return {
                backgroundImage: `
                    radial-gradient(circle at 25% 35%, color-mix(in srgb, ${accent} 35%, transparent) 0 14%, transparent 35%),
                    radial-gradient(circle at 70% 55%, rgba(255,255,255,0.09) 0 18%, transparent 38%),
                    linear-gradient(135deg, #020202 0%, #1f0f12 100%)
                `,
                backgroundSize: 'cover'
            };
        case 'light-pillar':
            return {
                backgroundImage: `
                    radial-gradient(circle at 50% 25%, color-mix(in srgb, ${definition.defaults?.topColor || '#5227FF'} 60%, white) 0 10%, transparent 24%),
                    radial-gradient(circle at 50% 70%, color-mix(in srgb, ${definition.defaults?.bottomColor || '#FF9FFC'} 60%, white) 0 16%, transparent 34%),
                    linear-gradient(135deg, #050816 0%, #1d1137 45%, #0b1020 100%)
                `,
                backgroundSize: 'cover'
            };
        case 'silk':
            return {
                backgroundImage: `
                    linear-gradient(135deg, color-mix(in srgb, ${accent} 45%, #ffffff) 0%, #7b7481 35%, #2b1f36 65%, #0f172a 100%),
                    repeating-linear-gradient(115deg, rgba(255,255,255,0.15) 0 3px, transparent 3px 8px),
                    radial-gradient(circle at 25% 30%, rgba(255,255,255,0.18), transparent 32%)
                `,
                backgroundSize: 'cover'
            };
        case 'prism':
            return {
                backgroundImage: `
                    linear-gradient(135deg, #ff00cc 0%, #3333ff 35%, #00d4ff 65%, #00ff88 100%),
                    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35), transparent 55%)
                `,
                backgroundSize: 'cover'
            };
        case 'grain':
        case 'dots':
        case 'glow':
        case 'waves':
        default:
            return {
                backgroundImage: `
                    radial-gradient(circle at 30% 30%, color-mix(in srgb, ${accent} 35%, white) 0 14%, transparent 16%),
                    linear-gradient(135deg, ${accent} 0%, #f8fafc 100%)
                `,
                backgroundSize: 'cover'
            };
    }
}
