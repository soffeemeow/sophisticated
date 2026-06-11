import mqtt from 'mqtt';
import * as meshtastic from "@sophisticated/meshtastic-proto";
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { counters } from './telemetry.js';
import { Counter, Registry } from 'prom-client';
import { envelopeHasPacket, getChannelHash, toStringUserId } from './utils.js';
import { createNonce, encrypt, PSK } from '@sophisticated/meshtastic-crypto';
import { config } from './config/config.js';
import { encryptPKIPacket } from './crypto/pki.js';
import { nodedb } from './nodedb/node_db.js';
import { getLogger } from './logger.js';
import { metricsExporter } from './metrics/metrics.js';
import { handleIncomingPacket } from './handlers.js';

const _logger = getLogger().child({ module: "mqtt" });

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
    client.on("message", handleMQTTMessage);
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
    const logger = _logger.child({ tag: "sendPacket", msh_env: envelope });

    if (envelope.packet === undefined) {
        throw new Error("Packet is empty in ServiceEnvelope.");
    }

    if (config.mqtt.encryption && envelope.packet.payloadVariant.case === "decoded" && envelope.channelId !== "PKI") {
        const channel = config.channels.find(c => c.name === envelope.channelId);

        if (!channel) {
            logger.warn(`MQTT_SEND_ENCRYPTED: channel '${envelope.channelId}' not found in config`);
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
            logger.error(`MQTT_SEND_PKI: unable to send pki message: broadcast address as destination is not allowed!`);
            return;
        }

        const user = nodedb.getUser(envelope.packet.to);
        if (!user) {
            logger.warn(`MQTT_SEND_PKI: unable to send pki message: no nodedb entry found for node ${toStringUserId(envelope.packet.to)}`);
            return;
        }

        const data = encryptPKIPacket(user.publicKey, envelope.packet);

        envelope.packet.channel = 0;
        envelope.packet.payloadVariant = {
            case: "encrypted",
            value: data,
        };
    }

    logger.info("publishing message to mqtt");

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
    
    _logger.debug("cleaning up received packets info cache...");
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
        _logger.info(`removed ${counter} entries from packets info cache.`);
    }
}, 60 * 1000);

async function handleMQTTMessage(topic: string, message: Buffer) {
    const logger = _logger.child({ tag: "MQTTMessageHandler" });

    logger.debug(`incoming mqtt message on topic ${topic}`, { topic, size: message.length });
    
    if (!topic.startsWith(config.mqtt.root_topic)) {
        logger.warn(`received mqtt message with unknown root_topic, topic=${topic}`, { topic });
        return;
    }

    if (topic === config.mqtt.root_topic) {
        logger.warn(`received mqtt message with valid root_topic, but no subtopic was provided`);
        return;
    }

    const subtopic = topic.slice(config.mqtt.root_topic.length + 1);
    const subtopicParts = subtopic.split("/");

    const apiVersion = subtopicParts[0];
    const messageType = subtopicParts[1];

    if (apiVersion !== "2") return;

    if (!messageType) {
        logger.warn(`malformed mqtt topic=${topic}, no message type.`, { topic });
        return;
    }

    switch (messageType) {
        case "json": {
            logger.warn(`received json message on mqtt topic=${topic}, it is not supported though.`, { topic });
            return;
        }
        case "map": {
            logger.warn(`received map report message on mqtt topic=${topic}, it is not supported though.`, { topic });
            return;
        }
        case "e": {
            logger.debug("propagating received message down into handleMQTTCryptMessage");
            await handleMQTTCryptMessage(topic, subtopicParts, message);
            return;
        }
        // this is for custom firmware with radio sniffing feature
        case "sniff": {
            logger.debug("propagating received message down into handleMQTTSniffMessage");
            await handleMQTTSniffMessage(topic, subtopicParts, message);
            return;
        }
        default: {
            logger.warn(`received unknown message type=${messageType} on mqtt topic=${topic}.`, { topic, message_type: messageType });
            return;
        }
    }
}

async function handleMQTTSniffMessage(topic: string, subtopicParts: string[], message: Buffer) {
    const logger = _logger.child({ tag: "MQTTSniffMessageHandler" });

    // [ "2", "sniff", "gatewayId" ]
    if (subtopicParts.length < 3) {
        logger.warn(`malformed mqtt sniff message topic=${topic}`, { topic });
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
        logger.error(`failed to construct ServiceEnvelope: ${e}`, { topic, error: e, error_message: `${e}` });
        return;
    }
    
    logger.debug("propagating received message down into handleServiceEnvelope");
    await handleServiceEnvelope(topic, envelope);
}

async function handleMQTTCryptMessage(topic: string, subtopicParts: string[], message: Buffer) {
    const logger = _logger.child({ tag: "MQTTCryptMessageHandler" });

    // [ "2", "e", "channelId", "gatewayId" ]
    if (subtopicParts.length < 4) {
        logger.warn(`malformed mqtt crypt message topic=${topic}`, { topic });
        return;
    }

    const mqttChannelId = subtopicParts[2];
    const mqttGateway = subtopicParts[3];

    let envelope: meshtastic.Mqtt.ServiceEnvelope;
    try {
        envelope = fromBinary(meshtastic.Mqtt.ServiceEnvelopeSchema, message);
    } catch (e) {
        logger.error(`failed to decode ServiceEnvelope: ${e}`, { topic, error: e, error_message: `${e}` });
        return;
    }

    counters.numPacketsRx++;

    if (envelope.channelId !== mqttChannelId) {
        logger.warn("channelId of ServiceEnvelope and MQTT topic does not match.");
    }

    if (envelope.gatewayId !== mqttGateway) {
        logger.warn("gatewayId of ServiceEnvelope and MQTT topic does not match.");
    }

    if (envelope.gatewayId === config.meshtastic.node.id) {
        logger.debug("ignoring message originating from us");
        return;
    }

    logger.debug("propagating received message down into handleServiceEnvelope");
    await handleServiceEnvelope(topic, envelope);
}

async function handleServiceEnvelope(topic: string, envelope: meshtastic.Mqtt.ServiceEnvelope) {
    const logger = _logger.child({ tag: "ServiceEnvelopeHandler" });

    if (envelope.gatewayId !== config.mqtt.gateway) {
        logger.info(`received message from unknown gateway ${envelope.gatewayId}, throwing away.`, { gateway: envelope.gatewayId });
        return;
    }

    if (!envelopeHasPacket(envelope)) {
        logger.warn("received message without packet inside, throwing away.");
        return;
    }

    metricsExporter.collectIncomingPacketMetrics(envelope);

    const packetInfo = ReceivedPacketInfo.fromPacket(envelope.packet);
    if (receivedPackets.findIndex(p => p.compare(packetInfo)) !== -1) {
        counters.numRxDupe++;
        logger.info(`duplicate packet with id=${packetInfo.id}, throwing away.`, { packet_id: packetInfo.id });
        return;
    } else {
        receivedPackets.push(packetInfo);
    }

    logger.debug("propagating received ServiceEnvelope down into handleIncomingPacket");
    await handleIncomingPacket(envelope, topic);
}

export {
    client, 
    sendPacket,
    initMqttTxMetrics,
}
