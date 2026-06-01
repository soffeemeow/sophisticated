export const defaultPSK = Buffer.from([0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59, 0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01]);

export function fromBase64String(psk: string) {
    const buf = Buffer.from(psk, "base64");
    
    if (buf.length === 1) {
        return fromShortPSK(buf[0]!);
    }

    if (buf.length !== 16 && buf.length !== 32) {
        throw new Error(`Invalid psk length: ${buf.length}`);
    }

    return buf;
}

/**
 * @param short one byte "short" psk
 * @returns full 32 byte psk (default psk and last byte bumped by short psk)
 */
export function fromShortPSK(short: number | string) {
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
