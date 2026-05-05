import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Trash2, Maximize2 } from 'lucide-react';
import { buildCanvasBackgroundStyle, normalizeLayout } from '../backgroundUtils';
import { InvitationWidgetPreview } from './InvitationCanvasRenderer';
import BubbleBackground from './BubbleBackground';
import GravityStarsBackground from './GravityStarsBackground';
import StarsBackground from './StarsBackground';
import FireworksBackground from './FireworksBackground';
import HexagonBackground from './HexagonBackground';
import PrismBackground from './PrismBackground';
import DarkVeilBackground from './DarkVeilBackground';
import LightPillarBackground from './LightPillarBackground';
import SilkBackground from './SilkBackground';
import { buildBubbleRuntimeProps, buildDarkVeilRuntimeProps, buildFireworksRuntimeProps, buildGravityStarsRuntimeProps, buildHexagonRuntimeProps, buildLightPillarRuntimeProps, buildPrismRuntimeProps, buildSilkRuntimeProps, buildStarsRuntimeProps } from '../backgroundEffectCatalog';
import './BuilderCanvas.css';

function resolveEffectValue(effect, key, fallback) {
    return effect?.settings?.[key] ?? effect?.[key] ?? fallback;
}

const GRID_SIZE = 10;
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 640;

function DraggableResizableWidget({ widget, isSelected, onSelect, onUpdate, onDelete, activeLanguage }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const widgetRef = useRef(null);

    // Initial geometry if not set
    const x = widget.geometry?.x || 20;
    const y = widget.geometry?.y || 20;
    const w = widget.geometry?.w || 280;
    const h = widget.geometry?.h || 80;

    const handleMouseDown = (e, interactionType, handle) => {
        e.stopPropagation();
        onSelect(); // Select on click

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = x;
        const startTop = y;
        const startWidth = w;
        const startHeight = h;

        if (interactionType === 'drag') {
            setIsDragging(true);
        } else {
            setIsResizing(true);
        }

        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newGeometry = { x, y, w, h };

            if (interactionType === 'drag') {
                // Snap to grid
                let newX = Math.round((startLeft + deltaX) / GRID_SIZE) * GRID_SIZE;
                let newY = Math.round((startTop + deltaY) / GRID_SIZE) * GRID_SIZE;

                // constrain to canvas boundaries
                newX = Math.max(0, Math.min(newX, CANVAS_WIDTH - w));
                newY = Math.max(0, Math.min(newY, CANVAS_HEIGHT - h));

                newGeometry = { ...newGeometry, x: newX, y: newY };
            } else if (interactionType === 'resize') {
                let newW = startWidth;
                let newH = startHeight;
                let newX = startLeft;
                let newY = startTop;
                const aspectRatio = widget.config?.aspectRatio || (startHeight ? startWidth / startHeight : 1);

                // Simple bottom-right resize for now, or handle based on 'handle' param
                // Let's implement 4-corner resizing if requested, but bottom-right is easiest for MVP
                // User asked for "resize it", usually corner handles.

                const minWidgetSize = widget.type === 'qr_code' ? 100 : GRID_SIZE * 2;
                if (handle.includes('e')) newW = Math.max(minWidgetSize, Math.round((startWidth + deltaX) / GRID_SIZE) * GRID_SIZE);
                if (handle.includes('s')) newH = Math.max(minWidgetSize, Math.round((startHeight + deltaY) / GRID_SIZE) * GRID_SIZE);

                // Enforce Aspect Ratio for QR Code and Logo widgets
                if (widget.type === 'qr_code' || widget.type === 'logo') {
                    const lockedHeight = Math.max(minWidgetSize, Math.round(newW / aspectRatio / GRID_SIZE) * GRID_SIZE);
                    newH = lockedHeight;
                }

                // Constrain within absolute max width/height if needed, but allowing overflow is sometimes desired. 
                // Let's constrain width to canvas.
                if (newX + newW > CANVAS_WIDTH) newW = CANVAS_WIDTH - newX;

                // Re-apply aspect ratio if constraint reduced width
                if (widget.type === 'qr_code' || widget.type === 'logo') {
                    newH = Math.max(minWidgetSize, Math.round(newW / aspectRatio / GRID_SIZE) * GRID_SIZE);
                }

                newGeometry = { ...newGeometry, w: newW, h: newH };
            }

            onUpdate(newGeometry);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Style for the widget container
    // Style for the widget container
    const containerStyle = {
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: isSelected ? 100 : 1,
        fontSize: widget.style?.fontSize ? `${widget.style.fontSize}px` : undefined,
        textAlign: widget.style?.textAlign || 'center',
        padding: 0,
        backgroundColor: widget.style?.backgroundColor,
        color: widget.style?.color,
        fontFamily: widget.style?.fontFamily,
        fontWeight: widget.style?.fontWeight,
    };

    return (
        <div
            ref={widgetRef}
            className={`absolute-widget ${isSelected ? 'selected' : ''}`}
            style={containerStyle}
            onMouseDown={(e) => handleMouseDown(e, 'drag')}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Widget Content Rendering */}
            <div className="widget-inner-content" style={{ pointerEvents: 'none' }}>
                <InvitationWidgetPreview
                    widget={widget}
                    language={activeLanguage}
                    project={null}
                    recipient={{
                        public_token: null,
                        display_name: '',
                        display_name_ar: '',
                        metadata: {}
                    }}
                    mode="builder"
                />
            </div>

            {/* Controls only when selected */}
            {isSelected && (
                <>
                    <div className="resize-handle se" onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')} />
                    <button
                        className="delete-btn-abs"
                        onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <Trash2 size={12} />
                    </button>
                    <div className="dimensions-label">
                        {Math.round(w)} x {Math.round(h)}
                        <span className="coords">({x}, {y})</span>
                    </div>
                </>
            )}
        </div>
    );
}

export default function BuilderCanvas({ sections, selectedWidget, onSelectWidget, onUpdateWidget, onDeleteWidget, activeLanguage, designData, onUpdateDesign }) {
    const widgets = sections.body?.widgets || [];

    const { setNodeRef, isOver } = useDroppable({
        id: 'body',
        data: { sectionId: 'body' }
    });

    const layout = normalizeLayout(designData?.layout || {});
    const [isResizingCanvas, setIsResizingCanvas] = useState(false);
    // Use layout.height if saved, otherwise default 640. Min height 640.
    const savedHeight = Math.max(640, layout.height || 640);
    const [previewHeight, setPreviewHeight] = useState(null); // Local state for smooth dragging
    const activeHeight = previewHeight || savedHeight;

    const draggingHeightRef = useRef(savedHeight);

    const startResize = (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizingCanvas(true);

        const startY = e.clientY;
        const initialHeight = activeHeight;
        draggingHeightRef.current = initialHeight;

        const handleMove = (moveEvent) => {
            const delta = moveEvent.clientY - startY;
            let h = Math.round((initialHeight + delta) / GRID_SIZE) * GRID_SIZE;
            h = Math.max(640, h);
            draggingHeightRef.current = h;
            setPreviewHeight(h);
        };

        const handleUp = () => {
            setIsResizingCanvas(false);
            onUpdateDesign({
                ...designData,
                layout: { ...layout, height: draggingHeightRef.current }
            });
            setPreviewHeight(null);

            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    };

    const canvasStyle = {
        width: `${CANVAS_WIDTH}px`,
        height: `${activeHeight}px`,
        ...buildCanvasBackgroundStyle(layout),
        transition: isResizingCanvas ? 'none' : 'height 0.1s ease-out' // Disable transition during drag for responsiveness
    };

    const renderBackgroundEffect = (effect) => {
        if (effect.previewVariant === 'bubble') {
            const bubbleProps = buildBubbleRuntimeProps(effect);

            return (
                <BubbleBackground
                    key={effect.id}
                    {...bubbleProps}
                />
            );
        }

        if (effect.previewVariant === 'fireworks') {
            const fireworksProps = buildFireworksRuntimeProps(effect);

            return (
                <FireworksBackground
                    key={effect.id}
                    {...fireworksProps}
                />
            );
        }

        if (effect.previewVariant === 'gravity-stars') {
            const gravityStarsProps = buildGravityStarsRuntimeProps(effect);

            return (
                <GravityStarsBackground
                    key={effect.id}
                    {...gravityStarsProps}
                />
            );
        }

        if (effect.previewVariant === 'hexagon') {
            const hexagonProps = buildHexagonRuntimeProps(effect);

            return (
                <HexagonBackground
                    key={effect.id}
                    {...hexagonProps}
                />
            );
        }

        if (effect.previewVariant === 'stars') {
            const starsProps = buildStarsRuntimeProps(effect);

            return (
                <StarsBackground
                    key={effect.id}
                    {...starsProps}
                />
            );
        }

        if (effect.previewVariant === 'prism') {
            const prismProps = buildPrismRuntimeProps(effect);

            return (
                <PrismBackground
                    key={effect.id}
                    {...prismProps}
                />
            );
        }

        if (effect.previewVariant === 'dark-veil') {
            const darkVeilProps = buildDarkVeilRuntimeProps(effect);

            return (
                <DarkVeilBackground
                    key={effect.id}
                    {...darkVeilProps}
                />
            );
        }

        if (effect.previewVariant === 'light-pillar') {
            const lightPillarProps = buildLightPillarRuntimeProps(effect);

            return (
                <LightPillarBackground
                    key={effect.id}
                    {...lightPillarProps}
                />
            );
        }

        if (effect.previewVariant === 'silk') {
            const silkProps = buildSilkRuntimeProps(effect);

            return (
                <SilkBackground
                    key={effect.id}
                    {...silkProps}
                />
            );
        }

        return (
            <div
                key={effect.id}
                className={`background-effect background-effect-${effect.previewVariant || effect.type}`}
                style={{
                    '--effect-opacity': resolveEffectValue(effect, 'opacity', 0.18),
                    '--effect-speed': `${Math.max(1, Number(resolveEffectValue(effect, 'speed', 30)) || 1)}s`,
                    '--effect-amount': `${Math.max(0, Number(resolveEffectValue(effect, 'amount', 40)) || 0)}`,
                    '--effect-color': resolveEffectValue(effect, 'color', '#ffffff')
                }}
            />
        );
    };

    return (
        <div className="builder-canvas">
            <div className="canvas-wrapper">
                <div
                    ref={setNodeRef}
                    className={`canvas-device absolute-layout ${isOver ? 'drag-over' : ''}`}
                    style={canvasStyle}
                    onClick={() => onSelectWidget(null)}
                >
                    <div className="background-effects-layer" aria-hidden="true">
                        {(layout.backgroundEffects || []).map(renderBackgroundEffect)}
                    </div>

                    {/* Grid Overlay */}
                    {layout.showGrid !== false && (
                        <div className="grid-overlay" style={{ backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`, height: '100%' }} />
                    )}

                    {/* Widgets */}
                    {widgets.map(widget => (
                        <DraggableResizableWidget
                            key={widget.id}
                            widget={widget}
                            isSelected={selectedWidget?.id === widget.id}
                            onSelect={() => onSelectWidget(widget)}
                            onUpdate={(geo) => onUpdateWidget(widget.id, { geometry: geo })}
                            onDelete={() => onDeleteWidget(widget.id)}
                            activeLanguage={activeLanguage}
                        />
                    ))}

                    {widgets.length === 0 && !isOver && (
                        <div className="absolute-empty-state">
                            Drag widgets here
                        </div>
                    )}

                    {/* Canvas Height Resize Handle */}
                    <div
                        className={`canvas-resize-handle ${isResizingCanvas ? 'active' : ''}`}
                        onMouseDown={startResize}
                    >
                        <div className="handle-knob">
                            <Maximize2 size={12} className="rotate-45" />
                        </div>
                        <span className="handle-label">{activeHeight}px</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
