import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import * as env from './env.js';
import * as mqtt from './mqtt.js';
import { formatPacketLog } from './utils.js';
import { createNodeInfoResponse, createPositionResponse, createTelemetryEnvironmentMetricsResponse } from './packets/response.js';
import { PacketBuilder } from './packets/packet_builder.js';
import { getEnvironmentMetrics } from './telemetry.js';
import { client } from "./mqtt.js";
import { handleIncomingPacket } from "./handlers.js";

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
    const envelope = fromBinary(Protobuf.Mqtt.ServiceEnvelopeSchema, message);

    const packetInfo = ReceivedPacketInfo.fromPacket(envelope.packet);
    if (receivedPackets.findIndex(p => p.compare(packetInfo)) !== -1) {
        console.log(formatPacketLog(topic, envelope), `duplicate packet with id=${packetInfo.id}, throwing away.`);
        return;
    } else {
        receivedPackets.push(packetInfo);
    }

    // console.log(topic, envelope);

    if (envelope.gatewayId !== env.MSH_GATEWAY) return;

    await handleIncomingPacket(env, topic);
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

async function sendTelemetry() {
    const metrics = await getEnvironmentMetrics();
    if (!metrics) return;

    await mqtt.sendPacket(createTelemetryEnvironmentMetricsResponse(DEFAULT_CHANNEL, 0xffffffff, metrics));
    console.log("telemetry sent");
}

async function sendTraceroute(dest: number) {
    await mqtt.sendPacket(
        new PacketBuilder()
            .setChannelId(DEFAULT_CHANNEL)
            .setDestination(dest)
            .setPayload({
                case: "decoded",
                value: create(Protobuf.Mesh.DataSchema, {
                    portnum: Protobuf.Portnums.PortNum.TRACEROUTE_APP,
                    payload: toBinary(Protobuf.Mesh.RouteDiscoverySchema, create(Protobuf.Mesh.RouteDiscoverySchema, {})),
                }),
            })
            .build()
    );
}

setInterval(async () => {
    await sendNodeInfo();
    await sendPosition();
}, 3600 * 1000);

setInterval(async () => {
    await sendTelemetry();
}, 300 * 1000);

await sendNodeInfo();
await sendPosition();
await sendTelemetry();
