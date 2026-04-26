import type { ObjectSchema } from "../validator.js"
import type { JDBNode, JDBUser } from "./json_node_db.js"

export const JDBNodeSchema: ObjectSchema<JDBNode> = {
    snr: {
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
    lastHeard: {
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
    channel: {
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
    viaMqtt: {
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
    hopsAway: {
        array: false,
        optional: true,
        type: {
            string: false,
            number: true,
            bigint: false,
            boolean: false,
            symbol: false,
            undefined: true,
            object: false,
            function: false
        },
        object_schema: null
    },
    isFavorite: {
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
    isIgnored: {
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
    isKeyManuallyVerified: {
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
    isMuted: {
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

export const JDBUserSchema: ObjectSchema<JDBUser> = {
    longName: {
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
    shortName: {
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
    isLicensed: {
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
    isUnmessagable: {
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
    },
    role: {
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
    hwModel: {
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
    publicKey: {
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