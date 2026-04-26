import { collectDefaultMetrics, Counter, Histogram, linearBuckets, Registry } from "prom-client";
import { MetricsServer } from "./server.js";
import { config } from "../config/config.js";

let server: MetricsServer | undefined;

export function initMetrics() {
    if (server !== undefined) {
        throw new Error("Metrics are already initialized.");
    }

    const registry = new Registry();
    collectDefaultMetrics({ register: registry });

    server = new MetricsServer(registry);
    server.listen(config.metrics.listen_address, config.metrics.listen_port);
}

export function getRegistry() {
    if (server === undefined) {
        throw new Error("Metrics are not initialized.");
    }
    return server.registry;
}

export function initMeshtasticRxMetrics(registry: Registry) {
    const mesh_packets_received_counter = new Counter({
        name: "meshtastic_mesh_packets_received_count",
        help: "Total count of received packets since startup",
        labelNames: ["gateway", "channel", "from", "to", "relayNode", "port"],
    });
    registry.registerMetric(mesh_packets_received_counter);

    const mesh_packets_received_rssi_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_rssi",
        help: "Observed RSSI values on received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: [-200,-180,-160,-140,-130,-120,-115,-110,-105,-100,-98,-96,-94,-92,-90,-88,-86,-84,-82,-80,-78,-76,-74,-72,-70,-68,-66,-64,-62,-60,-55,-50,-40,-20,0],
        // buckets: [-200,-180,-160,-140,-130,-120,-115,-110,-105,-100,-95,-90,-85,-80,-75,-70,-65,-60,-55,-50,-40,-20,0],
    });
    registry.registerMetric(mesh_packets_received_rssi_histogram);

    const mesh_packets_received_snr_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_snr",
        help: "Observed SNR values on received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: [-30,-25,-20,-18,-16,-14,-12,-10,-8,-6,-4,-2,0,2,3,4,5,6,8,10],
    });
    registry.registerMetric(mesh_packets_received_snr_histogram);

    const mesh_packets_received_hops_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_hops",
        help: "Observed hop count values on received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: [0, 1, 2, 3, 4, 5, 6, 7],
    });
    registry.registerMetric(mesh_packets_received_hops_histogram);

    return {
        mesh_packets_received_counter,
        mesh_packets_received_rssi_histogram,
        mesh_packets_received_snr_histogram,
        mesh_packets_received_hops_histogram,
    }
}