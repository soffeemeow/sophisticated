import mqtt from 'mqtt';
import * as meshtastic from './meshtastic.js';
import { toBinary } from "@bufbuild/protobuf";
import * as env from './env.js';
import { counters } from './telemetry.js';

const client = await mqtt.connectAsync("mqtt://" + process.env.MQTT_ADDRESS);
await client.subscribeAsync(env.MQTT_TOPIC + "/#");

async function sendPacket(envelope: meshtastic.Mqtt.ServiceEnvelope) {
    counters.numPacketsTx++;
    
    if (env.IS_DEV_ENVIRONMENT) {
        if (envelope.packet) {
            envelope.packet.hopLimit = 0;
            envelope.packet.hopStart = 0;
        }
    }

    await client.publishAsync(env.MQTT_TOPIC + "/2/e/" + envelope.channelId + "/" + envelope.gatewayId, Buffer.from(toBinary(
        meshtastic.Mqtt.ServiceEnvelopeSchema, 
        envelope,
    )));
}

export {
    client, 
    sendPacket,
}
