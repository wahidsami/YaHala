import { buildCanvasBackgroundStyle, normalizeLayout } from '../backgroundUtils';
import { InvitationWidgetPreview, computeEffectiveCanvasHeight } from './InvitationCanvasRenderer';
import BubbleBackground from './BubbleBackground';
import GravityStarsBackground from './GravityStarsBackground';
import StarsBackground from './StarsBackground';
import FireworksBackground from './FireworksBackground';
import HexagonBackground from './HexagonBackground';
import PrismBackground from './PrismBackground';
import DarkVeilBackground from './DarkVeilBackground';
import LightPillarBackground from './LightPillarBackground';
import SilkBackground from './SilkBackground';
import {
    buildBubbleRuntimeProps,
    buildDarkVeilRuntimeProps,
    buildFireworksRuntimeProps,
    buildGravityStarsRuntimeProps,
    buildHexagonRuntimeProps,
    buildLightPillarRuntimeProps,
    buildPrismRuntimeProps,
    buildSilkRuntimeProps,
    buildStarsRuntimeProps
} from '../backgroundEffectCatalog';
import '../../public-invitations/PublicInvitationPage.css';

const EMPTY_RECIPIENT = {
    public_token: null,
    display_name: '',
    display_name_ar: '',
    metadata: {}
};

function getWidgetFrameStyle(widget, index = 0) {
    const geometry = widget?.geometry || {};
    const left = Number.isFinite(Number(geometry.x)) ? Number(geometry.x) : 20;
    const top = Number.isFinite(Number(geometry.y)) ? Number(geometry.y) : 20;
    const width = Number.isFinite(Number(geometry.w)) ? Number(geometry.w) : Number.isFinite(Number(geometry.width)) ? Number(geometry.width) : 280;
    const height = Number.isFinite(Number(geometry.h)) ? Number(geometry.h) : Number.isFinite(Number(geometry.height)) ? Number(geometry.height) : 80;
    const zIndex = Number.isFinite(Number(geometry.zIndex)) ? Number(geometry.zIndex) : index + 1;

    return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex
    };
}

function getCanvasWidgets(coverTemplate) {
    const sections = coverTemplate?.sections || {};
    const preferredOrder = ['header', 'body', 'footer'];
    const orderedSections = [
        ...preferredOrder
            .filter((sectionId) => sections?.[sectionId])
            .map((sectionId) => sections[sectionId]),
        ...Object.entries(sections)
            .filter(([sectionId]) => !preferredOrder.includes(sectionId))
            .map(([, section]) => section)
    ];

    return orderedSections.flatMap((section) => section.widgets || []);
}

function renderBackgroundEffect(effect) {
    if (effect.previewVariant === 'bubble') {
        return <BubbleBackground key={effect.id} {...buildBubbleRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'fireworks') {
        return <FireworksBackground key={effect.id} {...buildFireworksRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'gravity-stars') {
        return <GravityStarsBackground key={effect.id} {...buildGravityStarsRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'hexagon') {
        return <HexagonBackground key={effect.id} {...buildHexagonRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'stars') {
        return <StarsBackground key={effect.id} {...buildStarsRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'prism') {
        return <PrismBackground key={effect.id} {...buildPrismRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'dark-veil') {
        return <DarkVeilBackground key={effect.id} {...buildDarkVeilRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'light-pillar') {
        return <LightPillarBackground key={effect.id} {...buildLightPillarRuntimeProps(effect)} />;
    }

    if (effect.previewVariant === 'silk') {
        return <SilkBackground key={effect.id} {...buildSilkRuntimeProps(effect)} />;
    }

    return (
        <div
            key={effect.id}
            className={`preview-effect preview-effect-${effect.previewVariant || effect.type}`}
            style={{
                '--effect-opacity': effect.opacity ?? 0.18,
                '--effect-speed': `${Math.max(1, Number(effect.speed) || 1)}s`,
                '--effect-amount': `${Math.max(0, Number(effect.amount) || 0)}`,
                '--effect-color': effect.color || '#ffffff'
            }}
        />
    );
}

export default function TemplatePreviewCanvas({ designData, language = 'ar', canvasHeight: canvasHeightOverride }) {
    const coverTemplate = designData || {};
    const layout = normalizeLayout(coverTemplate.layout || {});
    const canvasWidgets = getCanvasWidgets(coverTemplate);
    const inferredHeight = computeEffectiveCanvasHeight(layout, canvasWidgets);
    const canvasHeight = Math.max(640, Number(canvasHeightOverride) || inferredHeight);

    if (!canvasWidgets.length) {
        return (
            <div className="invitation-canvas-view invitation-canvas">
                <div className="fallback-cover">
                    <h2>No widgets in this template</h2>
                    <p>The template canvas is empty, so there is nothing to preview yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="invitation-canvas-view invitation-canvas"
            style={{ '--preview-canvas-height': `${canvasHeight}px` }}
        >
            <div className="template-canvas-stage">
                <div
                    className="public-invite-canvas public-canvas-stage"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                    style={{
                        ...buildCanvasBackgroundStyle(layout),
                        height: `${canvasHeight}px`
                    }}
                >
                    <div className="preview-effects-layer" aria-hidden="true">
                        {Array.isArray(layout.backgroundEffects) && layout.backgroundEffects.map(renderBackgroundEffect)}
                    </div>

                    {canvasWidgets.map((widget, index) => (
                        <div
                            key={widget.id || `${widget.type}-${index}`}
                            className="public-widget-frame"
                            style={getWidgetFrameStyle(widget, index)}
                        >
                            <InvitationWidgetPreview
                                widget={widget}
                                language={language}
                                project={null}
                                recipient={EMPTY_RECIPIENT}
                                mode="builder"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
