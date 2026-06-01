import { config } from '../config/config.js';
import * as meshtastic from '@sophisticated/meshtastic-proto';
import { JSONNodeDB } from './json_node_db.js';

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
    nodedb = new JSONNodeDB(config.meshtastic.node_db.json_db_file_path);
}

export { nodedb }