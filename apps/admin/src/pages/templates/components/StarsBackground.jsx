import * as React from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import './StarsBackground.css';

function mergeClassNames(...parts) {
    return parts.filter(Boolean).join(' ');
}

function generateStars(count, starColor) {
    const shadows = [];

    for (let i = 0; i < count; i += 1) {
        const x = Math.floor(Math.random() * 4000) - 2000;
        const y = Math.floor(Math.random() * 4000) - 2000;
        shadows.push(`${x}px ${y}px ${starColor}`);
    }

    return shadows.join(', ');
}

function StarLayer({
    count = 1000,
    size = 1,
    transition = { repeat: Infinity, duration: 50, ease: 'linear' },
    starColor = '#fff',
    className,
    ...props
}) {
    const [boxShadow, setBoxShadow] = React.useState('');

    React.useEffect(() => {
        setBoxShadow(generateStars(count, starColor));
    }, [count, starColor]);

    return (
        <motion.div
            data-slot="star-layer"
            animate={{ y: [0, -2000] }}
            transition={transition}
            className={mergeClassNames('stars-background-layer', className)}
            {...props}
        >
            <div
                className="stars-background-layer-point"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    boxShadow
                }}
            />
            <div
                className="stars-background-layer-point stars-background-layer-point-second"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    boxShadow
                }}
            />
        </motion.div>
    );
}

function StarsBackground(
    {
        children,
        className,
        factor = 0.05,
        speed = 50,
        transition = { stiffness: 50, damping: 20 },
        starColor = '#fff',
        pointerEvents = true,
        ...props
    },
    ref
) {
    const containerRef = React.useRef(null);
    const offsetX = useMotionValue(1);
    const offsetY = useMotionValue(1);
    const springX = useSpring(offsetX, transition);
    const springY = useSpring(offsetY, transition);

    React.useImperativeHandle(ref, () => containerRef.current);

    const handleMouseMove = React.useCallback((event) => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const newOffsetX = -(event.clientX - centerX) * factor;
        const newOffsetY = -(event.clientY - centerY) * factor;
        offsetX.set(newOffsetX);
        offsetY.set(newOffsetY);
    }, [factor, offsetX, offsetY]);

    return (
        <div
            ref={containerRef}
            data-slot="stars-background"
            className={mergeClassNames(
                'stars-background-root',
                !pointerEvents && 'stars-background-pointer-events-none',
                className
            )}
            onMouseMove={handleMouseMove}
            {...props}
        >
            <motion.div style={{ x: springX, y: springY }} className="stars-background-motion">
                <StarLayer
                    count={1000}
                    size={1}
                    transition={{ repeat: Infinity, duration: speed, ease: 'linear' }}
                    starColor={starColor}
                />
                <StarLayer
                    count={400}
                    size={2}
                    transition={{ repeat: Infinity, duration: speed * 2, ease: 'linear' }}
                    starColor={starColor}
                />
                <StarLayer
                    count={200}
                    size={3}
                    transition={{ repeat: Infinity, duration: speed * 3, ease: 'linear' }}
                    starColor={starColor}
                />
            </motion.div>
            {children}
        </div>
    );
}

const ForwardedStarsBackground = React.forwardRef(StarsBackground);
ForwardedStarsBackground.displayName = 'StarsBackground';

export { StarLayer };
export default ForwardedStarsBackground;
