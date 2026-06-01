import { x25519 } from "@noble/curves/ed25519.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const keypairs = new WeakMap<any, Record<"privateKey" | "publicKey", Uint8Array>>();

export class Keypair {
    public isInitialized() {
        return keypairs.has(this);
    }

    private checkInit(mustBeInit: boolean) {
        if (keypairs.has(this) !== mustBeInit) {
            if (mustBeInit) {
                throw new Error("Keypair is not initialized.");
            } else {
                throw new Error("Keypair already initialized.");
            }
        }
    }

    public initFromPrivateKey(key: string | Uint8Array) {
        this.checkInit(false);

        const privateKey = typeof key === "string" ? Buffer.from(key, "base64") : key;
        const publicKey = x25519.getPublicKey(privateKey);

        keypairs.set(this, {
            privateKey,
            publicKey,
        });
    }

    public init(privKey: string | Uint8Array, pubKey: string | Uint8Array) {
        this.checkInit(false);

        const privateKey = typeof privKey === "string" ? Buffer.from(privKey, "base64") : privKey;
        const publicKey = typeof pubKey === "string" ? Buffer.from(pubKey, "base64") : pubKey;

        keypairs.set(this, {
            privateKey,
            publicKey,
        });
    }

    /**
     * @returns true if key file was created
     */
    public initFromFile(keyFile: string, create: boolean = false): boolean {
        if (existsSync(keyFile)) {
            const privateKey = Buffer.from(readFileSync(keyFile, "utf8"), "base64");
            this.initFromPrivateKey(privateKey);
            return false;
        }

        if (!create) {
            throw new Error("keyFile does not exist.");
        }

        const kp = x25519.keygen();
        writeFileSync(keyFile, Buffer.from(kp.secretKey).toString("base64"));        
        this.init(kp.secretKey, kp.publicKey);
        return true;
    }

    public getPrivateKey() {
        this.checkInit(true);
        return keypairs.get(this)!.privateKey;
    }

    public getPrivateKeyString() {
        return Buffer.from(this.getPrivateKey()).toString("base64");
    }

    public getPublicKey() {
        this.checkInit(true);
        return keypairs.get(this)!.publicKey;
    }

    public getPublicKeyString() {
        return Buffer.from(this.getPublicKey()).toString("base64");
    }
}
