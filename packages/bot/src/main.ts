import { create, fromBinary } from "@bufbuild/protobuf";
import * as mqtt from './mqtt.js';
import { durationOrSeconds, envelopeHasPacket, formatPacketLog, getCmdlineOption } from './utils.js';
import { defaultNodeInfoBinary, defaultPositionBinary } from './packets/response.js';
import { TelemetryBuilder } from './meshtastic/builders.js';
import { counters, getDeviceMetrics, getEnvironmentMetrics } from './telemetry.js';
import { client } from "./mqtt.js";
import { handleIncomingPacket } from "./handlers.js";
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { initNodeDB } from "./nodedb/node_db.js";
import { encryptPKIPacket, initKeyPair } from "./crypto/pki.js";
import { checkConfigSanity, config, loadConfig } from "./config/config.js";
import { MetricsExporter } from "./metrics/metrics.js";
import { ServiceEnvelopeBuilderWithDefaults } from "./packets/default_builders.js";
import { initPrometheusAPI } from "./prometheus.js";

let configFile = getCmdlineOption("--config", "-c");

if (configFile === "") {
    console.error("config file option specified but no value is provided. check your command line options.");
    process.exit(1);
}

if (configFile === null) {
    configFile = "./config.yaml";
    console.log(`config file is not specified, using default location '${configFile}'`);
}

if (!loadConfig(configFile)) {
    console.error(
        `could not find config file at location '${configFile}'.`, 
        "file was created with default configuration.",
        "please edit it to your needs and restart the program.",
    );
    process.exit(1);
}

const configProblems = checkConfigSanity(config);
if (configProblems.length > 0) {
    console.error(
        [
        `found configuration file problems:`,
        ...configProblems.map(p => ` - ${p}`),
        "please fix them and restart the program."
        ].join("\n")
    );
    process.exit(1);
}

if (config.prometheus) {
    initPrometheusAPI(config.prometheus.url);
}

initNodeDB();
initKeyPair(config.meshtastic.pki.private_key_path);
await mqtt.initMQTT();

const metricsExporter = new MetricsExporter();
if (config.metrics.enabled) {
    console.log(`"Starting Prometheus metrics server on http://${config.metrics.listen_address}:${config.metrics.listen_port}/metrics`);
    mqtt.initMqttTxMetrics(metricsExporter.registry);
    metricsExporter.serve(config.metrics.listen_address, config.metrics.listen_port);
}

class ReceivedPacketInfo {
    constructor(
        public id: number, 
        public from: number, 
        public to: number, 
        public portnum: number, 
        public receivedAt: Date = new Date()) {}

    static fromPacket(p: any) {
        return new this(
            p.id, 
            p.from, 
            p.to, 
            p.payloadVariant?.value?.portnum ?? 0
        );
    }

    public compare(i: this) {
        return this.id === i.id &&
            this.from === i.from &&
            this.to === i.to &&
            this.portnum === i.portnum &&
            this.receivedAt.getDate() === i.receivedAt.getDate();
    }
}

const receivedPackets: ReceivedPacketInfo[] = [];

setInterval(() => {
    if (receivedPackets.length === 0) return;
    
    // console.log("cleaning up received packets info cache...");
    let counter = 0;
    for (let i = 0; i < receivedPackets.length; i++) {
        const p = receivedPackets[i];
        if (!p) continue;
        if (new Date().getTime() - p.receivedAt.getTime()  > 300 * 1000) {
            receivedPackets.splice(i);
            counter++;
        }
    }
    if (counter !== 0) {
        console.log(`removed ${counter} entries from packets info cache.`);
    }
}, 60 * 1000);

client.on("message", async (topic, message) => {
    if (!topic.startsWith(config.mqtt.root_topic)) {
        console.log(`received mqtt message with unknown root_topic, topic=${topic}`);
        return;
    }

    if (topic === config.mqtt.root_topic) {
        console.log(`received mqtt message with valid root_topic, but no subtopic was provided`);
        return;
    }

    const subtopic = topic.slice(config.mqtt.root_topic.length);
    const subtopicParts = subtopic.split("/");

    const apiVersion = subtopicParts[0];
    const messageType = subtopicParts[1];

    if (apiVersion !== "2") return;

    if (!messageType) {
        console.log(`malformed mqtt topic=${topic}, no message type.`);
        return;
    }

    switch (messageType) {
        case "json": {
            console.log(`received json message on mqtt topic=${topic}, it is not supported though.`);
            return;
        }
        case "map": {
            console.log(`received map report message on mqtt topic=${topic}, it is not supported though.`);
            return;
        }
        case "e": {
            await handleMQTTCryptMessage(topic, subtopicParts, message);
            return;
        }
        // this is for custom firmware with radio sniffing feature
        case "sniff": {
            await handleMQTTSniffMessage(topic, subtopicParts, message);
            return;
        }
        default: {
            console.log(`received unknown message type=${messageType} on mqtt topic=${topic}.`);
            return;
        }
    }
});

async function handleMQTTSniffMessage(topic: string, subtopicParts: string[], message: Buffer) {
    // [ "2", "sniff", "gatewayId" ]
    if (subtopicParts.length < 3) {
        console.log(`malformed mqtt sniff message topic=${topic}`);
        return;
    }

    const mqttGateway = subtopicParts[2]!;

    let envelope: meshtastic.Mqtt.ServiceEnvelope;
    try {
        envelope = create(meshtastic.Mqtt.ServiceEnvelopeSchema, {
            gatewayId: mqttGateway,
            channelId: "SNIFF",
            packet: fromBinary(meshtastic.Mesh.MeshPacketSchema, message),
        });
    } catch (e) {
        console.error(`failed to construct ServiceEnvelope from sniffed MeshPacket, topic=${topic}, error=${e}`);
        return;
    }
    
    await handleServiceEnvelope(topic, envelope);
}

async function handleMQTTCryptMessage(topic: string, subtopicParts: string[], message: Buffer) {
    // [ "2", "e", "channelId", "gatewayId" ]
    if (subtopicParts.length < 4) {
        console.log(`malformed mqtt crypt message topic=${topic}`);
        return;
    }

    const mqttChannelId = subtopicParts[2];
    const mqttGateway = subtopicParts[3];

    let envelope: meshtastic.Mqtt.ServiceEnvelope;
    try {
        envelope = fromBinary(meshtastic.Mqtt.ServiceEnvelopeSchema, message);
    } catch (e) {
        console.error(`failed to decode ServiceEnvelope, topic=${topic}, error=${e}`);
        return;
    }

    counters.numPacketsRx++;

    if (envelope.channelId !== mqttChannelId) {
        console.warn(formatPacketLog(topic, envelope), "channelId of ServiceEnvelope and MQTT topic does not match.");
    }

    if (envelope.gatewayId !== mqttGateway) {
        console.warn(formatPacketLog(topic, envelope), "gatewayId of ServiceEnvelope and MQTT topic does not match.");
    }

    if (envelope.gatewayId === config.meshtastic.node.id) {
        return;
    }

    await handleServiceEnvelope(topic, envelope);
}

async function handleServiceEnvelope(topic: string, envelope: meshtastic.Mqtt.ServiceEnvelope) {
    if (envelope.gatewayId !== config.mqtt.gateway) {
        console.log(formatPacketLog(topic, envelope), `received message from unknown gateway, throwing away.`);
        return;
    }

    if (!envelopeHasPacket(envelope)) {
        console.log(formatPacketLog(topic, envelope), `received message without packet inside, throwing away.`);
        return;
    }

    metricsExporter.collectIncomingPacketMetrics(envelope);

    const packetInfo = ReceivedPacketInfo.fromPacket(envelope.packet);
    if (receivedPackets.findIndex(p => p.compare(packetInfo)) !== -1) {
        counters.numRxDupe++;
        console.log(formatPacketLog(topic, envelope), `duplicate packet with id=${packetInfo.id}, throwing away.`);
        return;
    } else {
        receivedPackets.push(packetInfo);
    }

    // console.log(topic, envelope);

    await handleIncomingPacket(envelope, topic);
}

async function sendNodeInfo() {
    await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
        .defaults()
        .packetPayload(packet => packet
            .defaults()
            .setDestination(0xffffffff)
            .dataPayload(data => data
                .defaults()
                .setPortnum(meshtastic.Portnums.PortNum.NODEINFO_APP)
                .setPayload(defaultNodeInfoBinary())
            )
        ).build()
    );
    console.log("node info sent");
}

async function sendPosition() {
    await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
        .defaults()
        .packetPayload(packet => packet
            .defaults()
            .setDestination(0xffffffff)
            .dataPayload(data => data
                .defaults()
                .setPortnum(meshtastic.Portnums.PortNum.POSITION_APP)
                .setPayload(defaultPositionBinary())
            )
        ).build()
    );
    console.log("position sent");
}

async function sendEnvironmentMetrics() {
    try {
        const metrics = await getEnvironmentMetrics();
        if (!metrics) return;

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .packetPayload(packet => packet
                .defaults()
                .setDestination(0xffffffff)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TELEMETRY_APP)
                    .setPayload(new TelemetryBuilder()
                        .setTime(Math.floor(new Date().getTime() / 1000))
                        .environmentMetrics(m => m
                            .setTemperature(metrics.temperature)
                            .setBarometricPressure(metrics.barometricPressure)
                        )
                        .buildBinary()
                    )
                )
            ).build()
        );
        console.log("environment metrics sent");
    } catch (e) {
        console.log("failed to send environment metrics:", e);
    }
}

async function sendDeviceMetrics() {
    try {
        const metrics = await getDeviceMetrics();
        if (!metrics) return;

        await mqtt.sendPacket(new ServiceEnvelopeBuilderWithDefaults()
            .defaults()
            .packetPayload(packet => packet
                .defaults()
                .setDestination(0xffffffff)
                .dataPayload(data => data
                    .defaults()
                    .setPortnum(meshtastic.Portnums.PortNum.TELEMETRY_APP)
                    .setPayload(new TelemetryBuilder()
                        .setTime(Math.floor(new Date().getTime() / 1000))
                        .deviceMetrics(m => m
                            .setBatteryLevel(metrics.batteryLevel)
                            .setUptimeSeconds(metrics.uptimeSeconds)
                        )
                        .buildBinary()
                    )
                )
            ).build()
        );
        console.log("device metrics sent");
    } catch (e) {
        console.log("failed to send device metrics:", e);
    }
}

// async function sendTraceroute(dest: number) {
//     await mqtt.sendPacket(
//         new PacketBuilder()
//             .setChannelId(DEFAULT_CHANNEL)
//             .setDestination(dest)
//             .setPayload({
//                 case: "decoded",
//                 value: create(meshtastic.Mesh.DataSchema, {
//                     portnum: meshtastic.Portnums.PortNum.TRACEROUTE_APP,
//                     payload: toBinary(meshtastic.Mesh.RouteDiscoverySchema, create(meshtastic.Mesh.RouteDiscoverySchema, {})),
//                 }),
//             })
//             .build()
//     );
// }

const intervals = config.meshtastic.mesh.broadcast_intervals;
const intervals_ms: Record<keyof typeof config.meshtastic.mesh.broadcast_intervals, number> = {
    position: durationOrSeconds(intervals.position, 1 * 60 * 60),
    node_info: durationOrSeconds(intervals.node_info, 1 * 60 * 60),
    device_metrics: durationOrSeconds(intervals.device_metrics, 1 * 60 * 60),
    environment_metrics: durationOrSeconds(intervals.environment_metrics, 1 * 60 * 60),
}

setInterval(async () => {
    await sendEnvironmentMetrics();
}, intervals_ms.environment_metrics);

setInterval(async () => {
    await sendNodeInfo();
}, intervals_ms.node_info);

setInterval(async () => {
    await sendDeviceMetrics();
}, intervals_ms.device_metrics);

setInterval(async () => {
    await sendPosition();
}, intervals_ms.position);

await sendNodeInfo();
await sendPosition();
await sendEnvironmentMetrics();
await sendDeviceMetrics();

// #TODO pki encryption WIP
// const pkt = new PacketBuilder()
//     .setChannelId(DEFAULT_CHANNEL)
//     .setDestination(stringUidToNumber(env.MSH_GATEWAY))
//     .setPayload({
//         case: "decoded",
//         value: create(meshtastic.Mesh.DataSchema, {
//             portnum: meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP,
//             payload: Buffer.from("meowww", "utf-8"),
//         }),
//     })
//     .build();

// pkt.packet!.payloadVariant = {
//     case: "encrypted",
//     value: encryptPKIPacket(new Uint8Array(), pkt.packet!),
// };
// pkt.packet!.pkiEncrypted = true;

// await mqtt.sendPacket(pkt);