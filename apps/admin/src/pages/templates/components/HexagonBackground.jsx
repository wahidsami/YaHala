import * as React from 'react';
import './HexagonBackground.css';

function mergeClassNames(...parts) {
    return parts.filter(Boolean).join(' ');
}

function HexagonBackground(
    {
        className,
        children,
        hexagonProps,
        hexagonSize = 75,
        hexagonMargin = 3,
        ...props
    },
    ref
) {
    const containerRef = React.useRef(null);
    const [gridDimensions, setGridDimensions] = React.useState({
        rows: 0,
        columns: 0
    });

    React.useImperativeHandle(ref, () => containerRef.current);

    const hexagonWidth = Number(hexagonSize) || 75;
    const hexagonHeight = hexagonWidth * 1.1;
    const rowSpacing = hexagonWidth * 0.8;
    const baseMarginTop = -36 - 0.275 * (hexagonWidth - 100);
    const computedMarginTop = baseMarginTop + Number(hexagonMargin || 0);
    const oddRowMarginLeft = -(hexagonWidth / 2);
    const evenRowMarginLeft = Number(hexagonMargin || 0) / 2;

    const updateGridDimensions = React.useCallback(() => {
        const container = containerRef.current;
        if (!container || typeof window === 'undefined') return;

        const rect = container.getBoundingClientRect();
        const rows = Math.ceil(rect.height / rowSpacing) + 1;
        const columns = Math.ceil(rect.width / hexagonWidth) + 1;
        setGridDimensions({ rows, columns });
    }, [hexagonWidth, rowSpacing]);

    React.useEffect(() => {
        updateGridDimensions();

        const container = containerRef.current;
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(updateGridDimensions)
            : null;

        if (container && resizeObserver) {
            resizeObserver.observe(container);
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateGridDimensions);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', updateGridDimensions);
            }
            if (resizeObserver && container) {
                resizeObserver.disconnect();
            }
        };
    }, [updateGridDimensions]);

    return (
        <div
            ref={containerRef}
            data-slot="hexagon-background"
            className={mergeClassNames('hexagon-background-root', className)}
            {...props}
        >
            <style>{`:root { --hexagon-margin: ${hexagonMargin}px; }`}</style>
            <div className="hexagon-background-grid">
                {Array.from({ length: gridDimensions.rows }).map((_, rowIndex) => (
                    <div
                        key={`row-${rowIndex}`}
                        className="hexagon-background-row"
                        style={{
                            marginTop: computedMarginTop,
                            marginLeft: ((rowIndex + 1) % 2 === 0 ? evenRowMarginLeft : oddRowMarginLeft) - 10
                        }}
                    >
                        {Array.from({ length: gridDimensions.columns }).map((_, colIndex) => (
                            <div
                                key={`hexagon-${rowIndex}-${colIndex}`}
                                {...hexagonProps}
                                style={{
                                    width: hexagonWidth,
                                    height: hexagonHeight,
                                    marginLeft: hexagonMargin,
                                    ...hexagonProps?.style
                                }}
                                className={mergeClassNames(
                                    'hexagon-background-cell',
                                    hexagonProps?.className
                                )}
                            />
                        ))}
                    </div>
                ))}
            </div>
            {children}
        </div>
    );
}

const ForwardedHexagonBackground = React.forwardRef(HexagonBackground);
ForwardedHexagonBackground.displayName = 'HexagonBackground';

export default ForwardedHexagonBackground;
