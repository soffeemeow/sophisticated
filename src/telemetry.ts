import { config } from './config/config.js';
import fetch from 'node-fetch';

// #FIXME lol this will definitely gonna be affected by race conditions but oh well ;p
const counters = {
    numPacketsTx: 0,
    numPacketsRx: 0,
    numRxDupe: 0,
}

export async function queryPrometheus(query: string, time: Date = new Date()) {
    if (!config.prometheus) {
        throw new Error("Prometheus is not configured");
    }
    
    const body = await (await fetch(config.prometheus.url + "/api/v1/query", {
        method: "POST",
        body: new URLSearchParams({
            query,
            time: `${time.getTime() / 1000}`,
        }),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    })).json() as { 
        status: string;
        data: {
            resultType: string;
            result: any;
        }
        error?: string;
    };

    if (body.status !== "success") {
        throw new Error(`prometheus query failed: ${body.error}`);
    }

    return body.data;
}

export function prometheusResultToNumber(result: any) {
    if (!("resultType" in result)) {
        throw new Error(`Object must contain 'resultType' property.`);
    }
    if (result.resultType !== "vector") {
        throw new Error(`Unexpected result type '${result.resultType}', expected 'vector'`);
    }

    if (!("result" in result) || !Array.isArray(result.result) || result.result.length === 0) {
        throw new Error(`Object must contain 'result' property of non-empty array type.`);
    }
    return parseFloat(result.result[0].value[1]);
}

export async function getEnvironmentMetrics() {
    if (!config.prometheus) return;

    const temperatureResult = await queryPrometheus(config.prometheus.queries.temperature);
    const pressureResult = await queryPrometheus(config.prometheus.queries.barometric_pressure);

    return {
        temperature: prometheusResultToNumber(temperatureResult),
        barometricPressure: prometheusResultToNumber(pressureResult),
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