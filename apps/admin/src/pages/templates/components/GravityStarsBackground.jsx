import * as React from 'react';
import './GravityStarsBackground.css';

function mergeClassNames(...parts) {
    return parts.filter(Boolean).join(' ');
}

const createParticle = (w, h, starsSize, starsOpacity, movementSpeed) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = movementSpeed * (0.5 + Math.random() * 0.5);

    return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * starsSize + 1,
        opacity: starsOpacity,
        baseOpacity: starsOpacity,
        mass: Math.random() * 0.5 + 0.5,
        glowMultiplier: 1,
        glowVelocity: 0
    };
};

function GravityStarsBackground(
    {
        className,
        color = '#f8fafc',
        starsCount = 75,
        starsSize = 2,
        starsOpacity = 0.75,
        glowIntensity = 15,
        glowAnimation = 'ease',
        movementSpeed = 0.3,
        mouseInfluence = 100,
        mouseGravity = 'attract',
        gravityStrength = 75,
        starsInteraction = false,
        starsInteractionType = 'bounce',
        ...props
    },
    ref
) {
    const containerRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const animRef = React.useRef(null);
    const starsRef = React.useRef([]);
    const mouseRef = React.useRef({ x: 0, y: 0 });
    const [dpr, setDpr] = React.useState(1);
    const [canvasSize, setCanvasSize] = React.useState({ width: 800, height: 600 });

    React.useImperativeHandle(ref, () => containerRef.current);

    const initStars = React.useCallback(
        (w, h) => {
            starsRef.current = Array.from({ length: Math.max(0, Number(starsCount) || 0) }, () =>
                createParticle(
                    w,
                    h,
                    Number(starsSize) || 2,
                    Number(starsOpacity) || 0.75,
                    Number(movementSpeed) || 0.3
                )
            );
        },
        [movementSpeed, starsCount, starsOpacity, starsSize]
    );

    const redistributeStars = React.useCallback((w, h) => {
        starsRef.current.forEach((particle) => {
            particle.x = Math.random() * w;
            particle.y = Math.random() * h;
        });
    }, []);

    const resizeCanvas = React.useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const nextDpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        setDpr(nextDpr);
        canvas.width = Math.max(1, Math.floor(rect.width * nextDpr));
        canvas.height = Math.max(1, Math.floor(rect.height * nextDpr));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        setCanvasSize({ width: rect.width, height: rect.height });

        if (starsRef.current.length === 0) {
            initStars(rect.width, rect.height);
        } else {
            redistributeStars(rect.width, rect.height);
        }
    }, [initStars, redistributeStars]);

    const handlePointerMove = React.useCallback((event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        let clientX = 0;
        let clientY = 0;

        if ('touches' in event) {
            const touch = event.touches[0];
            if (!touch) return;
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        mouseRef.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }, []);

    const updateStars = React.useCallback(() => {
        const w = canvasSize.width;
        const h = canvasSize.height;
        const mouse = mouseRef.current;

        for (let i = 0; i < starsRef.current.length; i += 1) {
            const particle = starsRef.current[i];
            const dx = mouse.x - particle.x;
            const dy = mouse.y - particle.y;
            const dist = Math.hypot(dx, dy);

            if (dist < mouseInfluence && dist > 0) {
                const force = (mouseInfluence - dist) / mouseInfluence;
                const nx = dx / dist;
                const ny = dy / dist;
                const gravity = force * (gravityStrength * 0.001);

                if (mouseGravity === 'attract') {
                    particle.vx += nx * gravity;
                    particle.vy += ny * gravity;
                } else {
                    particle.vx -= nx * gravity;
                    particle.vy -= ny * gravity;
                }

                particle.opacity = Math.min(1, particle.baseOpacity + force * 0.4);

                const targetGlow = 1 + force * 2;
                const currentGlow = particle.glowMultiplier || 1;

                if (glowAnimation === 'instant') {
                    particle.glowMultiplier = targetGlow;
                } else if (glowAnimation === 'ease') {
                    particle.glowMultiplier = currentGlow + (targetGlow - currentGlow) * 0.15;
                } else {
                    const spring = (targetGlow - currentGlow) * 0.2;
                    particle.glowVelocity = (particle.glowVelocity || 0) * 0.85 + spring;
                    particle.glowMultiplier = currentGlow + (particle.glowVelocity || 0);
                }
            } else {
                particle.opacity = Math.max(particle.baseOpacity * 0.3, particle.opacity - 0.02);

                const targetGlow = 1;
                const currentGlow = particle.glowMultiplier || 1;

                if (glowAnimation === 'instant') {
                    particle.glowMultiplier = targetGlow;
                } else if (glowAnimation === 'ease') {
                    particle.glowMultiplier = Math.max(1, currentGlow + (targetGlow - currentGlow) * 0.08);
                } else {
                    const spring = (targetGlow - currentGlow) * 0.15;
                    particle.glowVelocity = (particle.glowVelocity || 0) * 0.9 + spring;
                    particle.glowMultiplier = Math.max(1, currentGlow + (particle.glowVelocity || 0));
                }
            }

            if (starsInteraction) {
                for (let j = i + 1; j < starsRef.current.length; j += 1) {
                    const other = starsRef.current[j];
                    const dx2 = other.x - particle.x;
                    const dy2 = other.y - particle.y;
                    const distance = Math.hypot(dx2, dy2);
                    const minDistance = particle.size + other.size + 5;

                    if (distance < minDistance && distance > 0) {
                        if (starsInteractionType === 'bounce') {
                            const nx = dx2 / distance;
                            const ny = dy2 / distance;
                            const rvx = particle.vx - other.vx;
                            const rvy = particle.vy - other.vy;
                            const speed = rvx * nx + rvy * ny;

                            if (speed < 0) continue;

                            const impulse = (2 * speed) / (particle.mass + other.mass);
                            particle.vx -= impulse * other.mass * nx;
                            particle.vy -= impulse * other.mass * ny;
                            other.vx += impulse * particle.mass * nx;
                            other.vy += impulse * particle.mass * ny;

                            const overlap = minDistance - distance;
                            const sx = nx * overlap * 0.5;
                            const sy = ny * overlap * 0.5;
                            particle.x -= sx;
                            particle.y -= sy;
                            other.x += sx;
                            other.y += sy;
                        } else {
                            const mergeForce = (minDistance - distance) / minDistance;
                            particle.glowMultiplier = (particle.glowMultiplier || 1) + mergeForce * 0.5;
                            other.glowMultiplier = (other.glowMultiplier || 1) + mergeForce * 0.5;
                            const af = mergeForce * 0.01;
                            particle.vx += dx2 * af;
                            particle.vy += dy2 * af;
                            other.vx -= dx2 * af;
                            other.vy -= dy2 * af;
                        }
                    }
                }
            }

            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx += (Math.random() - 0.5) * 0.001;
            particle.vy += (Math.random() - 0.5) * 0.001;
            particle.vx *= 0.999;
            particle.vy *= 0.999;

            if (particle.x < 0) particle.x = w;
            if (particle.x > w) particle.x = 0;
            if (particle.y < 0) particle.y = h;
            if (particle.y > h) particle.y = 0;
        }
    }, [
        canvasSize.height,
        canvasSize.width,
        glowAnimation,
        gravityStrength,
        mouseGravity,
        mouseInfluence,
        starsInteraction,
        starsInteractionType
    ]);

    const drawStars = React.useCallback(
        (ctx) => {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            for (const particle of starsRef.current) {
                ctx.save();
                ctx.shadowColor = color;
                ctx.shadowBlur = glowIntensity * (particle.glowMultiplier || 1) * 2;
                ctx.globalAlpha = particle.opacity;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(particle.x * dpr, particle.y * dpr, particle.size * dpr, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        },
        [color, dpr, glowIntensity]
    );

    const animate = React.useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        updateStars();
        drawStars(ctx);
        animRef.current = requestAnimationFrame(animate);
    }, [drawStars, updateStars]);

    React.useEffect(() => {
        resizeCanvas();

        const container = containerRef.current;
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(resizeCanvas)
            : null;

        if (container && resizeObserver) {
            resizeObserver.observe(container);
        }

        const handleWindowResize = () => resizeCanvas();
        window.addEventListener('resize', handleWindowResize);

        return () => {
            window.removeEventListener('resize', handleWindowResize);
            if (resizeObserver && container) {
                resizeObserver.disconnect();
            }
        };
    }, [resizeCanvas]);

    React.useEffect(() => {
        const nextStarsCount = Math.max(0, Number(starsCount) || 0);

        if (starsRef.current.length !== nextStarsCount) {
            initStars(canvasSize.width, canvasSize.height);
        } else {
            starsRef.current.forEach((particle) => {
                particle.baseOpacity = starsOpacity;
                particle.opacity = starsOpacity;

                const speed = Math.hypot(particle.vx, particle.vy);
                if (speed > 0) {
                    const ratio = Number(movementSpeed) / speed;
                    particle.vx *= ratio;
                    particle.vy *= ratio;
                }
                particle.size = Math.max(1, Math.random() * Number(starsSize || 2) + 1);
            });
        }
    }, [
        canvasSize.height,
        canvasSize.width,
        initStars,
        movementSpeed,
        starsCount,
        starsOpacity,
        starsSize
    ]);

    React.useEffect(() => {
        if (animRef.current) {
            cancelAnimationFrame(animRef.current);
        }

        animRef.current = requestAnimationFrame(animate);

        return () => {
            if (animRef.current) {
                cancelAnimationFrame(animRef.current);
            }
            animRef.current = null;
        };
    }, [animate]);

    return (
        <div
            ref={containerRef}
            data-slot="gravity-stars-background"
            className={mergeClassNames('gravity-stars-background-root', className)}
            style={{ color }}
            onMouseMove={handlePointerMove}
            onTouchMove={handlePointerMove}
            {...props}
        >
            <canvas ref={canvasRef} className="gravity-stars-background-canvas" />
        </div>
    );
}

const ForwardedGravityStarsBackground = React.forwardRef(GravityStarsBackground);
ForwardedGravityStarsBackground.displayName = 'GravityStarsBackground';

export default ForwardedGravityStarsBackground;
