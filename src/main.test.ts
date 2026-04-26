import { create, fromBinary } from "@bufbuild/protobuf";
import { readFile, writeFile } from "node:fs/promises";
import { Mesh, Portnums } from "./meshtastic.js";
import { encryptPKIPacket, initKeyPair } from "./crypto/pki.js";
import { initNodeDB } from "./nodedb/node_db.js";
import { config } from "./config/config.js";

initNodeDB();
initKeyPair(config.meshtastic.pki.private_key_path);

const pkt = await readFile("./rx_gw_pki.msh");
console.log("original pkt:", pkt);

const packet = fromBinary(Mesh.MeshPacketSchema, pkt);
console.log("original parsed:", packet);

if (packet.payloadVariant.case !== "encrypted") {
    throw new Error("Not encrypted packet");
}

const payloadOld = Buffer.from(packet.payloadVariant.value);

packet.payloadVariant = {
    case: "decoded",
    value: create(Mesh.DataSchema, {
                portnum: Portnums.PortNum.TEXT_MESSAGE_APP,
                payload: Buffer.from("meowww", "utf-8"),
    }),
}

const newPayload = encryptPKIPacket(new Uint8Array(), packet);

console.log("old payload:", payloadOld);
console.log("new payload:", newPayload);

writeFile("./reconst_gw_pki.msh", newPayload);