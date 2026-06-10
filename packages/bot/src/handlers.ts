import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { ConcurrentPool, envelopeToIncomingPacket, formatPacketLog, stringUidToNumber, type IncomingPacket, type NonNullableBy, type RequiredBy } from "./utils.js";
import * as mqtt from './mqtt.js';
import { getDeviceMetrics, getEnvironmentMetrics } from "./telemetry.js";
import { nodedb } from "./nodedb/node_db.js";
import { createNonce, decrypt, PSK } from "@sophisticated/meshtastic-crypto";
import { config } from "./config/config.js";
import { ServiceEnvelopeBuilderWithDefaults } from "./packets/default_builders.js";
import { TelemetryBuilder } from "./meshtastic/builders.js";
import { defaultNodeInfoBinary, defaultPositionBinary } from "./packets/response.js";
import { InstantVector, prometheus } from "./prometheus.js";
import { decryptPKIPacket } from "./crypto/pki.js";
// #TODO pki encryption WIP
// import { decryptPKIPacket } from "./crypto/pki.js";
// import { writeFile } from "node:fs/promises";

type PopulatedServiceEnvelope = RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">;

async function handleTelemetryApp(envelope: PopulatedServiceEnvelope, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let telemetry = fromBinary(meshtastic.Telemetry.TelemetrySchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] at ${new Date(telemetry.time * 1000).toISOString()}`, telemetry.variant.value);
    
    if (envelope.packet.to === stringUidToNumber(config.meshtastic.node.id) && envelope.packet.payloadVariant.value.wantResponse) {
        const responseBuilder = new TelemetryBuilder()
            .setTime(Math.floor(new Date().getTime() / 1000));
        
        switch (telemetry.variant.case) {
            case "environmentMetrics": {
                const metrics = await getEnvironmentMetrics();
                if (!metrics) return;

                responseBuilder.environmentMetrics(m => m
                    .setTemperature(metrics.temperature)
                    .setBarometricPressure(metrics.barometricPressure)
                );

                break;
            }

            // case "localStats": {
            //     // seems like local stats should not be sent over the mesh.... oh well.. 
            //     if (envelope.packet.from !== stringUidToNumber(config.mqtt.gateway)) return;

            //     const metrics = await getLocalStats();
            //     if (!metrics) return;

            //     await mqtt.sendPacket(await createTelemetryLocalStatsResponse(envelope.channelId, envelope.packet.from, metrics, envelope.packet.id));
            // }
            
            case "deviceMetrics": {
                const metrics = await getDeviceMetrics();
                if (!metrics) return;

                responseBuilder.deviceMetrics(m => m
                    .setBatteryLevel(metrics.batteryLevel)
                    .setUptimeSeconds(metrics.uptimeSeconds)
                );

                break;
            }

            default: {
                console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] unsupported telemetry request`);
                return;
            }
        }

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .setChannelId(envelope.channelId)
            .packetPayload(p => p
                .defaults()
                .setDestination(envelope.packet.from)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TELEMETRY_APP)
                    .setRequestId(envelope.packet.id)
                    .setPayload(responseBuilder.buildBinary())
                )
            ).build()
        );
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

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .setChannelId(envelope.channelId)
            .packetPayload(p => p
                .defaults()
                .setDestination(envelope.packet.from)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TRACEROUTE_APP)
                    .setRequestId(envelope.packet.id)
                    .setPayload(toBinary(meshtastic.Mesh.RouteDiscoverySchema, routeDiscovery))
                )
            ).build()
        );
    }
}

async function handleNodeInfoApp(envelope: RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet">, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let nodeInfo = fromBinary(meshtastic.Mesh.UserSchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("NodeInfoApp", envelope), `${nodeInfo.id} (${nodeInfo.shortName}) ${nodeInfo.longName} ${nodeInfo.role} ${nodeInfo.hwModel}`);
    
    if (envelope.packet.to === stringUidToNumber(config.meshtastic.node.id) && envelope.packet.payloadVariant.value.wantResponse) {
        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .packetPayload(packet => packet
                .defaults()
                .setDestination(envelope.packet.from)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.NODEINFO_APP)
                    .setRequestId(envelope.packet.id)
                    .setPayload(defaultNodeInfoBinary())
                )
            ).build()
        );
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
        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .packetPayload(packet => packet
                .defaults()
                .setDestination(envelope.packet.from)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.POSITION_APP)
                    .setRequestId(envelope.packet.id)
                    .setPayload(defaultPositionBinary())
                )
            ).build()
        );
    }
}

export interface TextMessageContext {
    packet: IncomingPacket;
    message: string;
    isEncrypted: boolean;
    replyDestinationHint: number;
}

export interface TextCommandHandler {
    name?: string;
    test: (ctx: TextMessageContext) => boolean;
    handler: (ctx: TextMessageContext) => Promise<void>;
}

const TextCommandHandlers: TextCommandHandler[] = [];

async function handleTextMessageApp(envelope: PopulatedServiceEnvelope, receivedTopic: string) {
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
                replyDestinationHint: envelope.channelId === "PKI" ? envelope.packet.from : 0xffffffff,
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

export async function handleIncomingPacket(envelope: PopulatedServiceEnvelope, receivedTopic: string) {
    updateNodeDBInfo(envelope.packet);

    if (envelope.packet.payloadVariant.case === "decoded") {
        await handleDecodedPacket(envelope, receivedTopic);
        return;
    }

    if (envelope.packet.payloadVariant.case === "encrypted") {
        if (envelope.packet.pkiEncrypted && envelope.packet.to !== stringUidToNumber(config.meshtastic.node.id)) {
            console.log(formatPacketLog(receivedTopic, envelope), "PKI message but not for us. ignoring.");
            return;
        }

        try {
            let data: meshtastic.Mesh.Data;

            if (envelope.packet.pkiEncrypted) {
                const payload = decryptPKIPacket(envelope.packet.publicKey, envelope.packet);
                data = fromBinary(meshtastic.Mesh.DataSchema, payload);
            } else {
                const channelPSK = config.channels.find(c => c.name === envelope.channelId)?.psk;
                const psk = channelPSK ? PSK.fromBase64String(channelPSK) : PSK.defaultPSK;

                const nonce = createNonce(envelope.packet.from, envelope.packet.id);
                const result = decrypt(psk, nonce, envelope.packet.payloadVariant.value);
                data = fromBinary(meshtastic.Mesh.DataSchema, result);
            }

            envelope.packet.payloadVariant = {
                value: data,
                case: "decoded",
            };
        } catch (e) {
            console.log("failed to decrypt message", e);
            return;
        }
        
        await handleDecodedPacket(envelope, receivedTopic);
        return;
    }

    if (envelope.packet.payloadVariant.case === undefined) {
        console.log(formatPacketLog(receivedTopic, envelope), "received message with empty payload");
        return;
    }
}

async function handleDecodedPacket(envelope: PopulatedServiceEnvelope, receivedTopic: string) {
    if (envelope.packet.payloadVariant.case !== "decoded") {
        console.error(
            formatPacketLog(receivedTopic, envelope), 
            "handleDecodedPacket was called, but packet's payload variant is not 'decoded'.", 
            `case=${envelope.packet.payloadVariant.case}`
        );
        return;
    }

    switch (envelope.packet.payloadVariant.value.portnum) {
        case meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP: {
            await handleTextMessageApp(envelope, receivedTopic);
            return;
        }
        case meshtastic.Portnums.PortNum.NODEINFO_APP: {
            await handleNodeInfoApp(envelope, receivedTopic);
            return;
        }
        case meshtastic.Portnums.PortNum.POSITION_APP: {
            await handlePositionApp(envelope, receivedTopic);
            return;
        }
        case meshtastic.Portnums.PortNum.TRACEROUTE_APP: {
            await handleTracerouteApp(envelope, receivedTopic);
            return;
        }
        case meshtastic.Portnums.PortNum.TELEMETRY_APP: {
            await handleTelemetryApp(envelope, receivedTopic);
            return;
        }
        default: {
            console.log(formatPacketLog(receivedTopic, envelope), envelope, envelope.packet.payloadVariant);
            return;
        }
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

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .setChannelId(ctx.packet.channelId)
            .packetPayload(packet => packet
                .defaults()
                .setDestination(ctx.replyDestinationHint)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP)
                    .setReplyId(ctx.packet.id)
                    .setPayload(Buffer.from(response, "utf-8"))
                )
            ).build()
        );
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

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .setChannelId(ctx.packet.channelId)
            .packetPayload(packet => packet
                .defaults()
                .setDestination(ctx.replyDestinationHint)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP)
                    .setReplyId(ctx.packet.id)
                    .setPayload(Buffer.from(response, "utf-8"))
                )
            ).build()
        );
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

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .setChannelId(ctx.packet.channelId)
            .packetPayload(packet => packet
                .defaults()
                .setDestination(ctx.replyDestinationHint)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP)
                    .setReplyId(ctx.packet.id)
                    .setPayload(Buffer.from(emoji, "utf-8"))
                    .setEmoji(Number(true))
                )
            ).build()
        );
    }
});

class StatsMetric {
    private value1h?: () => InstantVector[];
    private value24h?: () => InstantVector[];
    private decimalPlaces: number = 0;
    constructor(public name: string) {}

    public setDecimalPlaces(v: number) {
        this.decimalPlaces = v;
        return this;
    }

    public setValue1h(v: () => InstantVector[]) {
        this.value1h = v;
        return this;
    }

    public setValue24h(v: () => InstantVector[]) {
        this.value24h = v;
        return this;
    }

    private formatInstantVector(v: InstantVector[] | undefined) {
        if (v && v[0] && v[0].hasScalarValue()) {
            return v[0].value.value.toFixed(this.decimalPlaces);
        } else {
            return "-";
        }
    }

    public format(): string {
        const v1 = this.value1h ? this.value1h() : undefined;
        const v24 = this.value24h ? this.value24h() : undefined;

        return `${this.name}: ${this.formatInstantVector(v1)} (${this.formatInstantVector(v24)})`;
    }

    public toString() {
        return this.format();
    }

    public static getFormat(): string {
        return "Metric: 1h (24h)";
    }
}


TextCommandHandlers.push({
    name: "stats",
    test: (ctx) => {
        if (ctx.isEncrypted) return false;
        if (!config.bot.modules.stats.enabled) return false;
        if (!config.bot.modules.stats.channels.includes(ctx.packet.channelId)) return false;

        return ctx.message.toLowerCase() === "stats";
    },
    handler: async (ctx) => {
        const queries = config.bot.modules.stats.prometheus_queries;
        const pool = new ConcurrentPool<InstantVector[]>();

        const metrics: StatsMetric[] = [
            new StatsMetric("Pkts. RX")
                .setValue1h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_packets_rx.last_1h
                )))
                .setValue24h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_packets_rx.last_24h
                ))),

            new StatsMetric("Nodes Seen")
                .setValue1h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_nodes_seen.last_1h
                )))
                .setValue24h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_nodes_seen.last_24h
                ))),

            new StatsMetric("Uniq. Relays")
                .setValue1h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_uniq_relays.last_1h
                )))
                .setValue24h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_uniq_relays.last_24h
                ))),

            new StatsMetric("P95 Hops")
                .setDecimalPlaces(2)
                .setValue1h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_p95_hops.last_1h
                )))
                .setValue24h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_p95_hops.last_24h
                ))),

            new StatsMetric("P95 Pkt.Size")
                .setDecimalPlaces(2)
                .setValue1h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_p95_size.last_1h
                )))
                .setValue24h(pool.push(prometheus.instantQuery(
                    queries.meshtastic_p95_size.last_24h
                ))),
        ]

        await pool.runAll();

        const reply = `${StatsMetric.getFormat()}\n---\n` + metrics.join("\n");

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .setChannelId(ctx.packet.channelId)
            .packetPayload(packet => packet
                .defaults()
                .setDestination(ctx.replyDestinationHint)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP)
                    .setReplyId(ctx.packet.id)
                    .setPayload(Buffer.from(reply, "utf-8"))
                )
            ).build()
        );
    }
});
