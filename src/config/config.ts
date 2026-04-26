import YAML from 'yaml';
import { validate } from '../validator.js';
import { ConfigSchema } from './schemas.js';
import merge from "lodash.merge";
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { MeshtasticDeprecatedRoles, MeshtasticRoles } from '../utils.js';

export interface MQTTConnectionConfig {
    host: string;
    port: number;
    user?: string;
    password?: string;
}

export interface MQTTConfig {
    connection: MQTTConnectionConfig
    root_topic: string;
    gateway: string;
    encryption: boolean;
}

export interface LocationConfig {
    latitude: number;
    longitude: number;
    altitude: number;
}

export interface NodeConfig {
    id: string;
    name: {
        short: string;
        long: string;
    };
    role: string;
    location?: LocationConfig;
    is_unmessageable: boolean;
}

export interface MeshConfig {
    broadcast_intervals: {
        position: string | number;
        node_info: string | number;
        device_metrics: string | number;
        environment_metrics: string | number;
    };
    hop_limits: {
      all: number;
      bg_telemetry: number;
    };
}

export interface MeshtasticConfig {
    node: NodeConfig;
    mesh: MeshConfig;
    state_file_path: string;
    pki: {
        private_key_path: string;
    };
    node_db: {
        type: "json";
        json_db_file_path: string;
    };
}

export interface ChannelConfig {
    name: string;
    psk: string;
    primary?: boolean;
}

export interface BOTModuleConfig {
    enabled: boolean;
    channels: string[];
}

export interface PingModuleConfig extends BOTModuleConfig {
    six_seven_enabled: boolean;
    six_seven_proc: number;
}

export interface BOTConfig {
    enabled: boolean;
    modules: {
        weather: BOTModuleConfig;
        animals: BOTModuleConfig;
        ping: PingModuleConfig;
    }
}

export interface PrometheusConfig {
    url: string;
    queries: {
        temperature: string;
        barometric_pressure: string;
    }
}

export interface MetricsConfig {
    enabled: boolean;
    listen_address: string;
    listen_port: number;
}

export interface Config {
    mqtt: MQTTConfig;
    meshtastic: MeshtasticConfig;
    channels: ChannelConfig[];
    bot: BOTConfig;
    prometheus?: PrometheusConfig;
    metrics: MetricsConfig;
}

export function getDefaultConfig(): Config {
    return {
        mqtt: {
            connection: {
                host: '127.0.0.1',
                port: 1883
            },
            root_topic: 'msh',
            gateway: 'CHANGE_ME',
            encryption: false
        },
        meshtastic: {
            node: {
                id: "CHANGE_ME",
                name: {
                    short: "CHANGE_ME",
                    long: "CHANGE_ME"
                },
                role: 'CLIENT_MUTE',
                is_unmessageable: false
            },
            mesh: {
                broadcast_intervals: {
                    position: '24h',
                    node_info: '6h',
                    device_metrics: '6h',
                    environment_metrics: '1h'
                },
                hop_limits: {
                    all: 3,
                    bg_telemetry: 1
                }
            },
            state_file_path: './state.json',
            pki: {
                private_key_path: './private.key'
            },
            node_db: {
                type: 'json',
                json_db_file_path: './nodedb.json'
            }
        },
        channels: [
            {
                name: "LongFast",
                psk: "AQ==",
                primary: true
            }
        ],
        bot: {
            enabled: false,
            modules: {
                ping: {
                    enabled: false,
                    channels: [ "LongFast" ],
                    six_seven_enabled: false,
                    six_seven_proc: 0.35
                },
                weather: {
                    enabled: false,
                    channels: [ "LongFast" ]
                },
                animals: {
                    enabled: false,
                    channels: [ "LongFast" ]
                }
            }
        },
        metrics: {
            enabled: false,
            listen_address: '127.0.0.1',
            listen_port: 9067
        }
    }
}

let runningConfig: Config;

export function loadConfig(path: string) {
    if (!existsSync(path)) {
        writeFileSync(path, YAML.stringify(getDefaultConfig(), { indent: 2 }));
        return false;
    }

    const data = readFileSync(path, "utf-8");
    const yaml = YAML.parse(data) as Partial<Config>;

    const withDefaults = merge(getDefaultConfig(), yaml);
    runningConfig = validate(withDefaults, ConfigSchema);

    return true;
}

const checkDefaults = [
    ["mqtt", "gateway"],
    ["meshtastic", "node", "id"],
    ["meshtastic", "node", "name", "short"],
    ["meshtastic", "node", "name", "long"],
];

type AllowedRolesTable = { [K in MeshtasticRoles]: K extends MeshtasticDeprecatedRoles ? false : true };

const allowedRoles: AllowedRolesTable = {
    CLIENT: true,
    CLIENT_MUTE: true,
    ROUTER: true,
    ROUTER_CLIENT: false,
    REPEATER: false,
    TRACKER: true,
    SENSOR: true,
    TAK: true,
    CLIENT_HIDDEN: true,
    LOST_AND_FOUND: true,
    TAK_TRACKER: true,
    ROUTER_LATE: true,
    CLIENT_BASE: true
}

/**
 * ## DO NOT CALL ON UNVALIDATED CONFIGS
 * @returns list of found problems
 */
export function checkConfigSanity(config: Config) {
    const defaultConfig = getDefaultConfig();
    const problems = [];

    for(const check of checkDefaults) {
        let actualValue = config as any;
        let defaultValue = defaultConfig as any;

        for(const path of check) {
            actualValue = actualValue[path];
            defaultValue = defaultValue[path];
        }

        if (actualValue === defaultValue) {
            problems.push(`default value of '<root>.${check.join(".")}' must be changed`);
        }
    }

    if (config.mqtt.connection.port < 1 || config.mqtt.connection.port > 0xffff) {
        problems.push(`value of '<root>.mqtt.connection.port' must be in range 1-${0xffff}`);
    }

    if (config.metrics.listen_port < 1 || config.metrics.listen_port > 0xffff) {
        problems.push(`value of '<root>.metrics.listen_port' must be in range 1-${0xffff}`);
    }

    if (config.meshtastic.mesh.hop_limits.all < 0 || config.meshtastic.mesh.hop_limits.all > 7) {
        problems.push(`value of '<root>.meshtastic.mesh.hop_limits.all' must be in range 0-7`);
    }

    if (config.meshtastic.mesh.hop_limits.bg_telemetry < 0 || config.meshtastic.mesh.hop_limits.bg_telemetry > 7) {
        problems.push(`value of '<root>.meshtastic.mesh.hop_limits.bg_telemetry' must be in range 0-7`);
    }

    if (!(config.meshtastic.node.role in allowedRoles) || !allowedRoles[config.meshtastic.node.role as keyof AllowedRolesTable]) {
        const allowed = Object.entries(allowedRoles).filter(r => r[1]).map(r => r[0]).join(", ");
        problems.push(`value of '<root>.meshtastic.node.role' must be one of ${allowed}`);
    }

    return problems;
}

export {
    runningConfig as config,
}