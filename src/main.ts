import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as mqtt from './mqtt.js';
import { durationOrSeconds, envelopeHasPacket, formatPacketLog, getCmdlineOption, stringUidToNumber, toStringUserId } from './utils.js';
import { createNodeInfoResponse, createPositionResponse, createTelemetryDeviceMetricsResponse, createTelemetryEnvironmentMetricsResponse } from './packets/response.js';
import { PacketBuilder } from './packets/packet_builder.js';
import { counters, getDeviceMetrics, getEnvironmentMetrics } from './telemetry.js';
import { client } from "./mqtt.js";
import { handleIncomingPacket } from "./handlers.js";
import * as meshtastic from './meshtastic.js';
import { getRegistry, initMeshtasticRxMetrics, initMetrics } from "./metrics/metrics.js";
import { initNodeDB } from "./nodedb/node_db.js";
import { encryptPKIPacket, initKeyPair } from "./crypto/pki.js";
import { checkConfigSanity, config, loadConfig } from "./config/config.js";

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

initNodeDB();
initKeyPair(config.meshtastic.pki.private_key_path);
await mqtt.initMQTT();

let rxMetrics: ReturnType<typeof initMeshtasticRxMetrics> | undefined;
if (config.metrics.enabled) {
    console.log("Initializing Prometheus Metrics...");
    initMetrics();
    const metricsRegistry = getRegistry();
    rxMetrics = initMeshtasticRxMetrics(metricsRegistry);
    mqtt.initMqttTxMetrics(metricsRegistry);
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
    counters.numPacketsRx++;

    const envelope = fromBinary(meshtastic.Mqtt.ServiceEnvelopeSchema, message);

    if (envelope.gatewayId === config.meshtastic.node.id) {
        return;
    }

    if (envelope.gatewayId !== config.mqtt.gateway) {
        console.log(formatPacketLog(topic, envelope), `received message from unknown gateway, throwing away.`);
        return;
    }

    if (!envelopeHasPacket(envelope)) {
        console.log(formatPacketLog(topic, envelope), `received message without packet inside, throwing away.`);
        return;
    }

    const labels = {
        gateway: envelope.gatewayId,
        channel: envelope.channelId,
        from: toStringUserId(envelope.packet.from),
        to: toStringUserId(envelope.packet.to),
        relayNode: envelope.packet.relayNode.toString(16).padStart(2, "0"),
        port: envelope.packet.payloadVariant.case === "decoded" ? envelope.packet.payloadVariant.value.portnum : 0,
    };
    
    const histogramLabels = {
        gateway: labels.gateway,
        from: labels.from,
        relayNode: labels.relayNode,
    }

    if (config.metrics.enabled && rxMetrics) {
        rxMetrics.mesh_packets_received_counter.inc(labels);

        rxMetrics.mesh_packets_received_hops_histogram.observe(histogramLabels, envelope.packet.hopStart - envelope.packet.hopLimit);
        rxMetrics.mesh_packets_received_rssi_histogram.observe(histogramLabels, envelope.packet.rxRssi);
        rxMetrics.mesh_packets_received_snr_histogram.observe(histogramLabels, envelope.packet.rxSnr);
    }

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
});


const DEFAULT_CHANNEL = "LongFast";

async function sendNodeInfo() {
    await mqtt.sendPacket(createNodeInfoResponse(DEFAULT_CHANNEL, 0xffffffff));
    console.log("node info sent");
}

async function sendPosition() {
    await mqtt.sendPacket(createPositionResponse(DEFAULT_CHANNEL, 0xffffffff));
    console.log("position sent");
}

async function sendEnvironmentMetrics() {
    const metrics = await getEnvironmentMetrics();
    if (!metrics) return;

    await mqtt.sendPacket(createTelemetryEnvironmentMetricsResponse(DEFAULT_CHANNEL, 0xffffffff, metrics));
    console.log("environment metrics sent");
}

async function sendDeviceMetrics() {
    const metrics = await getDeviceMetrics();
    if (!metrics) return;

    await mqtt.sendPacket(await createTelemetryDeviceMetricsResponse(DEFAULT_CHANNEL, 0xffffffff, metrics));
    console.log("device metrics sent");
}

async function sendTraceroute(dest: number) {
    await mqtt.sendPacket(
        new PacketBuilder()
            .setChannelId(DEFAULT_CHANNEL)
            .setDestination(dest)
            .setPayload({
                case: "decoded",
                value: create(meshtastic.Mesh.DataSchema, {
                    portnum: meshtastic.Portnums.PortNum.TRACEROUTE_APP,
                    payload: toBinary(meshtastic.Mesh.RouteDiscoverySchema, create(meshtastic.Mesh.RouteDiscoverySchema, {})),
                }),
            })
            .build()
    );
}

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