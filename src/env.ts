const MQTT_TOPIC = process.env.MQTT_TOPIC ?? "";
const MSH_GATEWAY = process.env.MSH_GATEWAY!;

const MSH_UID = process.env.MSH_UID!;
const MSH_SHORT_NAME = process.env.MSH_SHORT_NAME!;
const MSH_LONG_NAME = process.env.MSH_LONG_NAME!;

const MSH_POS_LAT = process.env.MSH_POS_LAT;
const MSH_POS_LON = process.env.MSH_POS_LON;
const MSH_POS_ALT = process.env.MSH_POS_ALT;

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

const IS_DEV_ENVIRONMENT = process.env.ENVIRONMENT === "dev";

const METRICS_LISTEN_HOST = process.env.METRICS_LISTEN_HOST;
const METRICS_LISTEN_PORT = process.env.METRICS_LISTEN_PORT;

const JSON_NODEDB = process.env.JSON_NODEDB ?? "./sophisticated-nodedb.json";

export {
    MQTT_TOPIC,
    MSH_GATEWAY,
    MSH_UID,
    MSH_SHORT_NAME,
    MSH_LONG_NAME,
    MSH_POS_LAT,
    MSH_POS_LON,
    MSH_POS_ALT,
    PROMETHEUS_URL,
    IS_DEV_ENVIRONMENT,
    METRICS_LISTEN_HOST,
    METRICS_LISTEN_PORT,
    JSON_NODEDB,
}