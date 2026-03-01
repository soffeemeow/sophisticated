const MQTT_TOPIC = process.env.MQTT_TOPIC ?? "";
const MSH_GATEWAY = process.env.MSH_GATEWAY!;

const MSH_UID = process.env.MSH_UID!;
const MSH_SHORT_NAME = process.env.MSH_SHORT_NAME!;
const MSH_LONG_NAME = process.env.MSH_LONG_NAME!;

const MSH_POS_LAT = process.env.MSH_POS_LAT;
const MSH_POS_LON = process.env.MSH_POS_LON;
const MSH_POS_ALT = process.env.MSH_POS_ALT;

const PROMETHEUS_URL = process.env.PROMETHEUS_URL;

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
}