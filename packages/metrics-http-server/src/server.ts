import http from "node:http";

export interface MetricsRegistry {
    metrics(): Promise<string>;
    contentType: string;
}

type MetricsServerLoggerFn = (message: string, ...extra: any[]) => void;
type MetricsServerLoggerLevels = "debug" | "info" | "warn" | "error";
export type MetricsServerLogger = Record<MetricsServerLoggerLevels, MetricsServerLoggerFn>;

export function voidLogger(): MetricsServerLogger {
    const voidLoggerFn = (..._: any[]) => {};

    return {
        debug: voidLoggerFn,
        info: voidLoggerFn,
        warn: voidLoggerFn,
        error: voidLoggerFn,
    }
}

export function consoleLogger(): MetricsServerLogger {
    return {
        debug: console.debug,
        info: console.info,
        warn: console.warn,
        error: console.error,
    }
}

export class MetricsServer<T extends MetricsRegistry> {
    private _registry: T;
    private _httpServer?: http.Server;
    private logger: MetricsServerLogger = voidLogger();

    public constructor(registry: T) {
        this._registry = registry;
    }

    public attachLogger(logger: MetricsServerLogger) {
        this.logger = logger;
    }

    public get registry() {
        return this._registry;
    }

    public listen(address: string, port: number) {
        if (this._httpServer) {
            throw new Error("This server is already listening");
        }
        this._httpServer = http.createServer(this._requestHandler.bind(this));
        this._httpServer.listen(port, address);
        this.logger.info(`HTTP Metrics Server is listening on ${address}:${port}`);
    }

    private async _requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL(`http://${req.headers.host ?? "localhost"}${req.url}`);
        this.logger.info(`[HTTP] ${req.method} - ${req.socket.localAddress}:${req.socket.localPort} (${url.href}) from ${req.socket.remoteAddress}:${req.socket.remotePort}`);

        if (req.method === "GET" && url.pathname === "/metrics") {
            try {
                const metrics = await this._registry.metrics();
                res.statusCode = 200;
                res.setHeader("Content-Type", this._registry.contentType);
                res.write(metrics);
            } catch (e) {
                this.logger.error("Metrics collection failed:", e);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json; charset=utf-8;");
                res.write("{ \"error\":{\"message\":\"failed to collect metrics.\"}}");
            }
            return res.end();
        }

        if (!res.writableEnded) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8;");
            res.write("{\"error\":{\"message\":\"not found.\"}}");
            return res.end();
        }
    }
}