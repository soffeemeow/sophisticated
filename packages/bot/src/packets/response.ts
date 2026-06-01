import { create, toBinary } from "@bufbuild/protobuf";
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { keypair } from "../crypto/pki.js";
import { config } from "../config/config.js";
import { mshStringRoleToEnum, type MeshtasticRoles } from "../utils.js";

export function defaultNodeInfo(): meshtastic.Mesh.User {
    const nodeInfo = create(meshtastic.Mesh.UserSchema);

    nodeInfo.id = config.meshtastic.node.id;
    nodeInfo.longName = config.meshtastic.node.name.long;
    nodeInfo.shortName = config.meshtastic.node.name.short;
    nodeInfo.hwModel = meshtastic.Mesh.HardwareModel.UNSET;
    nodeInfo.role = mshStringRoleToEnum(config.meshtastic.node.role as MeshtasticRoles);
    nodeInfo.isUnmessagable = config.meshtastic.node.is_unmessageable;
    nodeInfo.publicKey = keypair.getPublicKey();
    nodeInfo.isLicensed = false;

    return nodeInfo;
}

export function defaultNodeInfoBinary() {
    return toBinary(meshtastic.Mesh.UserSchema, defaultNodeInfo());
}

export function defaultPosition() {
    const position = create(meshtastic.Mesh.PositionSchema);

    if (config.meshtastic.node.location?.latitude !== undefined) {
        position.latitudeI = Math.floor(config.meshtastic.node.location.latitude / 1e-7);
    }

    if (config.meshtastic.node.location?.longitude !== undefined) {
        position.longitudeI = Math.floor(config.meshtastic.node.location.longitude / 1e-7);
    }

    if (config.meshtastic.node.location?.altitude !== undefined) {
        position.altitude = config.meshtastic.node.location.altitude;
    }

    return position;
}

export function defaultPositionBinary() {
    return toBinary(meshtastic.Mesh.PositionSchema, defaultPosition());
}
