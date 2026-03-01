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