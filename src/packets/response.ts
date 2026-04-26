import { create, toBinary } from "@bufbuild/protobuf";
import * as meshtastic from '../meshtastic.js';
import { PacketBuilder } from "./packet_builder.js";
import type { DeviceMetrics, EnvironmentMetrics, LocalStats } from "../telemetry.js";
import { keypair } from "../crypto/pki.js";
import { config } from "../config/config.js";
import { mshStringRoleToEnum, type MeshtasticRoles } from "../utils.js";

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
                    id: config.meshtastic.node.id,
                    longName: config.meshtastic.node.name.long,
                    shortName: config.meshtastic.node.name.short,
                    hwModel: meshtastic.Mesh.HardwareModel.UNSET,
                    role: mshStringRoleToEnum(config.meshtastic.node.role as MeshtasticRoles),
                    isUnmessagable: config.meshtastic.node.is_unmessageable,
                    publicKey: keypair.getPublicKey(),
                })),
                requestId,
            }),
        })
        .build();
}

export function createPositionResponse(channelId: string, destination: number, requestId: number = 0) {
    const message = create(meshtastic.Mesh.PositionSchema);

    if (config.meshtastic.node.location?.latitude !== undefined) {
        message.latitudeI = Math.floor(config.meshtastic.node.location.latitude / 1e-7);
    }

    if (config.meshtastic.node.location?.longitude !== undefined) {
        message.longitudeI = Math.floor(config.meshtastic.node.location.longitude / 1e-7);
    }

    if (config.meshtastic.node.location?.altitude !== undefined) {
        message.altitude = config.meshtastic.node.location.altitude;
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