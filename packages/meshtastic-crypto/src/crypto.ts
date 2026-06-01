import { createCipheriv, createDecipheriv } from "node:crypto";

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

export function decrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array) {
    if (key.length !== 16 && key.length !== 32) {
        throw new Error(`Invalid key length: ${key.length}`);
    }

    const decipher = createDecipheriv(key.length === 16 ? 'aes-128-ctr' : 'aes-256-ctr', key, nonce);
    const decryptedData = decipher.update(data);
    
    decipher.final();

    return decryptedData;
}

export function encrypt(key: Uint8Array, nonce: Uint8Array, data: Uint8Array) {
    if (key.length !== 16 && key.length !== 32) {
        throw new Error(`Invalid key length: ${key.length}`);
    }

    const cipher = createCipheriv(key.length === 16 ? 'aes-128-ctr' : 'aes-256-ctr', key, nonce);
    const encryptedData = cipher.update(data);
    
    cipher.final();

    return encryptedData;
}