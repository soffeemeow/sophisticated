import mqtt from 'mqtt';
import * as meshtastic from "@sophisticated/meshtastic-proto";
import { toBinary } from "@bufbuild/protobuf";
import { counters } from './telemetry.js';
import { Counter, Registry } from 'prom-client';
import { formatPacketLog, getChannelHash, toStringUserId } from './utils.js';
import { encryptPacket, pskFromString } from './crypto/crypto.js';
import { config } from './config/config.js';

let client: mqtt.MqttClient;

export async function initMQTT() {
    if (client) {
        throw new Error("MQTT client is already initialized.");
    }

    const clientOpts: mqtt.IClientOptions = {
        host: config.mqtt.connection.host,
        port: config.mqtt.connection.port,
        clientId: `sophisticated-${Math.floor(Math.random() * 0xffff)}`,
    };

    if (config.mqtt.connection.user) {
        clientOpts.username = config.mqtt.connection.user;
    }

    if (config.mqtt.connection.password) {
        clientOpts.password = config.mqtt.connection.password;
    }

    client = await mqtt.connectAsync(clientOpts);
    await client.subscribeAsync(config.mqtt.root_topic + "/#");
}

const mesh_packets_sent_counter = new Counter({
    name: "meshtastic_mesh_packets_sent_count",
    help: "Total count of packets sent since startup",
    labelNames: ["gateway", "channel", "from", "to", "port"],
});

function initMqttTxMetrics(registry: Registry) {
    registry.registerMetric(mesh_packets_sent_counter);
}

async function sendPacket(envelope: meshtastic.Mqtt.ServiceEnvelope) {
    if (envelope.packet === undefined) {
        throw new Error("Packet is empty in ServiceEnvelope.");
    }

    if (config.mqtt.encryption && envelope.packet.payloadVariant.case !== "encrypted") {
        const channel = config.channels.find(c => c.name === envelope.channelId);

        if (!channel) {
            console.warn(formatPacketLog("MQTT_SEND_ENCRYPTED", envelope), `channel '${envelope.channelId}' not found in config`);
            return;
        }

        const psk = pskFromString(channel.psk);

        envelope.packet.channel = getChannelHash(envelope.channelId, psk);
        envelope.packet.payloadVariant = {
            case: "encrypted",
            value: encryptPacket(psk, envelope.packet),
        };
    }

    await client.publishAsync(config.mqtt.root_topic + "/2/e/" + envelope.channelId + "/" + envelope.gatewayId, Buffer.from(toBinary(
        meshtastic.Mqtt.ServiceEnvelopeSchema, 
        envelope,
    )));

    counters.numPacketsTx++;

    mesh_packets_sent_counter.inc({
        gateway: envelope.gatewayId,
        channel: envelope.channelId,
        from: toStringUserId(envelope.packet.from),
        to: toStringUserId(envelope.packet.to),
        port: envelope.packet.payloadVariant.case === "decoded" ? envelope.packet.payloadVariant.value.portnum : 0,
    });
}

export {
    client, 
    sendPacket,
    initMqttTxMetrics,
}
