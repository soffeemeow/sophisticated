import winston from "winston";
import { getCmdlineOption, toStringUserId } from "./utils.js";
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { color, Fg, Style } from "./colors.js";

const logFormat = getCmdlineOption("--log-format") ?? "plain";
const logLevel = getCmdlineOption("--log-level") ?? "info";

const plainFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(info => {
        let output = `${info.timestamp} [${info.level}]`;

        let module = "main";
        if ("module" in info && typeof info.module === "string") {
            module = info.module;
        }
        output += ` [${color.style.dim(module)}]`;

        if ("tag" in info && typeof info.tag === "string") {
            output += ` [${color.custom(info.tag, Style.Dim, Fg.Blue)}]`;
        }

        if ("msh_env" in info) {
            const envelope = info.msh_env as meshtastic.Mqtt.ServiceEnvelope;
            output += ` [${color.fg.gray("#" + envelope.channelId)}]`;

            if (envelope.packet) {
                const senderString = toStringUserId(envelope.packet.from);
                const destString = envelope.packet.to === 0xffffffff ? "*" : toStringUserId(envelope.packet.to);

                const packetInfo: string[] = [];
                if (envelope.packet.wantAck) {
                    packetInfo.push(color.fg.yellow("ack"));
                }
                if (envelope.packet.payloadVariant.case === "decoded" && envelope.packet.payloadVariant.value.wantResponse) {
                    packetInfo.push(color.fg.yellow("req"));
                }
                if (envelope.packet.payloadVariant.case === "encrypted") {
                    packetInfo.push(color.fg.yellow("crypt"));
                }
                if (envelope.packet.payloadVariant.case === "decoded" && envelope.packet.payloadVariant.value.replyId) {
                    packetInfo.push(color.fg.yellow("reply"));
                }
                if (envelope.packet.payloadVariant.case === "decoded" && envelope.packet.payloadVariant.value.emoji) {
                    packetInfo.push(color.fg.yellow("emoji"));
                }
                
                const hops = envelope.packet.hopStart - envelope.packet.hopLimit;
                if (hops > 0) {
                    packetInfo.push(`hops=${color.fg.yellow(hops)}/${color.fg.yellow(envelope.packet.hopStart)}`);
                } else {
                    packetInfo.push(`snr=${color.fg.yellow(envelope.packet.rxSnr)}`);
                    packetInfo.push(`rssi=${color.fg.yellow(envelope.packet.rxRssi)}`);
                }

                if (packetInfo.length > 0) {
                    output += ` [${packetInfo.join(" ")}]`;
                }

                output += ` [\x1b[34m${senderString}\x1b[0m -> \x1b[34m${destString}\x1b[0m]`;
            }
        }
        
        output += ` ${info.message}`;
        return output;
    })
);


    

const formats: Record<string, winston.Logform.Format> & { default: winston.Logform.Format } = {
    json: winston.format.json(),
    plain: plainFormat,
    default: plainFormat,
}

const logger = winston.createLogger({
    level: logLevel,
    format: formats[logFormat] ?? formats.default,
    transports: [
        new winston.transports.Console()
    ],
});

export function getLogger() {
    return logger;
}