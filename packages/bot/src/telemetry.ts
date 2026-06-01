import { config } from './config/config.js';
import fetch from 'node-fetch';
import { prometheus } from './prometheus.js';

// #FIXME lol this will definitely gonna be affected by race conditions but oh well ;p
const counters = {
    numPacketsTx: 0,
    numPacketsRx: 0,
    numRxDupe: 0,
}

export async function getEnvironmentMetrics() {
    if (!config.prometheus) return;

    const queries = [
        prometheus.instantQuery(config.prometheus.queries.temperature),
        prometheus.instantQuery(config.prometheus.queries.barometric_pressure),
    ];

    const [temperatureResult, pressureResult] = await Promise.all(queries);

    if (!temperatureResult || !temperatureResult[0]) {
        throw new Error("no temperature result was returned from prometheus query");
    }

    if (!pressureResult || !pressureResult[0]) {
        throw new Error("no barometric pressure result was returned from prometheus query");
    }

    if (!temperatureResult[0].hasScalarValue()) {
        throw new Error("temperature result from prometheus query has no scalar value");
    }

    if (!pressureResult[0].hasScalarValue()) {
        throw new Error("temperature result from prometheus query has no scalar value");
    }

    return {
        temperature: temperatureResult[0].value.value,
        barometricPressure: pressureResult[0].value.value,
    }
}

export function getLocalStats() {
    const mem = process.memoryUsage();
    return {
        uptimeSeconds: Math.floor(process.uptime()),
        heapTotalBytes: mem.heapTotal,
        heapFreeBytes: mem.heapTotal - mem.heapUsed,
        ...counters,
    }
}

export function getDeviceMetrics() {
    return {
        batteryLevel: 101,
        uptimeSeconds: Math.floor(process.uptime()),
    };
}

export {
    counters,
}