import mqtt from 'mqtt';
import * as meshtastic from './meshtastic.js';
import { toBinary } from "@bufbuild/protobuf";
import * as env from './env.js';
import { counters } from './telemetry.js';
import { Counter, Registry } from 'prom-client';
import { getChannelHash, toStringUserId } from './utils.js';
import { defaultPSK, encryptPacket } from './crypto/crypto.js';

const client = await mqtt.connectAsync("mqtt://" + process.env.MQTT_ADDRESS);
await client.subscribeAsync(env.MQTT_TOPIC + "/#");

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

    counters.numPacketsTx++;
    
    if (env.IS_DEV_ENVIRONMENT) {
        envelope.packet.hopLimit = 0;
        envelope.packet.hopStart = 0;
    }

    mesh_packets_sent_counter.inc({
        gateway: envelope.gatewayId,
        channel: envelope.channelId,
        from: toStringUserId(envelope.packet.from),
        to: toStringUserId(envelope.packet.to),
        port: envelope.packet.payloadVariant.case === "decoded" ? envelope.packet.payloadVariant.value.portnum : 0,
    });

    if (env.ENABLE_ENCRYPTION && envelope.packet.payloadVariant.case !== "encrypted") {
        envelope.packet.channel = getChannelHash(envelope.channelId, defaultPSK);
        envelope.packet.payloadVariant = {
            case: "encrypted",
            value: encryptPacket(defaultPSK, envelope.packet),
        };
    }

    await client.publishAsync(env.MQTT_TOPIC + "/2/e/" + envelope.channelId + "/" + envelope.gatewayId, Buffer.from(toBinary(
        meshtastic.Mqtt.ServiceEnvelopeSchema, 
        envelope,
    )));
}

export {
    client, 
    sendPacket,
    initMqttTxMetrics,
}
