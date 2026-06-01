import { create, toBinary, type Message } from "@bufbuild/protobuf";
import * as meshtastic from '@sophisticated/meshtastic-proto';

type BuilderSettersFrom<T, R = T> = {
    [K in keyof T as `set${Capitalize<K & string>}`]: (v: NonNullable<T[K]>) => R;
}

type ServiceEnvelopeType = Required<Omit<meshtastic.Mqtt.ServiceEnvelope, keyof Message>>;

export class ServiceEnvelopeBuilder implements BuilderSettersFrom<Omit<ServiceEnvelopeType, "packet">, ServiceEnvelopeBuilder> {
    private data: Partial<ServiceEnvelopeType> = {};

    public setChannelId(v: string) {
        this.data.channelId = v;
        return this;
    }

    public setGatewayId(v: string) {
        this.data.gatewayId = v;
        return this;
    }

    public setPayload(v: meshtastic.Mesh.MeshPacket) {
        this.data.packet = v;
        return this;
    }

    public packetPayload(callback: (b: MeshPacketBuilder) => MeshPacketBuilder) {
        this.setPayload(callback(new MeshPacketBuilder()).build());
        return this;
    }

    public build() {
        if (this.data.packet === undefined) throw new Error("ServiceEnvelopeBuilder: payload is not defined");
        return create(meshtastic.Mqtt.ServiceEnvelopeSchema, this.data);
    }

    public buildBinary() {
        return toBinary(meshtastic.Mqtt.ServiceEnvelopeSchema, this.build());
    }
}

type MeshPacketType = Required<Omit<meshtastic.Mesh.MeshPacket, keyof Message>>;

export class MeshPacketBuilder implements BuilderSettersFrom<Omit<MeshPacketType, "payloadVariant" | "to">, MeshPacketBuilder> {
    private data: Partial<MeshPacketType> = {};

    public setFrom(v: number) {
        this.data.from = v;
        return this;
    }

    public setDestination(v: number) {
        this.data.to = v;
        return this;
    }

    public setChannel(v: number) {
        this.data.channel = v;
        return this;
    }

    public setId(v: number) {
        this.data.id = v;
        return this;
    }

    public setRxTime(v: number) {
        this.data.rxTime = v;
        return this;
    }

    public setRxSnr(v: number) {
        this.data.rxSnr = v;
        return this;
    }

    public setRxRssi(v: number) {
        this.data.rxRssi = v;
        return this;
    }

    public setWantAck(v: boolean) {
        this.data.wantAck = v;
        return this;
    }

    /**
     * @deprecated
     */
    public setDelayed(v: meshtastic.Mesh.MeshPacket_Delayed) {
        this.data.delayed = v;
        return this;
    }

    public setViaMqtt(v: boolean) {
        this.data.viaMqtt = v;
        return this;
    }

    public setHopLimit(v: number) {
        this.data.hopLimit = v;
        return this;
    }

    public setHopStart(v: number) {
        this.data.hopStart = v;
        return this;
    }

    public setNextHop(v: number) {
        this.data.nextHop = v;
        return this;
    }

    public setRelayNode(v: number) {
        this.data.relayNode = v;
        return this;
    }

    public setPublicKey(v: Uint8Array<ArrayBufferLike>) {
        this.data.publicKey = v;
        return this;
    }

    public setPkiEncrypted(v: boolean) {
        this.data.pkiEncrypted = v;
        return this;
    }
    
    public setTxAfter(v: number) {
        this.data.txAfter = v;
        return this;
    }

    public setTransportMechanism(v: meshtastic.Mesh.MeshPacket_TransportMechanism) {
        this.data.transportMechanism = v;
        return this;
    }

    public setPriority(v: meshtastic.Mesh.MeshPacket_Priority) {
        this.data.priority = v;
        return this;
    }

    public setPayload(v: meshtastic.Mesh.Data) {
        this.data.payloadVariant = {
            case: "decoded",
            value: v,
        }
        return this;
    }

    public dataPayload(callback: (b: MeshDataBuilder) => MeshDataBuilder) {
        this.setPayload(callback(new MeshDataBuilder()).build());
        return this;
    }

    public setEncryptedPayload(v: Uint8Array) {
        this.data.payloadVariant = {
            case: "encrypted",
            value: v,
        }
        return this;
    }

    public build() {
        if (this.data.from === undefined) throw new Error("MeshPacketBuilder: from is not defined");
        if (this.data.to === undefined) throw new Error("MeshPacketBuilder: destination is not defined");
        if (this.data.payloadVariant === undefined) throw new Error("MeshPacketBuilder: payload is not defined");

        return create(meshtastic.Mesh.MeshPacketSchema, this.data);
    }

    public buildBinary() {
        return toBinary(meshtastic.Mesh.MeshPacketSchema, this.build());
    }
}

type MeshDataType = Required<Omit<meshtastic.Mesh.Data, keyof Message>>;

export class MeshDataBuilder implements BuilderSettersFrom<MeshDataType, MeshDataBuilder> {
    private data: Partial<MeshDataType> = {};

    public setPayload(v: Uint8Array<ArrayBufferLike>): MeshDataBuilder {
        this.data.payload = v;
        return this;
    }

    public setPortnum(v: meshtastic.Portnums.PortNum) {
        this.data.portnum = v;
        return this;
    }

    public setWantResponse(v: boolean) {
        this.data.wantResponse = v;
        return this;
    }

    public setDest(v: number) {
        this.data.dest = v;
        return this;
    }

    public setSource(v: number) {
        this.data.source = v;
        return this;
    }

    public setRequestId(v: number) {
        this.data.requestId = v;
        return this;
    }

    public setReplyId(v: number) {
        this.data.replyId = v;
        return this;
    }

    public setEmoji(v: number) {
        this.data.emoji = v;
        return this;
    }

    public setBitfield(v: number) {
        this.data.bitfield = v;
        return this;
    }

    public build() {
        if (this.data.payload === undefined) throw new Error("MeshDataBuilder: payload is not defined");
        if (this.data.portnum === undefined) throw new Error("MeshDataBuilder: portnum is not defined");

        return create(meshtastic.Mesh.DataSchema, this.data);
    }

    public buildBinary() {
        return toBinary(meshtastic.Mesh.DataSchema, this.build());
    }
}


type TelemetryType = Required<Omit<meshtastic.Telemetry.Telemetry, keyof Message>>;

export class TelemetryBuilder implements BuilderSettersFrom<Omit<TelemetryType, "variant">, TelemetryBuilder> {
    private data: Partial<TelemetryType> = {};

    public setTime(v: number) {
        this.data.time = v;
        return this;
    }

    public setDeviceMetrics(v: meshtastic.Telemetry.DeviceMetrics) {
        this.data.variant = {
            case: "deviceMetrics",
            value: v
        }
        return this;
    }

    public deviceMetrics(callback: (b: TelemetryDeviceMetricsBuilder) => TelemetryDeviceMetricsBuilder) {
        this.setDeviceMetrics(callback(new TelemetryDeviceMetricsBuilder()).build());
        return this;
    }

    public setEnvironmentMetrics(v: meshtastic.Telemetry.EnvironmentMetrics) {
        this.data.variant = {
            case: "environmentMetrics",
            value: v
        }
        return this;
    }

    public environmentMetrics(callback: (b: TelemetryEnvironmentMetricsBuilder) => TelemetryEnvironmentMetricsBuilder) {
        this.setEnvironmentMetrics(callback(new TelemetryEnvironmentMetricsBuilder()).build());
        return this;
    }

    public setAirQualityMetrics(v: meshtastic.Telemetry.AirQualityMetrics) {
        this.data.variant = {
            case: "airQualityMetrics",
            value: v
        }
        return this;
    }

    public setPowerMetrics(v: meshtastic.Telemetry.PowerMetrics) {
        this.data.variant = {
            case: "powerMetrics",
            value: v
        }
        return this;
    }

    public setLocalStats(v: meshtastic.Telemetry.LocalStats) {
        this.data.variant = {
            case: "localStats",
            value: v
        }
        return this;
    }

    public setHealthMetrics(v: meshtastic.Telemetry.HealthMetrics) {
        this.data.variant = {
            case: "healthMetrics",
            value: v
        }
        return this;
    }

    public setHostMetrics(v: meshtastic.Telemetry.HostMetrics) {
        this.data.variant = {
            case: "hostMetrics",
            value: v
        }
        return this;
    }

    public build() {
        return create(meshtastic.Telemetry.TelemetrySchema, this.data);
    }

    public buildBinary() {
        return toBinary(meshtastic.Telemetry.TelemetrySchema, this.build());
    }
}

type TelemetryDeviceMetricsType = Required<Omit<meshtastic.Telemetry.DeviceMetrics, keyof Message>>;
export class TelemetryDeviceMetricsBuilder implements BuilderSettersFrom<TelemetryDeviceMetricsType, TelemetryDeviceMetricsBuilder> {
    private data: Partial<TelemetryDeviceMetricsType> = {};

    public setBatteryLevel(v: number) {
        this.data.batteryLevel = v;
        return this;
    }

    public setVoltage(v: number) {
        this.data.batteryLevel = v;
        return this;
    }

    public setChannelUtilization(v: number) {
        this.data.batteryLevel = v;
        return this;
    }

    public setAirUtilTx(v: number) {
        this.data.batteryLevel = v;
        return this;
    }

    public setUptimeSeconds(v: number) {
        this.data.batteryLevel = v;
        return this;
    }

    public build() {
        return create(meshtastic.Telemetry.DeviceMetricsSchema, this.data);
    }

    public buildBinary() {
        return toBinary(meshtastic.Telemetry.DeviceMetricsSchema, this.build());
    }
}

type TelemetryEnvironmentMetricsType = Required<Omit<meshtastic.Telemetry.EnvironmentMetrics, keyof Message>>;
export class TelemetryEnvironmentMetricsBuilder implements BuilderSettersFrom<TelemetryEnvironmentMetricsType, TelemetryEnvironmentMetricsBuilder> {
    private data: Partial<TelemetryEnvironmentMetricsType> = {};

    public setVoltage(v: number) {
        this.data.voltage = v;
        return this;
    }

    public setTemperature(v: number) {
        this.data.temperature = v;
        return this;
    }

    public setRelativeHumidity(v: number) {
        this.data.relativeHumidity = v;
        return this;
    }

    public setBarometricPressure(v: number) {
        this.data.barometricPressure = v;
        return this;
    }

    public setGasResistance(v: number) {
        this.data.gasResistance = v;
        return this;
    }

    public setCurrent(v: number) {
        this.data.current = v;
        return this;
    }

    public setIaq(v: number) {
        this.data.iaq = v;
        return this;
    }

    public setDistance(v: number) {
        this.data.distance = v;
        return this;
    }

    public setLux(v: number) {
        this.data.lux = v;
        return this;
    }

    public setWhiteLux(v: number) {
        this.data.whiteLux = v;
        return this;
    }

    public setIrLux(v: number) {
        this.data.irLux = v;
        return this;
    }

    public setUvLux(v: number) {
        this.data.uvLux = v;
        return this;
    }

    public setWindDirection(v: number) {
        this.data.windDirection = v;
        return this;
    }

    public setWindSpeed(v: number) {
        this.data.windSpeed = v;
        return this;
    }

    public setWeight(v: number) {
        this.data.weight = v;
        return this;
    }

    public setWindGust(v: number) {
        this.data.windGust = v;
        return this;
    }

    public setWindLull(v: number) {
        this.data.windLull = v;
        return this;
    }

    public setRadiation(v: number) {
        this.data.radiation = v;
        return this;
    }

    public setRainfall1h(v: number) {
        this.data.rainfall1h = v;
        return this;
    }

    public setRainfall24h(v: number) {
        this.data.rainfall24h = v;
        return this;
    }

    public setSoilMoisture(v: number) {
        this.data.soilMoisture = v;
        return this;
    }

    public setSoilTemperature(v: number) {
        this.data.soilTemperature = v;
        return this;
    }

    public build() {
        return create(meshtastic.Telemetry.EnvironmentMetricsSchema, this.data);
    }

    public buildBinary() {
        return toBinary(meshtastic.Telemetry.EnvironmentMetricsSchema, this.build());
    }
}


// type TelemetryAirQualityMetrics = Required<Omit<meshtastic.Telemetry.AirQualityMetrics, keyof Message>>;
// type TelemetryPowerMetrics = Required<Omit<meshtastic.Telemetry.PowerMetrics, keyof Message>>;
// type TelemetryLocalStats = Required<Omit<meshtastic.Telemetry.LocalStats, keyof Message>>;
// type TelemetryHealthMetrics = Required<Omit<meshtastic.Telemetry.HealthMetrics, keyof Message>>;
// type TelemetryHostMetrics = Required<Omit<meshtastic.Telemetry.HostMetrics, keyof Message>>;