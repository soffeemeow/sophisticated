import { create, toBinary } from "@bufbuild/protobuf";
import * as meshtastic from '../meshtastic.js';
import { PacketBuilder } from "./packet_builder.js";
import * as env from '../env.js';
import type { DeviceMetrics, EnvironmentMetrics, LocalStats } from "../telemetry.js";
import { keypair } from "../crypto/pki.js";

export function createTextResponse(channelId: string, destination: number, text: string, replyId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(meshtastic.Mesh.DataSchema, {
                portnum: meshtastic.Portnums.PortNum.TEXT_MESSAGE_APP,
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
            value: create(meshtastic.Mesh.DataSchema, {
                portnum: meshtastic.Portnums.PortNum.NODEINFO_APP,
                payload: toBinary(meshtastic.Mesh.UserSchema, create(meshtastic.Mesh.UserSchema, {
                    id: env.MSH_UID,
                    longName: env.MSH_LONG_NAME,
                    shortName: env.MSH_SHORT_NAME,
                    hwModel: meshtastic.Mesh.HardwareModel.UNSET,
                    role: meshtastic.Config.Config_DeviceConfig_Role.CLIENT_MUTE,
                    isUnmessagable: env.MSH_IS_UNMESSAGEABLE,
                    publicKey: keypair.getPublicKey(),
                })),
                requestId,
            }),
        })
        .build();
}

export function createPositionResponse(channelId: string, destination: number, requestId: number = 0) {
    const message = create(meshtastic.Mesh.PositionSchema);

    if (env.MSH_POS_LAT !== undefined) {
        message.latitudeI = Math.floor(parseFloat(env.MSH_POS_LAT!) / 1e-7);
    }

    if (env.MSH_POS_LON !== undefined) {
        message.longitudeI = Math.floor(parseFloat(env.MSH_POS_LON!) / 1e-7);
    }

    if (env.MSH_POS_ALT !== undefined) {
        message.altitude = parseInt(env.MSH_POS_ALT!);
    }

    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(meshtastic.Mesh.DataSchema, {
                portnum: meshtastic.Portnums.PortNum.POSITION_APP,
                payload: toBinary(meshtastic.Mesh.PositionSchema, message),
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
            value: create(meshtastic.Mesh.DataSchema, {
                portnum: meshtastic.Portnums.PortNum.TELEMETRY_APP,
                payload: toBinary(meshtastic.Telemetry.TelemetrySchema, create(meshtastic.Telemetry.TelemetrySchema, {
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

export function createTelemetryLocalStatsResponse(channelId: string, destination: number, metrics: LocalStats, requestId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(meshtastic.Mesh.DataSchema, {
                portnum: meshtastic.Portnums.PortNum.TELEMETRY_APP,
                payload: toBinary(meshtastic.Telemetry.TelemetrySchema, create(meshtastic.Telemetry.TelemetrySchema, {
                    time: Math.floor(new Date().getTime() / 1000),
                    variant: {
                        case: "localStats",
                        value: metrics
                    }
                })),
                requestId,
            }),
        })
        .build();
}

export function createTelemetryDeviceMetricsResponse(channelId: string, destination: number, metrics: DeviceMetrics, requestId: number = 0) {
    return new PacketBuilder()
        .setChannelId(channelId)
        .setDestination(destination)
        .setPayload({
            case: "decoded",
            value: create(meshtastic.Mesh.DataSchema, {
                portnum: meshtastic.Portnums.PortNum.TELEMETRY_APP,
                payload: toBinary(meshtastic.Telemetry.TelemetrySchema, create(meshtastic.Telemetry.TelemetrySchema, {
                    time: Math.floor(new Date().getTime() / 1000),
                    variant: {
                        case: "deviceMetrics",
                        value: metrics
                    }
                })),
                requestId,
            }),
        })
        .build();
}