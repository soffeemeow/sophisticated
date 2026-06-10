import mqtt from 'mqtt';
import * as meshtastic from "@sophisticated/meshtastic-proto";
import { toBinary } from "@bufbuild/protobuf";
import { counters } from './telemetry.js';
import { Counter, Registry } from 'prom-client';
import { formatPacketLog, getChannelHash, toStringUserId } from './utils.js';
import { createNonce, encrypt, PSK } from '@sophisticated/meshtastic-crypto';
import { config } from './config/config.js';
import { encryptPKIPacket } from './crypto/pki.js';
import { nodedb } from './nodedb/node_db.js';

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

    if (config.mqtt.encryption && envelope.packet.payloadVariant.case === "decoded" && envelope.channelId !== "PKI") {
        const channel = config.channels.find(c => c.name === envelope.channelId);

        if (!channel) {
            console.warn(formatPacketLog("MQTT_SEND_ENCRYPTED", envelope), `channel '${envelope.channelId}' not found in config`);
            return;
        }

        const psk = PSK.fromBase64String(channel.psk);
        const nonce = createNonce(envelope.packet.from, envelope.packet.id);

        envelope.packet.channel = getChannelHash(envelope.channelId, psk);
        envelope.packet.payloadVariant = {
            case: "encrypted",
            value: encrypt(psk, nonce, toBinary(meshtastic.Mesh.DataSchema,envelope.packet.payloadVariant.value)),
        };
    }

    if (envelope.packet.payloadVariant.case === "decoded" && envelope.channelId === "PKI") {
        if (envelope.packet.to === 0xffffffff) {
            console.error(formatPacketLog("MQTT_SEND_PKI", envelope), `unable to send pki message: broadcast address as destination is not allowed!`);
            return;
        }

        const user = nodedb.getUser(envelope.packet.to);
        if (!user) {
            console.warn(formatPacketLog("MQTT_SEND_PKI", envelope), `unable to send pki message: no nodedb entry found for node ${toStringUserId(envelope.packet.to)}`);
            return;
        }

        const data = encryptPKIPacket(user.publicKey, envelope.packet);

        envelope.packet.channel = 0;
        envelope.packet.payloadVariant = {
            case: "encrypted",
            value: data,
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
