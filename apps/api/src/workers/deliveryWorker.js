import 'dotenv/config';
import { processEmailDeliveryQueue } from '../services/delivery.js';

const pollIntervalMs = Number.parseInt(process.env.DELIVERY_POLL_INTERVAL_MS || '15000', 10);
let running = true;
let busy = false;

async function tick() {
    if (!running || busy) {
        return;
    }

    busy = true;

    try {
        const result = await processEmailDeliveryQueue({ limit: 25 });
        if (result.claimed > 0) {
            console.log(
                `[delivery-worker] claimed=${result.claimed} sent=${result.sent} failed=${result.failed} retryScheduled=${result.retryScheduled}`
            );
        }
    } catch (error) {
        console.error('[delivery-worker] delivery processing error:', error.message);
    } finally {
        busy = false;
    }
}

async function start() {
    console.log(`[delivery-worker] started with poll interval ${pollIntervalMs}ms`);

    await tick();
    const timer = setInterval(tick, pollIntervalMs);

    const shutdown = () => {
        if (!running) {
            return;
        }

        running = false;
        clearInterval(timer);
        console.log('[delivery-worker] shutting down');
        setTimeout(() => process.exit(0), 250).unref();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

start().catch((error) => {
    console.error('[delivery-worker] failed to start:', error);
    process.exit(1);
});
