import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import { envelopeToIncomingPacket, formatPacketLog, stringUidToNumber, type IncomingPacket } from "./utils.js";
import * as mqtt from './mqtt.js';
import * as env from './env.js';
import { createNodeInfoResponse, createPositionResponse, createTelemetryDeviceMetricsResponse, createTelemetryEnvironmentMetricsResponse, createTelemetryLocalStatsResponse, createTextResponse } from "./packets/response.js";
import { PacketBuilder } from "./packets/packet_builder.js";
import { getDeviceMetrics, getEnvironmentMetrics, getLocalStats } from "./telemetry.js";

async function handleTelemetryApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let telemetry = fromBinary(Protobuf.Telemetry.TelemetrySchema, envelope.packet.payloadVariant.value.payload);

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

async function handleTracerouteApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let routeDiscovery = fromBinary(Protobuf.Mesh.RouteDiscoverySchema, envelope.packet.payloadVariant.value.payload);

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
                    value: create(Protobuf.Mesh.DataSchema, {
                        portnum: Protobuf.Portnums.PortNum.TRACEROUTE_APP,
                        payload: toBinary(Protobuf.Mesh.RouteDiscoverySchema, routeDiscovery),
                        requestId: envelope.packet.id,
                    }),
                })
                .build()
        );
    }
}

async function handleNodeInfoApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let nodeInfo = fromBinary(Protobuf.Mesh.UserSchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("NodeInfoApp", envelope), `${nodeInfo.id} (${nodeInfo.shortName}) ${nodeInfo.longName} ${nodeInfo.role} ${nodeInfo.hwModel}`);
    
    if (envelope.packet.to === stringUidToNumber(env.MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        await mqtt.sendPacket(createNodeInfoResponse(envelope.channelId, envelope.packet.from, envelope.packet.id));
    }
}

async function handlePositionApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let position = fromBinary(Protobuf.Mesh.PositionSchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("PositionApp", envelope), `LAT: ${position.latitudeI * 1e-7}, LON: ${position.latitudeI * 1e-7}, ALT: ${position.altitude}, SRC: ${position.locationSource}`);
    
    if (envelope.to === stringUidToNumber(env.MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
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

export async function handleIncomingPacket(envelope: any, receivedTopic: string) {
    switch (envelope.packet.payloadVariant.value.portnum) {
        case Protobuf.Portnums.PortNum.TEXT_MESSAGE_APP: {
            return await handleTextMessageApp(envelope, receivedTopic);
        }
        case Protobuf.Portnums.PortNum.NODEINFO_APP: {
            return await handleNodeInfoApp(envelope, receivedTopic);
        }
        case Protobuf.Portnums.PortNum.POSITION_APP: {
            return await handlePositionApp(envelope, receivedTopic);
        }
        case Protobuf.Portnums.PortNum.TRACEROUTE_APP: {
            return await handleTracerouteApp(envelope, receivedTopic);
        }
        case Protobuf.Portnums.PortNum.TELEMETRY_APP: {
            return await handleTelemetryApp(envelope, receivedTopic);
        }
        default: {
            console.log(formatPacketLog(receivedTopic, envelope), envelope, envelope.packet.payloadVariant);
        }
    }
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