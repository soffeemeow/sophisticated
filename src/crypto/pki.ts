import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { Keypair } from "./keypair.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { Mesh } from "../meshtastic.js";
import { createNonce } from "./crypto.js";
import { nodedb } from "../nodedb/node_db.js";
import { toBinary } from "@bufbuild/protobuf";

export const keypair = new Keypair();

export function initKeyPair(keyFile: string) {
    if (keypair.initFromFile(keyFile, true)) {
        console.log(`[PKI] New keypair was generated with pubkey '${keypair.getPublicKeyString()}' and saved to file '${keyFile}'.`);
    }
}

export function decryptPKIPacket(remoteKey: Uint8Array, packet: Mesh.MeshPacket) {
    if (!keypair.isInitialized()) {
        throw new Error("Key-pair is not initialized");
    }

    if (packet.payloadVariant.case !== "encrypted") {
        throw new Error("Packet is not encrypted");
    }

    const publicKey = nodedb.getUser(packet.from)?.publicKey;

    if (!publicKey) {
        throw Error("Could not find public key of remote party in node db");
    }
    
    const sharedKey = x25519.getSharedSecret(keypair.getPrivateKey(), publicKey);
    const sharedKeyHash = createHash("sha256").update(sharedKey).digest();

    console.log("shared key hash:", sharedKeyHash);

    const payload = packet.payloadVariant.value;

    const encryptedData = payload.subarray(0, payload.length - 12);
    const auth = payload.subarray(payload.length - 12, payload.length - 4);
    const extraNonce = Buffer.from(payload).readUint32LE(payload.length - 4);
    const nonce = createNonce(packet.from, packet.id, extraNonce).subarray(0, 12);

    console.log(encryptedData.length, "enc_data:", encryptedData);
    console.log(auth.length, "auth:", auth);
    console.log("extra nonce:", extraNonce.toString(16));
    console.log(nonce.length, "nonce:", nonce);

    const decipher = createDecipheriv('aes-256-ccm', sharedKeyHash, nonce, {
        authTagLength: 8,
    });

    decipher.setAuthTag(auth);
    const decryptedData = decipher.update(encryptedData);

    try {
        decipher.final();
    } catch (err) {
        throw new Error('Authentication failed!', { cause: err });
    }

    return decryptedData;
}

export function encryptPKIPacket(remoteKey: Uint8Array, packet: Mesh.MeshPacket) {
    if (!keypair.isInitialized()) {
        throw new Error("Key-pair is not initialized");
    }

    if (packet.payloadVariant.case !== "decoded") {
        throw new Error("Packet is already encrypted or has empty payload");
    }

    const publicKey = nodedb.getUser(packet.to)?.publicKey;

    if (!publicKey) {
        throw Error("Could not find public key of remote party in node db");
    }
    
    const sharedKey = x25519.getSharedSecret(keypair.getPrivateKey(), publicKey);
    const sharedKeyHash = createHash("sha256").update(sharedKey).digest();

    console.log("shared key hash:", sharedKeyHash);

    const plainText = toBinary(Mesh.DataSchema, packet.payloadVariant.value);
    const extraNonceBytes = randomBytes(4);
    const extraNonce = extraNonceBytes.readUint32LE();
    const nonce = createNonce(packet.from, packet.id, extraNonce).subarray(0, 12);

    console.log("extra nonce:", extraNonce, extraNonceBytes);
    console.log(nonce.length, "nonce:", nonce);

    const cipher = createCipheriv('aes-256-ccm', sharedKeyHash, nonce, {
        authTagLength: 8,
    });

    const ciphertext = cipher.update(plainText);
    
    try {
        cipher.final();
    } catch (err) {
        throw new Error('Encryption failed!', { cause: err });
    }

    const auth = cipher.getAuthTag();

    return Buffer.concat([ ciphertext, auth, extraNonceBytes ]);
}
