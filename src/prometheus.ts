export enum PrometheusResponseStatus {
    SUCCESS = "success",
    ERROR = "error",
}

export enum PrometheusResultType {
    MATRIX = "matrix",
    VECTOR = "vector",
    SCALAR = "scalar",
    STRING = "string",
}

export enum PrometheusHistogramBucketBoundaryRule {
    OPEN_LEFT = 0,
    OPEN_RIGHT = 1,
    OPEN_BOTH = 2,
    CLOSED_BOTH = 3,
}

function parsePrometheusFloat(str: string): number {
    if (str === "Inf" || str === "+Inf") return Infinity;
    if (str === "-Inf") return -Infinity;
    if (str === "NaN") return NaN;
    return parseFloat(str);
}

export type PrometheusScalar<T> = [number, T];

export interface PrometheusHistogram {
    count: string,
    sum: string,
    buckets: [number, string, string, string][],
}

export interface PrometheusInstantVector {
    metric: Record<string, string>;
    value?: PrometheusScalar<string>;
    histogram?: PrometheusScalar<PrometheusHistogram>;
}

export interface PrometheusRangeVector {
    metric: Record<string, string>;
    value?: PrometheusScalar<string>[];
    histogram?: PrometheusScalar<PrometheusHistogram>[];
}

function isPrometheusRangeVector(v: PrometheusInstantVector | PrometheusRangeVector): v is PrometheusRangeVector {
    return Array.isArray((v.histogram ?? v.value)?.[1]);
}

type PrometheusResultFromType<T extends PrometheusResultType> = 
    T extends PrometheusResultType.SCALAR ? PrometheusScalar<string> : 
    T extends PrometheusResultType.STRING ? PrometheusScalar<string> : 
    T extends PrometheusResultType.VECTOR ? PrometheusInstantVector[] : 
    T extends PrometheusResultType.MATRIX ? PrometheusRangeVector[] : never;

export interface PrometheusDataResponse<T extends PrometheusResultType> {
    resultType: T;
    result: PrometheusResultFromType<T>;
}

export class PrometheusResponseEnvelope<T extends PrometheusResultType = PrometheusResultType> {
    constructor (
        public status: PrometheusResponseStatus,
        public data: PrometheusDataResponse<T>,
        public warnings?: string[],
        public infos?: string[],
    ) {}

    public hasError(): this is PrometheusErrorResponseEnvelope<T> {
        return this.status === PrometheusResponseStatus.ERROR;
    }

    public resultIsScalar(): this is PrometheusResponseEnvelope<PrometheusResultType.SCALAR> {
        return this.data.resultType === PrometheusResultType.SCALAR;
    }

    public resultIsString(): this is PrometheusResponseEnvelope<PrometheusResultType.STRING> {
        return this.data.resultType === PrometheusResultType.STRING;
    }

    public resultIsInstantVector(): this is PrometheusResponseEnvelope<PrometheusResultType.VECTOR> {
        return this.data.resultType === PrometheusResultType.VECTOR;
    }

    public resultIsRangeVector(): this is PrometheusResponseEnvelope<PrometheusResultType.MATRIX> {
        return this.data.resultType === PrometheusResultType.MATRIX;
    }

    public static from(data: any): PrometheusResponseEnvelope {
        if (typeof data !== "object") {
            throw new Error("data must be an object.");
        }

        if (!("status" in data && typeof data["status"] === "string")) {
            throw new Error("data must have 'status' property of type string");
        }

        const statuses = [PrometheusResponseStatus.SUCCESS, PrometheusResponseStatus.ERROR];

        if (!statuses.includes(data.status)) {
            throw new Error(`data.status must be one of [${statuses.map(s => `'${s}'`).join(", ")}]`);
        }

        if (!("data" in data && typeof data["data"] === "object")) {
            throw new Error("data must have 'data' property of type object");
        }

        if (data.status === PrometheusResponseStatus.ERROR) {
            if (!("error" in data && typeof data["error"] === "string")) {
                throw new Error("data must have 'error' property of type string");
            }
            if (!("errorType" in data && typeof data["errorType"] === "string")) {
                throw new Error("data must have 'errorType' property of type string");
            }

            return new PrometheusErrorResponseEnvelope(
                data.errorType,
                data.error,
                data.data,
                data.warnings,
                data.infos,
            )
        }

        return new PrometheusResponseEnvelope(
            data.status,
            data.data,
            data.warnings,
            data.infos,
        );
    }
}

export class PrometheusErrorResponseEnvelope<T extends PrometheusResultType = PrometheusResultType> extends PrometheusResponseEnvelope<T> {
    constructor (
        public errorType: string,
        public error: string,
        data: PrometheusDataResponse<T>,
        warnings?: string[],
        infos?: string[],
    ) {
        super(PrometheusResponseStatus.ERROR, data, warnings, infos);
    }

    public override hasError(): this is PrometheusErrorResponseEnvelope<T> {
        return true;
    }
}

interface Scalar<T> {
    time: Date;
    value: T;
}

interface HistogramBucket {
    count: number;
    boundary: {
        rule: PrometheusHistogramBucketBoundaryRule;
        left: number;
        right: number;
    };
}

interface Histogram {
    count: number,
    sum: number,
    buckets: HistogramBucket[],
}

enum VectorType {
    INSTANT = "instant",
    RANGE = "range",
}

type VectorTypeMapping<T extends VectorType, V> = T extends VectorType.INSTANT ? Scalar<V> : Scalar<V>[];
type HistogramVector<T extends VectorType> = { histogram: VectorTypeMapping<T, Histogram>};
type ScalarValueVector<T extends VectorType> = { value: VectorTypeMapping<T, number>};

abstract class Vector<T extends VectorType> {
    public abstract readonly type: T;
    protected constructor (
        public metric: Record<string, string>,
    ) {}

    public isInstantVector(): this is InstantVector {
        return this.type === VectorType.INSTANT;
    }

    public isRangeVector(): this is RangeVector {
        return this.type === VectorType.RANGE;
    }

    public hasHistogram(): this is HistogramVector<T> {
        return "histogram" in this;
    }

    public hasScalarValue(): this is ScalarValueVector<T> {
        return "value" in this;
    }

    public static fromApiVector(raw: PrometheusInstantVector): InstantVector;
    public static fromApiVector(raw: PrometheusRangeVector): RangeVector;
    public static fromApiVector(raw: PrometheusInstantVector | PrometheusRangeVector): Vector<VectorType> {
        if ("histogram" in raw) {
            if (isPrometheusRangeVector(raw)) {
                const rv = new RangeVector(raw.metric) as RangeVector & HistogramVector<VectorType.RANGE>;
                rv.histogram = raw.histogram.map(h => convertHistogramScalar(h));
                return rv;
            } else {
                const iv = new InstantVector(raw.metric) as InstantVector & HistogramVector<VectorType.INSTANT>;
                iv.histogram = convertHistogramScalar(raw.histogram);
                return iv;
            }
        }

        if ("value" in raw) {
            if (isPrometheusRangeVector(raw)) {
                const rv = new RangeVector(raw.metric) as RangeVector & ScalarValueVector<VectorType.RANGE>;
                rv.value = raw.value.map(v => convertNumberScalar(v));
                return rv;
            } else {
                const iv = new InstantVector(raw.metric) as InstantVector & ScalarValueVector<VectorType.INSTANT>;
                iv.value = convertNumberScalar(raw.value);
                return iv;
            }
        }

        throw new Error("source object must contain 'histogram' or 'value' field.");
    }
}

export class InstantVector extends Vector<VectorType.INSTANT> {
    public type: VectorType.INSTANT = VectorType.INSTANT;
}

export class RangeVector extends Vector<VectorType.RANGE> {
    public type: VectorType.RANGE = VectorType.RANGE;
}

function convertHistogram(raw: PrometheusHistogram): Histogram {
    return {
        count: parsePrometheusFloat(raw.count),
        sum: parsePrometheusFloat(raw.sum),
        buckets: raw.buckets.map(b => ({
            count: parsePrometheusFloat(b[3]),
            boundary: {
                rule: b[0] as PrometheusHistogramBucketBoundaryRule,
                left: parsePrometheusFloat(b[1]),
                right: parsePrometheusFloat(b[2]),
            }
        })),
    }
}

function convertStringScalar(raw: PrometheusScalar<string>): Scalar<string> {
    return {
        time: new Date(raw[0] * 1000),
        value: raw[1],
    }
}

function convertNumberScalar(raw: PrometheusScalar<string>): Scalar<number> {
    return {
        time: new Date(raw[0] * 1000),
        value: parsePrometheusFloat(raw[1]),
    }
}

function convertHistogramScalar(raw: PrometheusScalar<PrometheusHistogram>): Scalar<Histogram> {
    return {
        time: new Date(raw[0] * 1000),
        value: convertHistogram(raw[1]),
    }
}

export class PrometheusAPI {
    public constructor(public readonly apiURL: string) {}

    private async apiRequest(endpoint: string, method: string, data?: Record<string, string>) {
        const params: RequestInit = {
            method,
        };
        const headers: HeadersInit = {
            "Accept": "application/json",
        };

        if (data !== undefined) {
            params.body = new URLSearchParams(data);
            headers["Content-Type"] = "application/x-www-form-urlencoded";
        }

        let httpResponse: Awaited<ReturnType<typeof fetch>>;
        try {
            httpResponse = await fetch(this.apiURL + endpoint, params); 
        } catch (e) {
            throw new Error(`prometheus request failed: ${e}`);
        }

        let body: any;
        try {
            body = await httpResponse.json();
        } catch (e) {
            throw new Error(`prometheus request failed: invalid response encoding: ${e}`);
        }

        let response: PrometheusResponseEnvelope;
        try {
            response = PrometheusResponseEnvelope.from(body);            
        } catch (e) {
            throw new Error(`prometheus request failed: invalid response body: ${e}`);
        }        

        if (response.hasError()) {
            throw new Error(`prometheus request failed: prometheus error ${response.errorType}: ${response.error}`);
        }

        return response;
    }

    public async instantQuery(query: string, at: Date = new Date()) {
        const response = await this.apiRequest("/api/v1/query", "POST", {
            query,
            time: `${at.getTime() / 1000}`,
        });

        if (!response.resultIsInstantVector()) {
            throw new Error("prometheus instant query failed: expected vector, found " + response.data.resultType);
        }
        return response.data.result.map(v => Vector.fromApiVector(v));
    }

    public async rangeQuery(query: string, step: number, start: Date, end: Date = new Date()) {
        const response = await this.apiRequest("/api/v1/query_range", "POST", {
            query,
            start: `${start.getTime() / 1000}`,
            end: `${end.getTime() / 1000}`,
            step: step.toString(),
        });

        if (!response.resultIsRangeVector()) {
            throw new Error("prometheus range query failed: expected matrix, found " + response.data.resultType);
        }

        return response.data.result.map(v => Vector.fromApiVector(v));
    }
}

let prometheus: PrometheusAPI;

export async function initPrometheusAPI(url: string) {
    if (prometheus) {
        throw new Error("Prometheus API is already initialized.");
    }

    prometheus = new PrometheusAPI(url);
}

export {
    prometheus,
}