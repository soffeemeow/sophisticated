import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as meshtastic from './meshtastic.js';
import { envelopeToIncomingPacket, formatPacketLog, stringUidToNumber, type IncomingPacket, type RequiredBy } from "./utils.js";
import * as mqtt from './mqtt.js';
import { createNodeInfoResponse, createPositionResponse, createTelemetryDeviceMetricsResponse, createTelemetryEnvironmentMetricsResponse, createTelemetryLocalStatsResponse, createTextResponse } from "./packets/response.js";
import { PacketBuilder } from "./packets/packet_builder.js";
import { getDeviceMetrics, getEnvironmentMetrics, getLocalStats } from "./telemetry.js";
import { nodedb } from "./nodedb/node_db.js";
import { decryptPacket, defaultPSK } from "./crypto/crypto.js";
import { config } from "./config/config.js";
// #TODO pki encryption WIP
// import { decryptPKIPacket } from "./crypto/pki.js";
// import { writeFile } from "node:fs/promises";

async function handleTelemetryApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let telemetry = fromBinary(meshtastic.Telemetry.TelemetrySchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] at ${new Date(telemetry.time * 1000).toISOString()}`, telemetry.variant.value);
    
    if (envelope.packet.to === stringUidToNumber(config.meshtastic.node.id) && envelope.packet.payloadVariant.value.wantResponse) {
        switch (telemetry.variant.case) {
            case "environmentMetrics": {
                const metrics = await getEnvironmentMetrics();
                if (!metrics) return;

                await mqtt.sendPacket(await createTelemetryEnvironmentMetricsResponse(envelope.channelId, envelope.packet.from, metrics, envelope.packet.id));
                return;
            }
            case "localStats": {
                // seems like local stats should not be sent over the mesh.... oh well.. 
                if (envelope.packet.from !== stringUidToNumber(config.mqtt.gateway)) return;

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
    
    const nodeId = stringUidToNumber(config.meshtastic.node.id);

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
    
    if (envelope.packet.to === stringUidToNumber(config.meshtastic.node.id) && envelope.packet.payloadVariant.value.wantResponse) {
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
    
    if (envelope.packet.to === stringUidToNumber(config.meshtastic.node.id) && envelope.packet.payloadVariant.value.wantResponse) {
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

    if (!config.bot.enabled) return;

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

function updateNodeDBInfo(packet: meshtastic.Mesh.MeshPacket) {
    let node = nodedb.getNode(packet.from);
    if (node === undefined) {
        node = create(meshtastic.Mesh.NodeInfoSchema, {
            isFavorite: false,
            isIgnored: false,
            isKeyManuallyVerified: false,
            isMuted: false,
        });
    }

    node.num = packet.from;
    node.snr = packet.rxSnr;
    node.lastHeard = Math.floor(new Date().getTime() / 1000);
    node.viaMqtt = packet.viaMqtt;
    node.hopsAway = packet.hopStart - packet.hopLimit;

    nodedb.updateNode(node.num, node);


    if (!packet.payloadVariant) return;
    if (packet.payloadVariant.case !== "decoded") return;
    if (packet.payloadVariant.value.portnum !== meshtastic.Portnums.PortNum.NODEINFO_APP) return;

    const nodeInfo = fromBinary(meshtastic.Mesh.UserSchema, packet.payloadVariant.value.payload);
    nodedb.updateUser(nodeInfo.id, nodeInfo);
}

export async function handleIncomingPacket(envelope: RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">, receivedTopic: string) {
    updateNodeDBInfo(envelope.packet);
    
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
        // #TODO pki encryption WIP
        // if (envelope.packet.pkiEncrypted && envelope.packet.to === stringUidToNumber(env.MSH_UID)) {
        //     if (envelope.packet.from === stringUidToNumber(env.MSH_GATEWAY)) {
        //         await writeFile("./rx_gw_pki.msh", toBinary(meshtastic.Mesh.MeshPacketSchema, envelope.packet));
        //     }
        //     try {
        //         const payload = decryptPKIPacket(envelope.packet.publicKey, envelope.packet);
        //         console.log(payload.toString("utf-8"));
        //         const data = fromBinary(meshtastic.Mesh.DataSchema, payload);
        //         console.log(data);
        //     } catch (e) {
        //         console.log("failed to decrypt message", e);
        //     }
        // }
        if (!envelope.packet.pkiEncrypted) {
            try {
                const result = decryptPacket(defaultPSK, envelope.packet);
                const data = fromBinary(meshtastic.Mesh.DataSchema, result);

                envelope.packet.payloadVariant = {
                    value: data,
                    case: "decoded",
                };

                await handleIncomingPacket(envelope, receivedTopic);
            } catch (e) {
                console.log("failed to decrypt message", e);
            }
        }
        return;
    }
    if (envelope.packet.payloadVariant.case === undefined) {
        console.log(formatPacketLog(receivedTopic, envelope), "received message with empty payload");
        return;
    }
}

function getPingStatusMessage(packet: IncomingPacket) {
    const hops = packet.hopStart - packet.hopLimit;
    if (packet.sender === config.mqtt.gateway) {
        return "🔌 (GW)";
    }
    
    if (hops === 0) {
        return `📡 (S: ${packet.rxSnr}, R: ${packet.rxRssi})`;
    }

    if (config.bot.modules.ping.six_seven_enabled && hops === 6 && packet.hopStart === 7) {
        if (Math.random() <= config.bot.modules.ping.six_seven_proc) {
            return "🕸️ (Hops: SIX/SEVEEEEEN!!!)";
        }
    }

    return `🕸️ (Hops: ${hops}/${packet.hopStart})`;
}

TextCommandHandlers.push({
    name: "ping",
    test: (ctx) => {
        if (ctx.isEncrypted) return false;
        if (!config.bot.modules.ping.enabled) return false;
        if (!config.bot.modules.ping.channels.includes(ctx.packet.channelId)) return false;

        const msg = ctx.message.toLowerCase();
        // #TODO: add config option for trigger regexp
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
        if (!config.bot.modules.weather.enabled) return false;
        if (!config.bot.modules.weather.channels.includes(ctx.packet.channelId)) return false;

        const msg = ctx.message.toLowerCase();
        // #TODO: add config option for trigger regexp
        return msg === "weather" || msg === "погода";
    },
    handler: async (ctx) => {
        let response;
        try {
            const metrics = await getEnvironmentMetrics();
            if (!metrics || !metrics.temperature || !metrics.barometricPressure) return;

            // #TODO: add config option for template string
            response = `На улице: 🌡️ ${metrics.temperature.toFixed(2)} °C, ☁️ ${(metrics.barometricPressure / 1.333224).toFixed(2)} mmHg`
        } catch (e) {
            console.error("prometheus query failed:", e);
            return;
        }

        await mqtt.sendPacket(createTextResponse(ctx.packet.channelId, 0xffffffff, response, ctx.packet.id));
    }
});

interface AnimalNoise {
    animal: string;
    emoji: string[];
    regexp: RegExp;
}

function wrapRegExp(regexp: RegExp) {
    return new RegExp(
        "(?:^|[^а-яА-Яa-zA-Z0-9])" +
        `(?:${regexp.source})` +
        "(?:$|[^а-яА-Яa-zA-Z0-9])", regexp.flags);
}
// #TODO: add config options for whatever this is
const animalNoises: AnimalNoise[] = [
    {
        animal: "cat",
        emoji: ["🐱", "🐈", "🧶", "🐾"],
        regexp: wrapRegExp(/мя+(?:ов|[ув]+)|мур+|me+o+w+/i),
    },
    {
        animal: "dog",
        emoji: ["🐶", "🐕", "🦴", "🐾"],
        regexp: wrapRegExp(/га[вф]|woo+f|bark/i),
    },
    {
        animal: "fox",
        emoji: ["🦊", "🐾"],
        regexp: wrapRegExp(/фы+р+/i),
    },
    {
        animal: "frog",
        emoji: ["🐸"],
        regexp: wrapRegExp(/ква+к?/i),
    },
    {
        animal: "crow",
        emoji: ["🐦‍⬛"],
        regexp: wrapRegExp(/кар+/i),
    },
    {
        animal: "duck",
        emoji: ["🦆"],
        regexp: wrapRegExp(/кря+к?/i),
    },
    {
        animal: "mouse",
        emoji: ["🐭", "🐁", "🧀"],
        regexp: wrapRegExp(/мыш(?:[ьи]|ки|астики?)?|пи(?:пи)+/i),
    },
];

function findAnimalNoise(message: string) {
    for (const a of animalNoises) {
        if (a.regexp.test(message)) {
            return a;
        }
    }
}

TextCommandHandlers.push({
    name: "animals",
    test: (ctx) => {
        if (ctx.isEncrypted) return false;
        if (!config.bot.modules.animals.enabled) return false;
        if (!config.bot.modules.animals.channels.includes(ctx.packet.channelId)) return false;

        return findAnimalNoise(ctx.message) !== undefined;
    },
    handler: async (ctx) => {
        const animal = findAnimalNoise(ctx.message);
        if (!animal) return;

        const emojiIndex = Math.floor(Math.random() * animal.emoji.length)!;
        const emoji = animal.emoji[emojiIndex];
        if (!emoji) {
            throw new Error("wtf");
        }

        const response = new PacketBuilder()
            .setChannelId(ctx.packet.channelId)
            .setDestination(0xffffffff)
            .setPayload({
                case: "decoded",
                value: create(meshtastic.Mesh.DataSchema, {
                    portnum: meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP,
                    payload: Buffer.from(emoji),
                    replyId: ctx.packet.id,
                    emoji: Number(true),
                }),
        })
        .build();

        await mqtt.sendPacket(response);
    }
});