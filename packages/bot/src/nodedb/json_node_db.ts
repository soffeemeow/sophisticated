import { create } from '@bufbuild/protobuf';
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { stringUidToNumber, toStringUserId } from '../utils.js';
import fs from "node:fs";
import type { NodeInfoStorage } from './node_db.js';
import { validate } from '../validator.js';
import { JDBNodeSchema, JDBUserSchema } from './schemas.js';

export type JDBNode = Omit<meshtastic.Mesh.NodeInfo, "$typeName" | "$unknown" | "num" | "user" | "position" | "deviceMetrics">
export type JDBUser = Omit<meshtastic.Mesh.User, "$typeName" | "$unknown" | "id" | "macaddr" | "role" | "hwModel" | "publicKey"> & { role: number, hwModel: number, publicKey: string }

export class JSONNodeDB implements NodeInfoStorage {
    private nodes: Map<string, JDBNode> = new Map();
    private nodeUsers: Map<string, JDBUser> = new Map();
    private isDirty = false;
    private isTerminating = false;
    private syncInterval: NodeJS.Timeout;

    constructor (private filePath: string) {
        this.loadFromFile();

        this.syncInterval = setInterval(async () => {
            if (!this.isDirty) return;
            if (this.isTerminating) return;
            console.log("[JSON NodeDB] saving json nodedb on disk...");
            await this.saveAsync();
            this.isDirty = false;
        // }, 5 * 60 * 1000);
        }, 1 * 60 * 1000);

        process.addListener("exit", () => {
            this.isTerminating = true;
            clearInterval(this.syncInterval);
            console.log("[JSON NodeDB] saving json nodedb on disk before exit...");
            this.save();
        });
    }

    private loadFromFile() {
        if (!fs.existsSync(this.filePath)) {
            this.save();
            return;
        }

        const json = fs.readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(json) ?? {};

        if (!data.nodes) data.nodes = {};
        if (typeof data.nodes !== "object") {
            throw new Error("Failed to load JSON NodeDB: field 'nodes' is not a dictionary.");
        }

        if (!data.users) data.users = {};
        if (typeof data.users !== "object") {
            throw new Error("Failed to load JSON NodeDB: field 'users' is not a dictionary.");
        }

        for (const n in data.nodes) {
            try {
                const node = validate(data.nodes[n], JDBNodeSchema);
                this.nodes.set(n, node);
            } catch (e) {
                throw new Error(`Failed to load JSON NodeDB: .nodes['${n}'] is invalid: ${e}`);
            }
        }

        for (const u in data.users) {
            try {
                const user = validate(data.users[u], JDBUserSchema);
                this.nodeUsers.set(u, user);
            } catch (e) {
                throw new Error(`Failed to load JSON NodeDB: .users['${u}'] is invalid: ${e}`);
            }
        }

        console.log(`[JSON NodeDB] loaded ${this.nodes.size} nodes and ${this.nodeUsers.size} users.`);
    }

    private compileJsonObject() {
        const data = {
            nodes: {},
            users: {},
        } as Record<"nodes" | "users", Record<string, any>>;

        this.nodes.forEach((n, k) => { data.nodes[k] = n });
        this.nodeUsers.forEach((n, k) => { data.users[k] = n });

        return data;
    }

    private save() {
        fs.writeFileSync(
            this.filePath, 
            JSON.stringify(this.compileJsonObject())
        );
    }

    private async saveAsync() {
        await fs.promises.writeFile(
            this.filePath,
            JSON.stringify(this.compileJsonObject()),
        );
    }

    public getNode(id: string | number): meshtastic.Mesh.NodeInfo | undefined {
        const stringId = typeof id === "string" ? id : toStringUserId(id);
        const numberId = typeof id === "number" ? id : stringUidToNumber(id);

        const node = this.nodes.get(stringId);
        if (!node) return undefined;
        const user = this.getUser(stringId) ?? {};

        return create(meshtastic.Mesh.NodeInfoSchema, {
              ...node,
              num: numberId,
              user,
              position: {}, // #TODO
              deviceMetrics: {},
        });
    }

    public getUser(id: string | number): meshtastic.Mesh.User | undefined {
        const stringId = typeof id === "string" ? id : toStringUserId(id);

        const user = this.nodeUsers.get(stringId);
        if (!user) return undefined;

        return create(meshtastic.Mesh.UserSchema, {
              ...user,
              id: stringId,
              publicKey: Buffer.from(user.publicKey, "base64"),
        });
    }

    public updateNode(id: string | number, data: meshtastic.Mesh.NodeInfo) {
        const stringId = typeof id === "string" ? id : toStringUserId(id);

        const node: JDBNode = {
            snr: data.snr,
            lastHeard: data.lastHeard,
            channel: data.channel,
            viaMqtt: data.viaMqtt,
            isFavorite: data.isFavorite,
            isIgnored: data.isIgnored,
            isKeyManuallyVerified: data.isKeyManuallyVerified,
            isMuted: data.isMuted,
        };

        if (data.hopsAway !== undefined) {
            node.hopsAway = data.hopsAway;
        }

        this.nodes.set(stringId, node);
        this.isDirty = true;
    }

    public updateUser(id: string | number, data: meshtastic.Mesh.User) {
        const stringId = typeof id === "string" ? id : toStringUserId(id);

        const user: JDBUser = {
            longName: data.longName,
            shortName: data.shortName,
            hwModel: data.hwModel,
            isLicensed: data.isLicensed,
            role: data.role,
            publicKey: Buffer.from(data.publicKey).toString("base64"),
        };

        this.nodeUsers.set(stringId, user);
        this.isDirty = true;
    }
}