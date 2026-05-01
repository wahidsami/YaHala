import * as React from 'react';
import './FireworksBackground.css';

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(Math.random() * (max - min) + min);
const randColor = () => `hsl(${randInt(0, 360)}, 100%, 50%)`;

function getValueByRange(range) {
    if (typeof range === 'number') {
        return range;
    }

    if (!range || typeof range !== 'object') {
        return 0;
    }

    return rand(range.min, range.max);
}

function getColor(color) {
    if (Array.isArray(color)) {
        if (color.length === 0) return randColor();
        return color[randInt(0, color.length)] || randColor();
    }

    return color || randColor();
}

function createParticle(x, y, color, speed, direction, gravity, friction, size) {
    const vx = Math.cos(direction) * speed;
    const vy = Math.sin(direction) * speed;
    const decay = rand(0.005, 0.02);

    return {
        x,
        y,
        color,
        speed,
        direction,
        vx,
        vy,
        gravity,
        friction,
        alpha: 1,
        decay,
        size,
        update() {
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.vy += this.gravity;
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
        },
        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.restore();
        },
        isAlive() {
            return this.alpha > 0;
        }
    };
}

function createFirework(x, y, targetY, color, speed, size, particleSpeed, particleSize, onExplode) {
    const angle = -Math.PI / 2 + rand(-0.3, 0.3);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const trailLength = randInt(10, 25);
    const trail = [];

    return {
        x,
        y,
        targetY,
        color,
        speed,
        size,
        vx,
        vy,
        trail,
        trailLength,
        update() {
            this.trail.push({ x: this.x, y: this.y });

            if (this.trail.length > this.trailLength) {
                this.trail.shift();
            }

            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.02;

            if (this.vy >= 0 || this.y <= this.targetY) {
                this.explode(particleSpeed, particleSize, onExplode);
                return false;
            }

            return true;
        },
        explode(localParticleSpeed, localParticleSize, explodeHandler) {
            const numParticles = randInt(50, 150);
            const particles = [];

            for (let i = 0; i < numParticles; i += 1) {
                const particleAngle = rand(0, Math.PI * 2);
                const speedValue = getValueByRange(localParticleSpeed);
                const sizeValue = getValueByRange(localParticleSize);

                particles.push(
                    createParticle(
                        this.x,
                        this.y,
                        this.color,
                        speedValue,
                        particleAngle,
                        0.05,
                        0.98,
                        sizeValue
                    )
                );
            }

            explodeHandler(particles);
        },
        draw(ctx) {
            ctx.save();
            ctx.beginPath();

            if (this.trail.length > 1) {
                ctx.moveTo(this.trail[0]?.x ?? this.x, this.trail[0]?.y ?? this.y);
                for (const point of this.trail) {
                    ctx.lineTo(point.x, point.y);
                }
            } else {
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x, this.y);
            }

            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
        }
    };
}

function mergeClassNames(...parts) {
    return parts.filter(Boolean).join(' ');
}

function FireworksBackground(
    {
        className,
        canvasProps,
        population = 1,
        color,
        fireworkSpeed = { min: 4, max: 8 },
        fireworkSize = { min: 2, max: 5 },
        particleSpeed = { min: 2, max: 7 },
        particleSize = { min: 1, max: 5 },
        ...props
    },
    ref
) {
    const containerRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const timeoutsRef = React.useRef(new Set());
    const animationFrameRef = React.useRef(null);
    const populationValue = Math.max(1, Number(population) || 1);
    const fireworkSpeedMinValue = Number(fireworkSpeed?.min ?? 4);
    const fireworkSpeedMaxValue = Number(fireworkSpeed?.max ?? 8);
    const fireworkSizeMinValue = Number(fireworkSize?.min ?? 2);
    const fireworkSizeMaxValue = Number(fireworkSize?.max ?? 5);
    const particleSpeedMinValue = Number(particleSpeed?.min ?? 2);
    const particleSpeedMaxValue = Number(particleSpeed?.max ?? 7);
    const particleSizeMinValue = Number(particleSize?.min ?? 1);
    const particleSizeMaxValue = Number(particleSize?.max ?? 5);
    const colorPalette = Array.isArray(color)
        ? color.filter(Boolean)
        : color
            ? [color]
            : [];
    const colorKey = colorPalette.join('|');
    const fireworkSpeedRange = {
        min: fireworkSpeedMinValue,
        max: fireworkSpeedMaxValue
    };
    const fireworkSizeRange = {
        min: fireworkSizeMinValue,
        max: fireworkSizeMaxValue
    };
    const particleSpeedRange = {
        min: particleSpeedMinValue,
        max: particleSpeedMaxValue
    };
    const particleSizeRange = {
        min: particleSizeMinValue,
        max: particleSizeMaxValue
    };

    React.useImperativeHandle(ref, () => containerRef.current);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return undefined;

        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        let maxX = container.clientWidth || 1;
        let maxY = container.clientHeight || 1;

        const setCanvasSize = () => {
            maxX = container.clientWidth || 1;
            maxY = container.clientHeight || 1;
            canvas.width = maxX;
            canvas.height = maxY;
        };

        setCanvasSize();

        const handleResize = () => {
            setCanvasSize();
        };

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(setCanvasSize)
            : null;

        if (resizeObserver) {
            resizeObserver.observe(container);
        } else {
            window.addEventListener('resize', handleResize);
        }

        const explosions = [];
        const fireworks = [];

        const handleExplosion = (particles) => {
            explosions.push(...particles);
        };

        const launchFirework = () => {
            if (!containerRef.current) return;

            const x = rand(maxX * 0.1, maxX * 0.9);
            const y = maxY;
            const targetY = rand(maxY * 0.1, maxY * 0.4);
            const fireworkColor = getColor(colorPalette);
            const speedValue = getValueByRange(fireworkSpeedRange);
            const sizeValue = getValueByRange(fireworkSizeRange);

            fireworks.push(
                createFirework(
                    x,
                    y,
                    targetY,
                    fireworkColor,
                    speedValue,
                    sizeValue,
                    particleSpeed,
                    particleSize,
                    handleExplosion
                )
            );

            const timeout = window.setTimeout(() => {
                timeoutsRef.current.delete(timeout);
                if (containerRef.current) {
                    launchFirework();
                }
            }, rand(300, 800) / populationValue);

            timeoutsRef.current.add(timeout);
        };

        launchFirework();

        const animate = () => {
            ctx.clearRect(0, 0, maxX, maxY);

            for (let i = fireworks.length - 1; i >= 0; i -= 1) {
                const firework = fireworks[i];
                if (!firework?.update()) {
                    fireworks.splice(i, 1);
                } else {
                    firework.draw(ctx);
                }
            }

            for (let i = explosions.length - 1; i >= 0; i -= 1) {
                const particle = explosions[i];
                if (!particle) {
                    explosions.splice(i, 1);
                    continue;
                }

                particle.update();

                if (particle.isAlive()) {
                    particle.draw(ctx);
                } else {
                    explosions.splice(i, 1);
                }
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        const handleClick = (event) => {
            const rect = canvas.getBoundingClientRect();
            const fireworkColor = getColor(colorPalette);
            const speedValue = getValueByRange(fireworkSpeedRange);
            const sizeValue = getValueByRange(fireworkSizeRange);

            fireworks.push(
                createFirework(
                    event.clientX - rect.left,
                    maxY,
                    event.clientY - rect.top,
                    fireworkColor,
                    speedValue,
                    sizeValue,
                    particleSpeedRange,
                    particleSizeRange,
                    handleExplosion
                )
            );
        };

        container.addEventListener('click', handleClick);

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            } else {
        window.removeEventListener('resize', handleResize);
            }

            container.removeEventListener('click', handleClick);

            for (const timeout of timeoutsRef.current) {
                clearTimeout(timeout);
            }
            timeoutsRef.current.clear();

            if (animationFrameRef.current != null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [
        populationValue,
        colorKey,
        fireworkSpeedMinValue,
        fireworkSpeedMaxValue,
        fireworkSizeMinValue,
        fireworkSizeMaxValue,
        particleSpeedMinValue,
        particleSpeedMaxValue,
        particleSizeMinValue,
        particleSizeMaxValue
    ]);

    return (
        <div
            ref={containerRef}
            data-slot="fireworks-background"
            className={mergeClassNames('fireworks-background-root', className)}
            {...props}
        >
            <canvas
                {...canvasProps}
                ref={canvasRef}
                className={mergeClassNames('fireworks-background-canvas', canvasProps?.className)}
            />
        </div>
    );
}

const ForwardedFireworksBackground = React.forwardRef(FireworksBackground);
ForwardedFireworksBackground.displayName = 'FireworksBackground';

export default ForwardedFireworksBackground;
