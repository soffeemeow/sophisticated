import { create, toBinary } from "@bufbuild/protobuf";
import * as Protobuf from "@meshtastic/protobufs";
import { PacketBuilder } from "./packet_builder.js";
import * as env from '../env.js';
import type { EnvironmentMetrics } from "../telemetry.js";

export function createTextResponse(channelId: string, destination: number, text: string, replyId: number = 0) {
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

export function createNodeInfoResponse(channelId: string, destination: number, requestId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(Protobuf.Mesh.DataSchema, {
                portnum: Protobuf.Portnums.PortNum.NODEINFO_APP,
                payload: toBinary(Protobuf.Mesh.UserSchema, create(Protobuf.Mesh.UserSchema, {
                    id: env.MSH_UID,
                    longName: env.MSH_LONG_NAME,
                    shortName: env.MSH_SHORT_NAME,
                    hwModel: Protobuf.Mesh.HardwareModel.UNSET,
                    role: Protobuf.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
                    isUnmessagable: true,
                })),
                requestId,
            }),
        })
        .build();
}

export function createPositionResponse(channelId: string, destination: number, requestId: number = 0) {
    let latitudeI: string | number | undefined = env.MSH_POS_LAT;
    let longitudeI: string | number | undefined = env.MSH_POS_LON;
    let altitude: string | number | undefined = env.MSH_POS_ALT;

    if (latitudeI !== undefined) {
        latitudeI = Math.floor(parseFloat(latitudeI) / 1e-7);
    }

    if (longitudeI !== undefined) {
        longitudeI = Math.floor(parseFloat(longitudeI) / 1e-7);
    }

    if (altitude !== undefined) {
        altitude = parseInt(altitude);
    }

    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(Protobuf.Mesh.DataSchema, {
                portnum: Protobuf.Portnums.PortNum.POSITION_APP,
                payload: toBinary(Protobuf.Mesh.PositionSchema, create(Protobuf.Mesh.PositionSchema, {
                    time: Math.floor(new Date().getTime() / 1000),
                    latitudeI,
                    longitudeI,
                    altitude,
                })),
                requestId,
            }),
        })
        .build();
}

export function createTelemetryEnvironmentMetricsResponse(channelId: string, destination: number, metrics: EnvironmentMetrics, requestId: number = 0) {
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
                        value: metrics
                    }
                })),
                requestId,
            }),
        })
        .build();
}