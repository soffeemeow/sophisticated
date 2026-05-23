import { collectDefaultMetrics, Counter, Histogram, linearBuckets, Registry } from "prom-client";
import { MetricsServer } from "./server.js";
import * as meshtastic from '../meshtastic/meshtastic.js';
import { toStringUserId } from "../utils.js";
import { toBinary } from "@bufbuild/protobuf";

export class MetricsExporter {
    private server: MetricsServer | undefined;
    public readonly registry = new Registry();

    public readonly mesh_packets_received_counter = new Counter({
        name: "meshtastic_mesh_packets_received_count",
        help: "Total count of received packets since startup",
        labelNames: ["gateway", "channel", "from", "to", "relayNode", "port"],
    });

    public readonly mesh_packets_received_rssi_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_rssi",
        help: "Observed RSSI values on received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: [-200,-180,-160,-140,-130,-120,-115,-110,-105,-100,-98,-96,-94,-92,-90,-88,-86,-84,-82,-80,-78,-76,-74,-72,-70,-68,-66,-64,-62,-60,-55,-50,-40,-20,0],
        // buckets: [-200,-180,-160,-140,-130,-120,-115,-110,-105,-100,-95,-90,-85,-80,-75,-70,-65,-60,-55,-50,-40,-20,0],
    });

    public readonly mesh_packets_received_snr_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_snr",
        help: "Observed SNR values on received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: [-30,-25,-20,-18,-16,-14,-12,-10,-8,-6,-4,-2,0,2,3,4,5,6,8,10],
    });

    public readonly mesh_packets_received_hops_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_hops",
        help: "Observed hop count values on received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: [0, 1, 2, 3, 4, 5, 6, 7],
    });

    public readonly mesh_packets_received_size_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_size",
        help: "Observed size of received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: linearBuckets(0, 16, 17),
    });

    public readonly mesh_packets_received_payload_size_histogram = new Histogram({
        name: "meshtastic_mesh_packets_received_payload_size",
        help: "Observed payload size of received packets",
        labelNames: ["gateway", "from", "relayNode"],
        buckets: linearBuckets(0, 16, 17),
    });

    public constructor (collectNodeJsMetrics: boolean = true) {
        if (collectNodeJsMetrics) {
            collectDefaultMetrics({ register: this.registry });
        }

        this.mesh_packets_received_counter 
        this.registry.registerMetric(this.mesh_packets_received_counter);
        this.registry.registerMetric(this.mesh_packets_received_rssi_histogram);
        this.registry.registerMetric(this.mesh_packets_received_snr_histogram);
        this.registry.registerMetric(this.mesh_packets_received_hops_histogram);
        this.registry.registerMetric(this.mesh_packets_received_size_histogram);
        this.registry.registerMetric(this.mesh_packets_received_payload_size_histogram);
    }

    public serve(address: string,  port: number) {
        if (this.server !== undefined) {
            throw new Error("Server is already started.");
        }
        this.server = new MetricsServer(this.registry);
        this.server.listen(address, port);
    }

    public collectIncomingPacketMetrics(envelope: meshtastic.Mqtt.ServiceEnvelope) {
        if (!envelope.packet) return;
        
        const labels = {
            gateway: envelope.gatewayId,
            channel: envelope.channelId,
            from: toStringUserId(envelope.packet.from),
            to: toStringUserId(envelope.packet.to),
            relayNode: envelope.packet.relayNode.toString(16).padStart(2, "0"),
            port: envelope.packet.payloadVariant.case === "decoded" ? envelope.packet.payloadVariant.value.portnum : 0,
        };
        
        const histogramLabels = {
            gateway: labels.gateway,
            from: labels.from,
            relayNode: labels.relayNode,
        }

        this.mesh_packets_received_counter.inc(labels);

        this.mesh_packets_received_hops_histogram.observe(histogramLabels, envelope.packet.hopStart - envelope.packet.hopLimit);
        this.mesh_packets_received_rssi_histogram.observe(histogramLabels, envelope.packet.rxRssi);
        this.mesh_packets_received_snr_histogram.observe(histogramLabels, envelope.packet.rxSnr);

        this.mesh_packets_received_size_histogram.observe(histogramLabels, toBinary(meshtastic.Mesh.MeshPacketSchema, envelope.packet).length);

        let payloadSize = 0;
        if (envelope.packet.payloadVariant.case === "decoded") {
            payloadSize = toBinary(meshtastic.Mesh.DataSchema, envelope.packet.payloadVariant.value).length;
        } else if (envelope.packet.payloadVariant.case === "encrypted") {
            payloadSize = envelope.packet.payloadVariant.value.length;
        }

        this.mesh_packets_received_payload_size_histogram.observe(histogramLabels, payloadSize);
    }
}
