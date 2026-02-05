import mqtt from 'mqtt';
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import fs from 'fs/promises';
import fetch from 'node-fetch';

const TOPIC = process.env.MQTT_TOPIC ?? "";
const GATEWAY = process.env.MSH_GATEWAY!;

const MSH_UID = process.env.MSH_BOT_UID!;
const MSH_SHORT_NAME = process.env.MSH_SHORT_NAME!;
const MSH_LONG_NAME = process.env.MSH_LONG_NAME!;

const MSH_POS_LAT = process.env.MSH_POS_LAT;
const MSH_POS_LON = process.env.MSH_POS_LON;
const MSH_POS_ALT = process.env.MSH_POS_ALT;

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

const client = await mqtt.connectAsync("mqtt://" + process.env.MQTT_ADDRESS);
await client.subscribeAsync(TOPIC + "/#");

function toStringUserId(value: number) {
    return "!" + value.toString(16).padStart(8, "0");
}

function stringUidToNumber(value: string) {
    if (value[0] !== "!") return NaN;
    return parseInt(value.toLowerCase().slice(1), 16);
}

class PacketBuilder {
    private channelId?: string;
    private packetId?: number;
    private destination?: number;
    private hopsStart: number = 7;
    private priority: number = 100;
    private payload?: any;

    public setChannelId(channelId: string) {
        this.channelId = channelId;
        return this;
    }

    public setDestination(destination: number) {
        this.destination = destination;
        return this;
    }

    public setPacketId(packetId: number) {
        this.packetId = packetId;
        return this;
    }

    public setPriority(priority: number) {
        this.priority = priority;
        return this;
    }

    public setHopsStart(hopsStart: number) {
        this.hopsStart = hopsStart;
        return this;
    }

    public setPayload(payload: any) {
        this.payload = payload;
        return this;
    }

    public build() {
        if (this.channelId === undefined) throw new Error("channelId is not defined");
        if (this.destination === undefined) throw new Error("destination is not defined");

        if (this.packetId === undefined) {
            this.packetId = Math.floor(Math.random() * 3914268768);
        }

        return create(Protobuf.Mqtt.ServiceEnvelopeSchema, {
            channelId: this.channelId,
            gatewayId: MSH_UID,
            packet: create(Protobuf.Mesh.MeshPacketSchema, {
                id: this.packetId,
                from: stringUidToNumber(MSH_UID),
                to: this.destination,
                priority: this.priority,
                viaMqtt: false,
                hopLimit: 7,
                hopStart: this.hopsStart,
                payloadVariant: this.payload
            }),
        });
    }
}

function formatPacketLog(pfx: string, envelope: any) {
    const senderString = toStringUserId(envelope.packet.from);
    const destString = toStringUserId(envelope.packet.to);

    const flags = (envelope.packet.wantAck ? '!' : '.') +
        (envelope.packet.payloadVariant.value?.wantResponse ? '?' : '.');

    const hops = envelope.packet.hopStart - envelope.packet.hopLimit;
    let recvInfo;
    if (hops > 0) {
        recvInfo = `H: ${hops}/${envelope.packet.hopStart}`;
    } else {
        recvInfo = `S: ${envelope.packet.rxSnr}, R: ${envelope.packet.rxRssi}`;
    }

    return `[${pfx}] [#${envelope.channelId}] <${flags}> [${recvInfo}] [${senderString} -> ${destString}]`
}

async function sendPacket(envelope: any) {
    await client.publishAsync(TOPIC + "/2/e/" + envelope.channelId + "/" + envelope.gatewayId, Buffer.from(toBinary(
        Protobuf.Mqtt.ServiceEnvelopeSchema, 
        envelope,
    )));
}

function createTextResponse(channelId: string, destination: number, text: string, replyId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(Protobuf.Mesh.DataSchema, {
                portnum: Protobuf.Portnums.PortNum.TEXT_MESSAGE_APP,
                payload: Buffer.from(text),
                replyId,
            }),
    })
    .build();
}

function createNodeInfoResponse(channelId: string, destination: number, requestId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(Protobuf.Mesh.DataSchema, {
                portnum: Protobuf.Portnums.PortNum.NODEINFO_APP,
                payload: toBinary(Protobuf.Mesh.UserSchema, create(Protobuf.Mesh.UserSchema, {
                    id: MSH_UID,
                    longName: MSH_LONG_NAME,
                    shortName: MSH_SHORT_NAME,
                    hwModel: Protobuf.Mesh.HardwareModel.UNSET,
                    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
                    isUnmessagable: true,
                })),
                requestId,
            }),
        })
        .build();
}

function createPositionResponse(channelId: string, destination: number, requestId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(Protobuf.Mesh.DataSchema, {
                portnum: Protobuf.Portnums.PortNum.POSITION_APP,
                payload: toBinary(Protobuf.Mesh.PositionSchema, create(Protobuf.Mesh.PositionSchema, {
                    time: Math.floor(new Date().getTime() / 1000),
                    latitudeI: MSH_POS_LAT ? Math.floor(parseFloat(MSH_POS_LAT) / 1e-7) : undefined,
                    longitudeI: MSH_POS_LON ? Math.floor(parseFloat(MSH_POS_LON) / 1e-7) : undefined,
                    altitude: MSH_POS_ALT ? parseInt(MSH_POS_ALT) : undefined,
                })),
                requestId,
            }),
        })
        .build();
}

async function createTelemetryEnvironmentMetricsResponse(channelId: string, destination: number, requestId: number = 0) {
    const temperatureResult = await queryPrometheus(`avg_over_time(world_temperature{job="micrometeo", location="outside"}[1m])`);
    const pressureResult = await queryPrometheus(`avg_over_time(world_atmospheric_pressure{job="micrometeo", location="home"}[1m])`);
    
    if (temperatureResult.resultType !== "vector" || pressureResult.resultType !== "vector") return;
    if (temperatureResult.result.length === 0 || pressureResult.result.length === 0) return;

    const temperature = parseFloat(temperatureResult.result[0].value[1]);
    const barometricPressure = parseFloat(pressureResult.result[0].value[1]);

    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(Protobuf.Mesh.DataSchema, {
                portnum: Protobuf.Portnums.PortNum.TELEMETRY_APP,
                payload: toBinary(Protobuf.Telemetry.TelemetrySchema, create(Protobuf.Telemetry.TelemetrySchema, {
                    time: Math.floor(new Date().getTime() / 1000),
                    variant: {
                        case: "environmentMetrics",
                        value: {
                            temperature,
                            barometricPressure,
                        }
                    }
                })),
                requestId,
            }),
        })
        .build();
}

async function queryPrometheus(query: string, time: Date = new Date()) {
    if (!PROMETHEUS_URL) {
        throw new Error("PROMETHEUS_URL is not defined");
    }
    
    const body = await (await fetch(PROMETHEUS_URL + "/api/v1/query", {
        method: "POST",
        body: new URLSearchParams({
            query,
            time: `${time.getTime() / 1000}`,
        }),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    })).json() as { 
        status: string;
        data: {
            resultType: string;
            result: any;
        }
        error?: string;
    };

    if (body.status !== "success") {
        throw new Error(`prometheus query failed: ${body.error}`);
    }

    return body.data;
}

async function handleTextMessageApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    const senderString = toStringUserId(envelope.packet.from);

    let msg: string;
    if (envelope.packet.payloadVariant.case === "decoded") {
        msg = envelope.packet.payloadVariant.value.payload.toString();
    } else if (envelope.packet.payloadVariant.case === "encrypted") {
        msg = "<encrypted message>";
    } else {
        return;
    }

    const msgLower = msg.toLowerCase();

    console.log(formatPacketLog("TextMessageApp", envelope), msg);

    if (envelope.packet.payloadVariant.case !== "decoded") return;
    if (envelope.channelId !== "Services") return;

    let response;
    if (msgLower === "ping" || msgLower === "пинг") {
        const hops = envelope.packet.hopStart - envelope.packet.hopLimit;

        if (hops > 0) {
            response = `Pong to ${senderString} 🕸️ (Hops: ${hops}/${envelope.packet.hopStart})`;
        } else {
            response = `Pong to ${senderString} 📡 (S: ${envelope.packet.rxSnr}, R: ${envelope.packet.rxRssi})`;
        }
    } else if (msgLower === "weather" || msgLower === "погода") {
        try {
            const temperatureResult = await queryPrometheus(`avg_over_time(world_temperature{job="micrometeo", location="outside"}[1m])`);
            const pressureResult = await queryPrometheus(`avg_over_time(world_atmospheric_pressure{job="micrometeo", location="home"}[1m]) / 1.333224`);
            
            if (temperatureResult.resultType !== "vector" || pressureResult.resultType !== "vector") return;
            if (temperatureResult.result.length === 0 || pressureResult.result.length === 0) return;

            const temperature = parseFloat(temperatureResult.result[0].value[1]);
            const pressure = parseFloat(pressureResult.result[0].value[1]);

            response = `На улице: 🌡️ ${temperature.toFixed(2)} °C, ☁️ ${pressure.toFixed(2)} mmHg`
        } catch (e) {
            console.error("prometheus query failed:", e);
            return;
        }
    } else {
        return;
    }

    await sendPacket(createTextResponse(envelope.channelId, 0xffffffff, response, envelope.packet.id));
}

async function handleNodeInfoApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let nodeInfo = fromBinary(Protobuf.Mesh.UserSchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("NodeInfoApp", envelope), `${nodeInfo.id} (${nodeInfo.shortName}) ${nodeInfo.longName} ${nodeInfo.role} ${nodeInfo.hwModel}`);
    
    if (envelope.packet.to === stringUidToNumber(MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        await sendPacket(createNodeInfoResponse(envelope.channelId, envelope.packet.from, envelope.packet.id));
    }
}

async function handlePositionApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let position = fromBinary(Protobuf.Mesh.PositionSchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("PositionApp", envelope), `LAT: ${position.latitudeI * 1e-7}, LON: ${position.latitudeI * 1e-7}, ALT: ${position.altitude}, SRC: ${position.locationSource}`);
    
    if (envelope.to === stringUidToNumber(MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        await sendPacket(createPositionResponse(envelope.channelId, envelope.packet.from, envelope.packet.id));
    }
}

async function handleTracerouteApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let routeDiscovery = fromBinary(Protobuf.Mesh.RouteDiscoverySchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("TracerouteApp", envelope), routeDiscovery);
    
    if (envelope.packet.to === stringUidToNumber(MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        await sendPacket(
            new PacketBuilder()
                .setChannelId(envelope.channelId)
                .setDestination(envelope.packet.from)
                .setPayload({
                    case: "decoded",
                    value: create(Protobuf.Mesh.DataSchema, {
                        portnum: Protobuf.Portnums.PortNum.TRACEROUTE_APP,
                        payload: toBinary(Protobuf.Mesh.RouteDiscoverySchema, routeDiscovery),
                        requestId: envelope.packet.id,
                    }),
                })
                .build()
        );
    }
}

async function handleTelemetryApp(envelope: any, receivedTopic: string) {
    if (!envelope.packet.payloadVariant) return;
    if (envelope.packet.payloadVariant.case !== "decoded") return;

    let telemetry = fromBinary(Protobuf.Telemetry.TelemetrySchema, envelope.packet.payloadVariant.value.payload);

    console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] at ${new Date(telemetry.time * 1000).toISOString()}`, telemetry.variant.value);
    
    if (envelope.packet.to === stringUidToNumber(MSH_UID) && envelope.packet.payloadVariant.value.wantResponse) {
        switch (telemetry.variant.case) {
            case "environmentMetrics": {
                await sendPacket(await createTelemetryEnvironmentMetricsResponse(envelope.channelId, envelope.packet.from, envelope.packet.id));
                return;
            }
            default: {
                console.log(formatPacketLog("TelemetryApp", envelope), `[${telemetry.variant.case}] unsupported telemetry request`);
                return;
            }
        }
    }
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
    const envelope = fromBinary(Protobuf.Mqtt.ServiceEnvelopeSchema, message);

    const packetInfo = ReceivedPacketInfo.fromPacket(envelope.packet);
    if (receivedPackets.findIndex(p => p.compare(packetInfo)) !== -1) {
        console.log(formatPacketLog(topic, envelope), `duplicate packet with id=${packetInfo.id}, throwing away.`);
        return;
    } else {
        receivedPackets.push(packetInfo);
    }

    // console.log(topic, envelope);

    if (envelope.gatewayId !== GATEWAY) return;

    switch (envelope.packet.payloadVariant.value.portnum) {
        case Protobuf.Portnums.PortNum.TEXT_MESSAGE_APP: {
            return await handleTextMessageApp(envelope, topic);
        }
        case Protobuf.Portnums.PortNum.NODEINFO_APP: {
            return await handleNodeInfoApp(envelope, topic);
        }
        case Protobuf.Portnums.PortNum.POSITION_APP: {
            return await handlePositionApp(envelope, topic);
        }
        case Protobuf.Portnums.PortNum.TRACEROUTE_APP: {
            return await handleTracerouteApp(envelope, topic);
        }
        case Protobuf.Portnums.PortNum.TELEMETRY_APP: {
            return await handleTelemetryApp(envelope, topic);
        }
        default: {
            console.log(formatPacketLog(topic, envelope), envelope, envelope.packet.payloadVariant);
        }
    }
});

const DEFAULT_CHANNEL = "LongFast";

async function sendNodeInfo() {
    await sendPacket(createNodeInfoResponse(DEFAULT_CHANNEL, 0xffffffff));
    console.log("node info sent");
}

async function sendPosition() {
    await sendPacket(createPositionResponse(DEFAULT_CHANNEL, 0xffffffff));
    console.log("position sent");
}

async function sendTelemetry() {
    await sendPacket(await createTelemetryEnvironmentMetricsResponse(DEFAULT_CHANNEL, 0xffffffff));
    console.log("telemetry sent");
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
