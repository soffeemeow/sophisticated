import { createCipheriv, createDecipheriv } from "node:crypto";
import { toBinary } from "@bufbuild/protobuf";
import { Mesh } from "../meshtastic.js";

export const defaultPSK = Buffer.from([0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59, 0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01]);

/**
 * @param short one byte "short" psk
 * @returns full 32 byte psk (default psk and last byte bumped by short psk)
 */
export function shortPskUnwrap(short: number | string) {
    if (typeof short === "string") {
        const buf = Buffer.from(short, "base64");
        if (buf.length > 1) {
            throw new Error("Short psk must be only one byte long in base64");
        }
        if (buf.length === 0) {
            throw new Error("Empty short psk in base64");
        }
        short = buf.at(0)!;
    }

    if (short < 0 || short > 255) {
        throw new Error("Short psk must be one byte long (0-255)");
    }

    const longPsk = Buffer.copyBytesFrom(defaultPSK);
    if (longPsk.length === 0) {
        throw new Error("Default psk is empty buffer. This should not have happened.");
    }
    
    longPsk[longPsk.length - 1]! += short - 1;

    return longPsk;
}

export function createNonce(fromNode: number, packetId: number, extraNonce?: number) {
    const nonce = Buffer.alloc(16);

    // https://github.com/meshtastic/firmware/blob/0cab43fb43192cb81d585f3a0fded4fe1d286cc7/src/mesh/CryptoEngine.cpp#L290
    //
    // they're writing uint64_t packet_id into the nonce but packet id is actually uint32_t
    // so basically only first 4 bytes are written (if we're using 32 bit packet ids)
    nonce.writeUint32LE(packetId);
    nonce.writeUInt32LE(fromNode, 8);

    if (extraNonce !== undefined) {
        // i guess we're writing extra nonce into the free space we've got after previous step
        nonce.writeUint32LE(extraNonce, 4);
    }

    return nonce;
}

/** WIP */
export function decryptPacket(key: Uint8Array, packet: Mesh.MeshPacket) {
    if (packet.payloadVariant.case !== "encrypted") {
        throw new Error("Packet is not encrypted");
    }

    const nonce = createNonce(packet.from, packet.id);
    const decipher = createDecipheriv(key.length === 16 ? 'aes-128-ctr' : 'aes-256-ctr', key, nonce);

    const decryptedData = decipher.update(packet.payloadVariant.value);
    
    decipher.final();

    return decryptedData;
}

/** WIP */
export function encryptPacket(key: Uint8Array, packet: Mesh.MeshPacket) {
    if (packet.payloadVariant.case === "encrypted") {
        throw new Error("Packet is already encrypted");
    }

    if (packet.payloadVariant.value === undefined) {
        throw new Error("Packet has no payload");
    }

    const nonce = createNonce(packet.from, packet.id);
    const cipher = createCipheriv(key.length === 16 ? 'aes-128-ctr' : 'aes-256-ctr', key, nonce);

    const encryptedData = cipher.update(toBinary(Mesh.DataSchema, packet.payloadVariant.value));
    
    cipher.final();

    return encryptedData;
}