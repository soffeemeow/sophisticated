import { create } from "@bufbuild/protobuf";
import * as meshtastic from '../meshtastic.js';
import { stringUidToNumber } from "../utils.js";
import * as env from '../env.js';

export class PacketBuilder {
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

        return create(meshtastic.Mqtt.ServiceEnvelopeSchema, {
            channelId: this.channelId,
            gatewayId: env.MSH_UID,
            packet: create(meshtastic.Mesh.MeshPacketSchema, {
                id: this.packetId,
                from: stringUidToNumber(env.MSH_UID),
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
