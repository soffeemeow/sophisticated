import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as meshtastic from './meshtastic.js';
import { envelopeToIncomingPacket, formatPacketLog, stringUidToNumber, type IncomingPacket, type RequiredBy } from "./utils.js";
import * as mqtt from './mqtt.js';
import * as env from './env.js';
import { createNodeInfoResponse, createPositionResponse, createTelemetryDeviceMetricsResponse, createTelemetryEnvironmentMetricsResponse, createTelemetryLocalStatsResponse, createTextResponse } from "./packets/response.js";
import { PacketBuilder } from "./packets/packet_builder.js";
import { getDeviceMetrics, getEnvironmentMetrics, getLocalStats } from "./telemetry.js";

async function handleTelemetryApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let telemetry = fromBinary(meshtastic.Telemetry.TelemetrySchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] at ${new Date(telemetry.time * 1000).toISOString()}`, telemetry.variant.value);
    
    if (envelope.packet.to === stringUidToNumber(env.MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        switch (telemetry.variant.case) {
            case "environmentMetrics": {
                const metrics = await getEnvironmentMetrics();
                if (!metrics) return;

                await mqtt.sendPacket(await createTelemetryEnvironmentMetricsResponse(envelope.channelId, envelope.packet.from, metrics, envelope.packet.id));
                return;
            }
            case "localStats": {
                // seems like local stats should not be sent over the mesh.... oh well.. 
                if (envelope.packet.from !== stringUidToNumber(env.MSH_GATEWAY)) return;

                const metrics = await getLocalStats();
                if (!metrics) return;

                await mqtt.sendPacket(await createTelemetryLocalStatsResponse(envelope.channelId, envelope.packet.from, metrics, envelope.packet.id));
            }
            case "deviceMetrics": {
                const metrics = await getDeviceMetrics();
                if (!metrics) return;

                await mqtt.sendPacket(await createTelemetryDeviceMetricsResponse(envelope.channelId, envelope.packet.from, metrics, envelope.packet.id));
            }
            default: {
                console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] unsupported telemetry request`);
                return;
            }
        }
    }
}

async function handleTracerouteApp(envelope: RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let routeDiscovery = fromBinary(meshtastic.Mesh.RouteDiscoverySchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("TracerouteApp", envelope), routeDiscovery);
    
    const nodeId = stringUidToNumber(env.MSH_UID);

    if (envelope.packet.to === nodeId && envelope.packet.payloadVariant.value.wantResponse) {
        routeDiscovery.snrTowards.push(0);

        await mqtt.sendPacket(
            new PacketBuilder()
                .setChannelId(envelope.channelId)
                .setDestination(envelope.packet.from)
                .setPayload({
                    case: "decoded",
                    value: create(meshtastic.Mesh.DataSchema, {
                        portnum: meshtastic.Portnums.PortNum.TRACEROUTE_APP,
                        payload: toBinary(meshtastic.Mesh.RouteDiscoverySchema, routeDiscovery),
                        requestId: envelope.packet.id,
                    }),
                })
                .build()
        );
    }
}

async function handleNodeInfoApp(envelope: RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let nodeInfo = fromBinary(meshtastic.Mesh.UserSchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("NodeInfoApp", envelope), `${nodeInfo.id} (${nodeInfo.shortName}) ${nodeInfo.longName} ${nodeInfo.role} ${nodeInfo.hwModel}`);
    
    if (envelope.packet.to === stringUidToNumber(env.MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        await mqtt.sendPacket(createNodeInfoResponse(envelope.channelId, envelope.packet.from, envelope.packet.id));
    }
}

async function handlePositionApp(envelope: RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let position = fromBinary(meshtastic.Mesh.PositionSchema, envelope.packet.payloadVariant.value.payload);

    const la = position.latitudeI !== undefined ? position.latitudeI * 1e-7 : "-";
    const lo = position.longitudeI !== undefined ? position.longitudeI * 1e-7 : "-";
    const alt = position.altitude ?? "-";

    console.log(formatPacketLog("PositionApp", envelope), `LAT: ${la}, LON: ${lo}, ALT: ${alt}, SRC: ${position.locationSource}`);
    
    if (envelope.packet.to === stringUidToNumber(env.MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        await mqtt.sendPacket(createPositionResponse(envelope.channelId, envelope.packet.from, envelope.packet.id));
    }
}

export interface TextMessageContext {
    packet: IncomingPacket;
    message: string;
    isEncrypted: boolean;   
}

export interface TextCommandHandler {
    name?: string;
    test: (ctx: TextMessageContext) => boolean;
    handler: (ctx: TextMessageContext) => Promise<void>;
}

const TextCommandHandlers: TextCommandHandler[] = [];

async function handleTextMessageApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;

    let msg: string;
    if (envelope.packet.payloadVariant.case === "decoded") {
        msg = envelope.packet.payloadVariant.value.payload.toString();
    } else if (envelope.packet.payloadVariant.case === "encrypted") {
        msg = "<encrypted message>";
    } else {
        console.error("unknown packet.payloadVariant in TextMessageApp handler:", envelope.packet.payloadVariant.case);
        msg = "";
    }

    console.log(formatPacketLog("TextMessageApp", envelope), msg);

    for (const h of TextCommandHandlers) {
        const ctx = {
                packet: envelopeToIncomingPacket(envelope),
                message: msg,
                isEncrypted: envelope.packet.payloadVariant.case === "encrypted",
        };
        try {
            if (h.test(ctx)) {
                console.log(`found handler for request: ${h.name ?? "unnamed"}`);
                await h.handler(ctx);
            }
        } catch (e) {
            console.error(`Error in TextCommandHandler (${h.name ?? "unnamed"}):`, e);
            continue;
        }
    }
}

export async function handleIncomingPacket(envelope: RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">, receivedTopic: string) {
    if (envelope.packet.payloadVariant.case === "decoded") {
        switch (envelope.packet.payloadVariant.value.portnum) {
            case meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP: {
                return await handleTextMessageApp(envelope, receivedTopic);
            }
            case meshtastic.Portnums.PortNum.NODEINFO_APP: {
                return await handleNodeInfoApp(envelope, receivedTopic);
            }
            case meshtastic.Portnums.PortNum.POSITION_APP: {
                return await handlePositionApp(envelope, receivedTopic);
            }
            case meshtastic.Portnums.PortNum.TRACEROUTE_APP: {
                return await handleTracerouteApp(envelope, receivedTopic);
            }
            case meshtastic.Portnums.PortNum.TELEMETRY_APP: {
                return await handleTelemetryApp(envelope, receivedTopic);
            }
            default: {
                console.log(formatPacketLog(receivedTopic, envelope), envelope, envelope.packet.payloadVariant);
            }
        }
        return;
    }
    if (envelope.packet.payloadVariant.case === "encrypted") {
        console.log(formatPacketLog(receivedTopic, envelope), "received encrypted message");
        return;
    }
    if (envelope.packet.payloadVariant.case === undefined) {
        console.log(formatPacketLog(receivedTopic, envelope), "received message with empty payload");
        return;
    }
}

function getPingStatusMessage(packet: IncomingPacket) {
    const hops = packet.hopStart - packet.hopLimit;
    if (packet.sender === env.MSH_GATEWAY) {
        return "🔌 (GW)";
    }
    
    if (hops === 0) {
        return `📡 (S: ${packet.rxSnr}, R: ${packet.rxRssi})`;
    }

    if (hops === 6 && packet.hopStart === 7) {
        return "🕸️ (Hops: SIX/SEVEEEEEN!!!)";
    }

    return `🕸️ (Hops: ${hops}/${packet.hopStart})`;
}

TextCommandHandlers.push({
    name: "ping",
    test: (ctx) => {
        if (ctx.isEncrypted) return false;
        if (ctx.packet.channelId !== "Services") return false;

        const msg = ctx.message.toLowerCase();
        return msg === "пинг" || msg === "ping";
    },
    handler: async (ctx) => {
        const response = `Pong to ${ctx.packet.sender} ${getPingStatusMessage(ctx.packet)}`;
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

            response = `На улице: 🌡️ ${metrics.temperature.toFixed(2)} °C, ☁️ ${(metrics.barometricPressure / 1.333224).toFixed(2)} mmHg`
        } catch (e) {
            console.error("prometheus query failed:", e);
            return;
        }

        await mqtt.sendPacket(createTextResponse(ctx.packet.channelId, 0xffffffff, response, ctx.packet.id));
    }
});