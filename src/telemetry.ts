import * as env from './env.js';
import fetch from 'node-fetch';

export interface EnvironmentMetrics {
    temperature?: number;
    barometricPressure?: number;
}

export interface LocalStats {
    uptimeSeconds?: number;
    heapTotalBytes?: number;
    heapFreeBytes?: number;
    numPacketsTx?: number;
    numPacketsRx?: number;
    numRxDupe?: number;
}

// #FIXME lol this will definitely gonna be affected by race conditions but oh well ;p
const counters = {
    numPacketsTx: 0,
    numPacketsRx: 0,
    numRxDupe: 0,
}

async function queryPrometheus(query: string, time: Date = new Date()) {
    if (!env.PROMETHEUS_URL) {
        throw new Error("PROMETHEUS_URL is not defined");
    }
    
    const body = await (await fetch(env.PROMETHEUS_URL + "/api/v1/query", {
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

export async function getEnvironmentMetrics() {
    const temperatureResult = await queryPrometheus(`avg_over_time(world_temperature{job="micrometeo", location="outside"}[1m])`);
    const pressureResult = await queryPrometheus(`avg_over_time(world_atmospheric_pressure{job="micrometeo", location="home"}[1m])`);
        
    if (temperatureResult.resultType !== "vector" || pressureResult.resultType !== "vector") return;
    if (temperatureResult.result.length === 0 || pressureResult.result.length === 0) return;

    return {
        temperature: parseFloat(temperatureResult.result[0].value[1]),
        barometricPressure: parseFloat(pressureResult.result[0].value[1]),
    } as EnvironmentMetrics;
}

export function getLocalStats() {
    const mem = process.memoryUsage();
    return {
        uptimeSeconds: Math.floor(process.uptime()),
        heapTotalBytes: mem.heapTotal,
        heapFreeBytes: mem.heapTotal - mem.heapUsed,
        ...counters,
    } as LocalStats;
}

export {
    counters,
}