import * as React from 'react';
import {
    motion,
    useMotionValue,
    useSpring
} from 'motion/react';
import './BubbleBackground.css';

function mergeClassNames(...parts) {
    return parts.filter(Boolean).join(' ');
}

function buildCssVars(colors) {
    return {
        '--first-color': colors.first,
        '--second-color': colors.second,
        '--third-color': colors.third,
        '--fourth-color': colors.fourth,
        '--fifth-color': colors.fifth,
        '--sixth-color': colors.sixth
    };
}

function BubbleBackground(
    {
        className,
        style,
        children,
        interactive = false,
        transition = { stiffness: 100, damping: 20 },
        colors = {
            first: '18,113,255',
            second: '221,74,255',
            third: '0,220,255',
            fourth: '200,50,50',
            fifth: '180,180,50',
            sixth: '140,100,255'
        },
        ...props
    },
    ref
) {
    const containerRef = React.useRef(null);
    const filterId = React.useId().replace(/:/g, '');

    React.useImperativeHandle(ref, () => containerRef.current);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const springX = useSpring(mouseX, transition);
    const springY = useSpring(mouseY, transition);

    const rectRef = React.useRef(null);
    const rafIdRef = React.useRef(null);

    React.useLayoutEffect(() => {
        const updateRect = () => {
            if (containerRef.current) {
                rectRef.current = containerRef.current.getBoundingClientRect();
            }
        };

        updateRect();

        const element = containerRef.current;
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateRect) : null;

        if (element && observer) {
            observer.observe(element);
        }

        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, { passive: true });

        return () => {
            if (observer) {
                observer.disconnect();
            }
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, []);

    React.useEffect(() => {
        if (!interactive) return undefined;

        const element = containerRef.current;
        if (!element) return undefined;

        const handleMouseMove = (event) => {
            const rect = rectRef.current;
            if (!rect) return;

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            if (rafIdRef.current != null) {
                cancelAnimationFrame(rafIdRef.current);
            }

            rafIdRef.current = requestAnimationFrame(() => {
                mouseX.set(event.clientX - centerX);
                mouseY.set(event.clientY - centerY);
            });
        };

        element.addEventListener('mousemove', handleMouseMove, { passive: true });

        return () => {
            element.removeEventListener('mousemove', handleMouseMove);

            if (rafIdRef.current != null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, [interactive, mouseX, mouseY]);

    return (
        <div
            ref={containerRef}
            data-slot="bubble-background"
            className={mergeClassNames('bubble-background-root', className)}
            style={{ ...buildCssVars(colors), ...style }}
            {...props}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="bubble-background-sprite">
                <defs>
                    <filter id={`goo-${filterId}`}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
                            result="goo"
                        />
                        <feBlend in="SourceGraphic" in2="goo" />
                    </filter>
                </defs>
            </svg>

            <div className="bubble-background-viewport" style={{ filter: `url(#goo-${filterId}) blur(40px)` }}>
                <motion.div
                    className="bubble-background-bubble bubble-background-bubble-first"
                    animate={{ y: [-50, 50, -50] }}
                    transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
                    style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                />

                <motion.div
                    className="bubble-background-bubble bubble-background-bubble-second"
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 20,
                        ease: 'linear',
                        repeat: Infinity,
                        repeatType: 'loop'
                    }}
                    style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                />

                <motion.div
                    className="bubble-background-bubble bubble-background-bubble-third"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
                    style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                />

                <motion.div
                    className="bubble-background-bubble bubble-background-bubble-fourth"
                    animate={{ x: [-50, 50, -50] }}
                    transition={{ duration: 40, ease: 'easeInOut', repeat: Infinity }}
                    style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                />

                <motion.div
                    className="bubble-background-bubble bubble-background-bubble-fifth"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
                    style={{ transform: 'translateZ(0)', willChange: 'transform' }}
                />

                {interactive && (
                    <motion.div
                        className="bubble-background-bubble bubble-background-bubble-sixth"
                        style={{
                            x: springX,
                            y: springY,
                            transform: 'translateZ(0)',
                            willChange: 'transform'
                        }}
                    />
                )}
            </div>

            {children}
        </div>
    );
}

export default React.forwardRef(BubbleBackground);
