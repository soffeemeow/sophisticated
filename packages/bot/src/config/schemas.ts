import type { ObjectSchema } from "../validator.js";
import type { Config } from "./config.js";

export const ConfigSchema: ObjectSchema<Config> = {
    mqtt: {
        array: false,
        optional: false,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: false,
            object: true,
            function: false
        },
        object_schema: {
            connection: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    host: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    port: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: true,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    user: {
                        array: false,
                        optional: true,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: true,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    password: {
                        array: false,
                        optional: true,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: true,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    }
                }
            },
            root_topic: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            gateway: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            encryption: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: true,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            }
        }
    },
    meshtastic: {
        array: false,
        optional: false,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: false,
            object: true,
            function: false
        },
        object_schema: {
            node: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    id: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    name: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            short: {
                                array: false,
                                optional: false,
                                type: {
                                    string: true,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            long: {
                                array: false,
                                optional: false,
                                type: {
                                    string: true,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    role: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    location: {
                        array: false,
                        optional: true,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: true,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            latitude: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            longitude: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            altitude: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    is_unmessageable: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: true,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    }
                }
            },
            mesh: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    broadcast_intervals: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            position: {
                                array: false,
                                optional: false,
                                type: {
                                    string: true,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            node_info: {
                                array: false,
                                optional: false,
                                type: {
                                    string: true,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            device_metrics: {
                                array: false,
                                optional: false,
                                type: {
                                    string: true,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            environment_metrics: {
                                array: false,
                                optional: false,
                                type: {
                                    string: true,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    hop_limits: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            all: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            bg_telemetry: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    ok_to_mqtt: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: true,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    }
                }
            },
            state_file_path: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            pki: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    private_key_path: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    }
                }
            },
            node_db: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    type: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    json_db_file_path: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    }
                }
            }
        }
    },
    channels: {
        array: true,
        optional: false,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: false,
            object: true,
            function: false
        },
        object_schema: {
            name: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            psk: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            primary: {
                array: false,
                optional: true,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: true,
                    symbol: false,
                    undefined: true,
                    object: false,
                    function: false
                },
                object_schema: null
            }
        }
    },
    bot: {
        array: false,
        optional: false,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: false,
            object: true,
            function: false
        },
        object_schema: {
            enabled: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: true,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            modules: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    ping: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            enabled: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: false,
                                    bigint: false,
                                    boolean: true,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            channels: {
                                array: true,
                                optional: false,
                                type: {
                                    string: true,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            six_seven_enabled: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: false,
                                    bigint: false,
                                    boolean: true,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            six_seven_proc: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: true,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    weather: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            enabled: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: false,
                                    bigint: false,
                                    boolean: true,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            channels: {
                                array: true,
                                optional: false,
                                type: {
                                    string: true,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    animals: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            enabled: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: false,
                                    bigint: false,
                                    boolean: true,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            channels: {
                                array: true,
                                optional: false,
                                type: {
                                    string: true,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    },
                    stats: {
                        array: false,
                        optional: false,
                        type: {
                            string: false,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: true,
                            function: false
                        },
                        object_schema: {
                            prometheus_queries: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: true,
                                    function: false
                                },
                                object_schema: {
                                    meshtastic_packets_rx: {
                                        array: false,
                                        optional: false,
                                        type: {
                                            string: false,
                                            number: false,
                                            bigint: false,
                                            boolean: false,
                                            symbol: false,
                                            undefined: false,
                                            object: true,
                                            function: false
                                        },
                                        object_schema: {
                                            last_1h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            },
                                            last_24h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            }
                                        }
                                    },
                                    meshtastic_nodes_seen: {
                                        array: false,
                                        optional: false,
                                        type: {
                                            string: false,
                                            number: false,
                                            bigint: false,
                                            boolean: false,
                                            symbol: false,
                                            undefined: false,
                                            object: true,
                                            function: false
                                        },
                                        object_schema: {
                                            last_1h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            },
                                            last_24h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            }
                                        }
                                    },
                                    meshtastic_uniq_relays: {
                                        array: false,
                                        optional: false,
                                        type: {
                                            string: false,
                                            number: false,
                                            bigint: false,
                                            boolean: false,
                                            symbol: false,
                                            undefined: false,
                                            object: true,
                                            function: false
                                        },
                                        object_schema: {
                                            last_1h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            },
                                            last_24h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            }
                                        }
                                    },
                                    meshtastic_p95_hops: {
                                        array: false,
                                        optional: false,
                                        type: {
                                            string: false,
                                            number: false,
                                            bigint: false,
                                            boolean: false,
                                            symbol: false,
                                            undefined: false,
                                            object: true,
                                            function: false
                                        },
                                        object_schema: {
                                            last_1h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            },
                                            last_24h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            }
                                        }
                                    },
                                    meshtastic_p95_size: {
                                        array: false,
                                        optional: false,
                                        type: {
                                            string: false,
                                            number: false,
                                            bigint: false,
                                            boolean: false,
                                            symbol: false,
                                            undefined: false,
                                            object: true,
                                            function: false
                                        },
                                        object_schema: {
                                            last_1h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            },
                                            last_24h: {
                                                array: false,
                                                optional: false,
                                                type: {
                                                    string: true,
                                                    number: false,
                                                    bigint: false,
                                                    boolean: false,
                                                    symbol: false,
                                                    undefined: false,
                                                    object: false,
                                                    function: false
                                                },
                                                object_schema: null
                                            }
                                        }
                                    }
                                }
                            },
                            enabled: {
                                array: false,
                                optional: false,
                                type: {
                                    string: false,
                                    number: false,
                                    bigint: false,
                                    boolean: true,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            },
                            channels: {
                                array: true,
                                optional: false,
                                type: {
                                    string: true,
                                    number: false,
                                    bigint: false,
                                    boolean: false,
                                    symbol: false,
                                    undefined: false,
                                    object: false,
                                    function: false
                                },
                                object_schema: null
                            }
                        }
                    }
                }
            }
        }
    },
    prometheus: {
        array: false,
        optional: true,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: true,
            object: true,
            function: false
        },
        object_schema: {
            url: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            queries: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: true,
                    function: false
                },
                object_schema: {
                    temperature: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    },
                    barometric_pressure: {
                        array: false,
                        optional: false,
                        type: {
                            string: true,
                            number: false,
                            bigint: false,
                            boolean: false,
                            symbol: false,
                            undefined: false,
                            object: false,
                            function: false
                        },
                        object_schema: null
                    }
                }
            }
        }
    },
    metrics: {
        array: false,
        optional: false,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: false,
            object: true,
            function: false
        },
        object_schema: {
            enabled: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: true,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            listen_address: {
                array: false,
                optional: false,
                type: {
                    string: true,
                    number: false,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            },
            listen_port: {
                array: false,
                optional: false,
                type: {
                    string: false,
                    number: true,
                    bigint: false,
                    boolean: false,
                    symbol: false,
                    undefined: false,
                    object: false,
                    function: false
                },
                object_schema: null
            }
        }
    },
    i_exactly_know_what_i_am_doing: {
        array: false,
        optional: true,
        type: {
            string: false,
            number: false,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: true,
            object: true,
            function: false
        },
        object_schema: {
            so_let_me_use_default_values_in_config: {
                array: false,
                optional: true,
                type: {
                    string: false,
                    number: false,
                    bigint: false,
                    boolean: true,
                    symbol: false,
                    undefined: true,
                    object: false,
                    function: false
                },
                object_schema: null
            }
        }
    }
}