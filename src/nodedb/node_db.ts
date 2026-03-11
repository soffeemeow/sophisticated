import * as meshtastic from '../meshtastic.js';
import { JSONNodeDB } from './json_node_db.js';
import * as env from '../env.js';

export interface NodeInfoStorage {
    updateNode: (id: string | number, data: meshtastic.Mesh.NodeInfo) => void;
    updateUser: (id: string | number, data: meshtastic.Mesh.User) => void;
    getNode: (id: string | number) => meshtastic.Mesh.NodeInfo | undefined;
    getUser: (id: string | number) => meshtastic.Mesh.User | undefined;
}

let nodedb: NodeInfoStorage;

export function initNodeDB() {
    if (nodedb !== undefined) {
        throw new Error("NodeDB is already initialized.");
    }
    nodedb = new JSONNodeDB(env.JSON_NODEDB);
}

export { nodedb }