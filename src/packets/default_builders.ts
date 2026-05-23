import { config } from "../config/config.js";
import { stringUidToNumber } from "../utils.js";
import { MeshPacketBuilder, ServiceEnvelopeBuilder } from "../meshtastic/builders.js";

export class ServiceEnvelopeBuilderWithDefaults extends ServiceEnvelopeBuilder {
    public defaults() {
        this.setGatewayId(config.meshtastic.node.id);
    
        const defaultChannel = config.channels.find(c => c.primary);
        if (defaultChannel) {
            this.setChannelId(defaultChannel.name);
        }
        return this;
    }

    public override packetPayload(callback: (b: MeshPacketBuilderWithDefaults) => MeshPacketBuilderWithDefaults) {
        this.setPayload(callback(new MeshPacketBuilderWithDefaults()).build());
        return this;
    }
}

export class MeshPacketBuilderWithDefaults extends MeshPacketBuilder {
    public defaults() {
        this.setId(Math.floor(Math.random() * 0xffffffff));
        this.setFrom(stringUidToNumber(config.meshtastic.node.id));
        this.setHopLimit(config.meshtastic.mesh.hop_limits.all);
        this.setHopStart(config.meshtastic.mesh.hop_limits.all);
        return this;
    }
}
