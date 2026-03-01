import { TextCommandHandlers } from "./handlers.js";
import * as mqtt from './mqtt.js';
import * as env from './env.js';
import { createTextResponse } from "./packets/response.js";
import { getEnvironmentMetrics } from "./telemetry.js";

TextCommandHandlers.push({
    name: "ping",
    test: (ctx) => {
        if (ctx.isEncrypted) return false;
        if (ctx.packet.channelId !== "Services") return false;

        const msg = ctx.message.toLowerCase();
        return msg === "пинг" || msg === "ping";
    },
    handler: async (ctx) => {
        const hops = ctx.packet.hopStart - ctx.packet.hopLimit;

        let response;
        if (ctx.packet.sender === env.MSH_GATEWAY) {
            response = `Pong to ${ctx.packet.sender} 🔌 (GW)`;
        } else {
            if (hops > 0) {
                response = `Pong to ${ctx.packet.sender} 🕸️ (Hops: ${hops}/${ctx.packet.hopStart})`;
            } else {
                response = `Pong to ${ctx.packet.sender} 📡 (S: ${ctx.packet.rxSnr}, R: ${ctx.packet.rxRssi})`;
            }
        }

        await mqtt.sendPacket(createTextResponse(ctx.packet.channelId, 0xffffffff, response, ctx.packet.id));
    }
});

TextCommandHandlers.push({
    name: "weather",
    test: (ctx) => {
        if (ctx.isEncrypted) return false;
        if (!["Services", "LongFast"].includes(ctx.packet.channelId)) return false;

        const msg = ctx.message.toLowerCase();
        return msg === "weather" || msg === "погода";
    },
    handler: async (ctx) => {
        let response;
        try {
            const metrics = await getEnvironmentMetrics();
            if (!metrics || !metrics.temperature || !metrics.barometricPressure) return;

            response = `На улице: 🌡️ ${metrics.temperature.toFixed(2)} °C, ☁️ ${metrics.barometricPressure.toFixed(2)} mmHg`
        } catch (e) {
            console.error("prometheus query failed:", e);
            return;
        }

        await mqtt.sendPacket(createTextResponse(ctx.packet.channelId, 0xffffffff, response, ctx.packet.id));
    }
});