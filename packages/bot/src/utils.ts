import * as meshtastic from '@sophisticated/meshtastic-proto';
import parseDuration from 'parse-duration';

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>
export type ReadonlyBy<T, K extends keyof T> = Omit<T, K> & Readonly<Pick<T, K>>
export type NonNullableBy<T, K extends keyof T> = Omit<T, K> & NonNullable<Pick<T, K>>
export type ArrayElement<A extends readonly unknown[]> = A extends readonly (infer E)[] ? E : never;
export type AllNullable<T> = {
    [P in keyof T]: AllNullable<T[P] | undefined>;
}

export type MeshtasticRoles = keyof typeof meshtastic.Config.Config_DeviceConfig_Role;
export type MeshtasticDeprecatedRoles = "ROUTER_CLIENT" | "REPEATER";


export function durationOrSeconds(value: string | number): number | null;
export function durationOrSeconds(value: string | number, default_seconds: number): number;

/**
 * @param value duration in string format or number of seconds
 * @param default_seconds default duration to return if value is <= 0 or could not parse string duration 
 * @returns duration in milliseconds
 */
export function durationOrSeconds(value: string | number, default_seconds?: number) {
    const result = typeof value === "number" ? value * 1000 : parseDuration(value);

    if (default_seconds !== undefined && (result === null || result <= 0)) {
        return default_seconds * 1000;
    }

    return result;
}

export class ConcurrentPool<T> {
    private promises: Promise<T>[] = [];
    private results: T[] | undefined;

    public push(p: Promise<T>): () => T {
        const index = this.promises.push(p) - 1;
        return (() => {
            if (!this.results) {
                throw new Error("No results yet.");
            }
            // #FIXME maybe we should check it before returning or idk
            return this.results[index]!;
        }).bind(this);
    }

    public async runAll() {
        this.results = await Promise.all(this.promises);
    }
}

export function mshStringRoleToEnum(role: MeshtasticRoles) {
    switch(role) {
        case "CLIENT": return meshtastic.Config.Config_DeviceConfig_Role.CLIENT;
        case "CLIENT_BASE": return meshtastic.Config.Config_DeviceConfig_Role.CLIENT_BASE;
        case "CLIENT_HIDDEN": return meshtastic.Config.Config_DeviceConfig_Role.CLIENT_HIDDEN;
        case "CLIENT_MUTE": return meshtastic.Config.Config_DeviceConfig_Role.CLIENT_MUTE;
        case "LOST_AND_FOUND": return meshtastic.Config.Config_DeviceConfig_Role.LOST_AND_FOUND;
        case "REPEATER": return meshtastic.Config.Config_DeviceConfig_Role.REPEATER;
        case "ROUTER": return meshtastic.Config.Config_DeviceConfig_Role.ROUTER;
        case "ROUTER_CLIENT": return meshtastic.Config.Config_DeviceConfig_Role.ROUTER_CLIENT;
        case "ROUTER_LATE": return meshtastic.Config.Config_DeviceConfig_Role.ROUTER_LATE;
        case "SENSOR": return meshtastic.Config.Config_DeviceConfig_Role.SENSOR;
        case "TAK": return meshtastic.Config.Config_DeviceConfig_Role.TAK;
        case "TAK_TRACKER": return meshtastic.Config.Config_DeviceConfig_Role.TAK_TRACKER;
        case "TRACKER": return meshtastic.Config.Config_DeviceConfig_Role.TRACKER;
        default: throw new Error(`Unknown meshtastic role '${role}'`);
    }
}

export function toStringUserId(value: number) {
    return "!" + value.toString(16).padStart(8, "0");
}

export function stringUidToNumber(value: string) {
    if (value[0] !== "!") return NaN;
    return parseInt(value.toLowerCase().slice(1), 16);
}

export function formatPacketLog(pfx: string, envelope: any) {
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

export interface IncomingPacket {
    id: number;
    sender: string;
    senderId: number;
    channelId: string;
    hopStart: number;
    hopLimit: number;
    rxSnr: number;
    rxRssi: number;
}

export function envelopeToIncomingPacket(envelope: any): IncomingPacket {
    return {
        id: envelope.packet.id,
        sender: toStringUserId(envelope.packet.from),
        senderId: envelope.packet.from,
        channelId: envelope.channelId,
        hopStart: envelope.packet.hopStart,
        hopLimit: envelope.packet.hopLimit,
        rxSnr: envelope.packet.rxSnr,
        rxRssi: envelope.packet.rxRssi,
    };
}

export function envelopeHasPacket(envelope: meshtastic.Mqtt.ServiceEnvelope): envelope is RequiredBy<meshtastic.Mqtt.ServiceEnvelope, "packet"> {
    return envelope.packet !== undefined;
}

export function xorHash(data: Buffer) {
    return data.reduce((hash, b) => hash ^= b, 0);
}

export function getChannelHash(name: string, psk: Buffer) {
    let hash = xorHash(Buffer.from(name, "ascii"));
    hash ^= xorHash(psk);
    return hash;
}


/**
 * @returns null if option is not found, empty string if found but value is not defined, value itself otherwise
 */
export function getCmdlineOption(search: string, alias?: string) {
    let idx = process.argv.findIndex((v, i) => {
        if (i < 2) return false;
        return v === search || (alias !== undefined && v === alias);
    });

    if (idx === -1) return null;
    if (idx + 1 >= process.argv.length) return ""; 

    const value = process.argv[idx + 1];
    if (!value) return "";
    
    return value;
}