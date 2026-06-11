import * as mqtt from './mqtt.js';
import { durationOrSeconds, getCmdlineOption } from './utils.js';
import { defaultNodeInfoBinary, defaultPositionBinary } from './packets/response.js';
import { TelemetryBuilder } from './meshtastic/builders.js';
import { getDeviceMetrics, getEnvironmentMetrics } from './telemetry.js';
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { initNodeDB } from "./nodedb/node_db.js";
import { initKeyPair } from "./crypto/pki.js";
import { checkConfigSanity, config, loadConfig } from "./config/config.js";
import { metricsExporter } from "./metrics/metrics.js";
import { ServiceEnvelopeBuilderWithDefaults } from "./packets/default_builders.js";
import { initPrometheusAPI } from "./prometheus.js";
import { getLogger } from "./logger.js";

const logger = getLogger();

let configFile = getCmdlineOption("--config", "-c");

if (configFile === "") {
    logger.error("config file option specified but no value is provided. check your command line options.");
    process.exit(1);
}

if (configFile === null) {
    configFile = "./config.yaml";
    logger.warn(`config file is not specified, using default location '${configFile}'`);
}

if (!loadConfig(configFile)) {
    logger.error(
        `could not find config file at location '${configFile}'.`, 
        "file was created with default configuration.",
        "please edit it to your needs and restart the program.",
    );
    process.exit(1);
}

const configProblems = checkConfigSanity(config);
if (configProblems.length > 0) {
    logger.error(
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

if (config.metrics.enabled) {
    logger.info(`Starting Prometheus metrics server on http://${config.metrics.listen_address}:${config.metrics.listen_port}/metrics`);
    mqtt.initMqttTxMetrics(metricsExporter.registry);
    metricsExporter.serve(config.metrics.listen_address, config.metrics.listen_port);
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
    logger.info("node info sent");
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
    logger.info("position sent");
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
        logger.info("environment metrics sent");
    } catch (e) {
        logger.error("failed to send environment metrics:", e);
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
        logger.info("device metrics sent");
    } catch (e) {
        logger.error("failed to send device metrics:", e);
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

function handleExitSignal(s: string) {
    logger.info(`received ${s}, stopping application...`);
    process.exit();
}

process.on("SIGTERM", handleExitSignal);
process.on("SIGINT", handleExitSignal);
