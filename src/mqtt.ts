import mqtt from 'mqtt';
import * as Protobuf from "@meshtastic/protobufs";
import { toBinary } from "@bufbuild/protobuf";
import * as env from './env.js';
import { counters } from './telemetry.js';

const client = await mqtt.connectAsync("mqtt://" + process.env.MQTT_ADDRESS);
await client.subscribeAsync(env.MQTT_TOPIC + "/#");

async function sendPacket(envelope: any) {
    counters.numPacketsTx++;
    
    await client.publishAsync(env.MQTT_TOPIC + "/2/e/" + envelope.channelId + "/" + envelope.gatewayId, Buffer.from(toBinary(
        Protobuf.Mqtt.ServiceEnvelopeSchema, 
        envelope,
    )));
}

export {
    client, 
    sendPacket,
}