import { create } from '@bufbuild/protobuf';
import * as meshtastic from '../meshtastic.js';
import { stringUidToNumber, toStringUserId } from '../utils.js';
import fs from "node:fs";
import type { NodeInfoStorage } from './node_db.js';

type JDBNode = Omit<meshtastic.Mesh.NodeInfo, "$typeName" | "$unknown" | "num" | "user" | "position" | "deviceMetrics">
type JDBUser = Omit<meshtastic.Mesh.User, "$typeName" | "$unknown" | "id" | "macaddr" | "role" | "hwModel" | "publicKey"> & { role: number, hwModel: number, publicKey: string }
type Defaults = { JDBNode: Required<JDBNode>, JDBUser: Required<JDBUser> }

const Defaults: Defaults = {
    JDBNode: {
        snr: 0,
        lastHeard: 0,
        channel: 0,
        viaMqtt: false,
        hopsAway: 0,
        isFavorite: false,
        isIgnored: false,
        isKeyManuallyVerified: false,
        isMuted: false
    },
    JDBUser: {
        longName: '',
        shortName: '',
        isLicensed: false,
        publicKey: '',
        isUnmessagable: false,
        role: 0,
        hwModel: 0
    },
}

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

    private validate<T>(data: any, ref: T): T {
        if (typeof data !== "object") {
            throw new Error("is not an object");
        }
        
        for (const k in ref) {
            if (!(k in data)) {
                throw new Error(`has no '${k}' field`);
            }
            
            const refFieldType = typeof ref[k as keyof T];
            const actualFieldType = typeof data[k];

            if (actualFieldType !== refFieldType) {
                throw new Error(`field '${k}' is expected to be ${refFieldType}, but found ${actualFieldType}`);
            }
        }

        return data;
    }

    private loadFromFile() {
        if (!fs.existsSync(this.filePath)) {
            this.save();
            return;
        }

        const json = fs.readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(json);

        if (!data.nodes || (typeof data.nodes !== "object")) {
            throw new Error("Failed to load JSON NodeDB: field 'nodes' does not exist or not a dictionary.");
        }

        if (!data.users || (typeof data.users !== "object")) {
            throw new Error("Failed to load JSON NodeDB: field 'users' does not exist or not a dictionary.");
        }

        for (const n in data.nodes) {
            try {
                const node = this.validate(data.nodes[n], Defaults.JDBNode);
                this.nodes.set(n, node);
            } catch (e) {
                throw new Error(`Failed to load JSON NodeDB: .nodes['${n}'] is invalid: ${e}`);
            }
        }

        for (const u in data.users) {
            try {
                const user = this.validate(data.users[u], Defaults.JDBUser);
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

        this.nodes.set(stringId, {
            snr: data.snr,
            lastHeard: data.lastHeard,
            channel: data.channel,
            viaMqtt: data.viaMqtt,
            isFavorite: data.isFavorite,
            isIgnored: data.isIgnored,
            isKeyManuallyVerified: data.isKeyManuallyVerified,
            isMuted: data.isMuted,
        });

        this.isDirty = true;
    }

    public updateUser(id: string | number, data: meshtastic.Mesh.User) {
        const stringId = typeof id === "string" ? id : toStringUserId(id);

        this.nodeUsers.set(stringId, {
            longName: data.longName,
            shortName: data.shortName,
            hwModel: data.hwModel,
            isLicensed: data.isLicensed,
            role: data.role,
            publicKey: Buffer.from(data.publicKey).toString("base64"),
        });

        this.isDirty = true;
    }
}