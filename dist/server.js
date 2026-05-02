import express from "express";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
const APP_PORT = Number(process.env.APP_PORT ?? 3100);
const APP_USER = process.env.APP_USER ?? "demo";
const APP_PASS = process.env.APP_PASS ?? "demo123";
const APP_VIEWER_USER = process.env.APP_VIEWER_USER ?? "viewer";
const APP_VIEWER_PASS = process.env.APP_VIEWER_PASS ?? "viewer123";
const ADMIN_TOKEN = "analytics-lab-token-admin";
const VIEWER_TOKEN = "analytics-lab-token-viewer";
const SOURCE_MAX_LENGTH = 64;
/** Default dashboard trend matches original lab shape when `days=7` and `granularity=day`. */
const DEFAULT_TREND = Object.freeze([35, 52, 41, 63, 58, 72, 69]);
function parseDays(raw) {
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n))
        return 7;
    return Math.min(90, Math.max(1, n));
}
function parseGranularity(raw) {
    return raw === "week" ? "week" : "day";
}
function bucketCountFor(days, granularity) {
    if (granularity === "week")
        return Math.max(1, Math.ceil(days / 7));
    return days;
}
function bucketLabels(bucketCount, granularity) {
    const out = [];
    for (let i = 0; i < bucketCount; i += 1) {
        out.push(granularity === "week" ? `Week ${i + 1}` : `Day ${i + 1}`);
    }
    return out;
}
function extendedTrend(bucketCount, activeFeeds) {
    return Array.from({ length: bucketCount }, (_, i) => {
        const seed = DEFAULT_TREND[i % DEFAULT_TREND.length];
        return ((seed + i * 7 + activeFeeds * 5) % 55) + 25;
    });
}
function mapSqlColumn(c) {
    const x = c.trim().toLowerCase().replace(/"/g, "");
    if (x === "updated_at" || x === "updatedat")
        return "updatedAt";
    if (x === "id" || x === "source" || x === "enabled")
        return x;
    return null;
}
function rowProjection(item, keys) {
    const row = {};
    for (const k of keys)
        row[k] = item[k];
    return row;
}
function normalizeSqlQuery(raw) {
    if (typeof raw !== "string")
        return "";
    const s = raw.trim().replace(/;+\s*$/, "");
    if (s.includes(";"))
        return "";
    return s.replace(/\s+/g, " ").toUpperCase();
}
function runFeedsSelect(sqlNorm) {
    const countRe = /^SELECT\s+COUNT\s*\(\s*\*\s*\)\s*(?:AS\s+[A-Z0-9_]+)?\s+FROM\s+FEEDS$/;
    if (countRe.test(sqlNorm)) {
        return {
            columns: [{ name: "count", type: "integer" }],
            rows: [{ count: feeds.length }],
        };
    }
    const starRe = /^SELECT\s+\*\s+FROM\s+FEEDS$/;
    if (starRe.test(sqlNorm)) {
        const keys = ["id", "source", "enabled", "updatedAt"];
        return {
            columns: keys.map((name) => ({
                name,
                type: name === "enabled" ? "boolean" : name === "updatedAt" ? "string" : "string",
            })),
            rows: feeds.map((item) => rowProjection(item, keys)),
        };
    }
    const listRe = /^SELECT\s+(.+?)\s+FROM\s+FEEDS$/;
    const m = sqlNorm.match(listRe);
    if (!m?.[1])
        return { error: "Only SELECT from feeds is supported in this lab" };
    const part = m[1].trim();
    if (part === "*")
        return { error: "Invalid SELECT" };
    const rawCols = part.split(",").map((s) => s.trim());
    const keys = [];
    for (const raw of rawCols) {
        const mapped = mapSqlColumn(raw);
        if (!mapped)
            return { error: `Unknown column: ${raw}` };
        if (!keys.includes(mapped))
            keys.push(mapped);
    }
    return {
        columns: keys.map((name) => ({
            name,
            type: name === "enabled" ? "boolean" : "string",
        })),
        rows: feeds.map((item) => rowProjection(item, keys)),
    };
}
const accounts = [
    { username: APP_USER, password: APP_PASS, role: "admin", token: ADMIN_TOKEN },
    { username: APP_VIEWER_USER, password: APP_VIEWER_PASS, role: "viewer", token: VIEWER_TOKEN },
];
const defaultFeed = [
    { id: "feed-1", source: "orders", enabled: true, updatedAt: new Date().toISOString() },
    { id: "feed-2", source: "payments", enabled: false, updatedAt: new Date().toISOString() },
];
let feeds = structuredClone(defaultFeed);
/** Next numeric suffix for synthetic ids `feed-{n}` */
let feedIdSeq = 2;
function resetState() {
    feeds = structuredClone(defaultFeed);
    feedIdSeq = 2;
}
function nextFeedId() {
    feedIdSeq += 1;
    return `feed-${feedIdSeq}`;
}
function normalizeSource(raw) {
    return typeof raw === "string" ? raw.trim() : "";
}
function sourceValidationError(source) {
    if (!source.length)
        return "Source is required";
    if (source.length > SOURCE_MAX_LENGTH)
        return `Source must be at most ${SOURCE_MAX_LENGTH} characters`;
    return undefined;
}
function tokenRole(token) {
    const a = accounts.find((x) => x.token === token);
    return a?.role;
}
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
        res.status(401).json({ error: "unauthorized", message: "Bearer token required" });
        return;
    }
    const token = auth.slice(7);
    const role = tokenRole(token);
    if (!role) {
        res.status(403).json({ error: "forbidden", message: "Invalid token" });
        return;
    }
    req.labRole = role;
    next();
}
function requireRole(...allowed) {
    return (req, res, next) => {
        const role = req.labRole;
        if (!role || !allowed.includes(role)) {
            res.status(403).json({ error: "forbidden", message: "Insufficient role" });
            return;
        }
        next();
    };
}
app.post("/api/auth/login", (req, res) => {
    const body = req.body;
    const hit = accounts.find((a) => a.username === body.username && a.password === body.password);
    if (!hit) {
        res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password" });
        return;
    }
    res.json({ token: hit.token, role: hit.role, expiresIn: 3600 });
});
app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ role: req.labRole });
});
app.get("/api/feed", requireAuth, (_req, res) => {
    res.json({ items: feeds });
});
app.post("/api/feed", requireAuth, requireRole("admin"), (req, res) => {
    const source = normalizeSource(req.body.source);
    const err = sourceValidationError(source);
    if (err) {
        res.status(400).json({ error: "validation_error", message: err });
        return;
    }
    const dup = feeds.some((x) => x.source.toLowerCase() === source.toLowerCase());
    if (dup) {
        res.status(400).json({ error: "validation_error", message: "Duplicate source name" });
        return;
    }
    const row = {
        id: nextFeedId(),
        source,
        enabled: true,
        updatedAt: new Date().toISOString(),
    };
    feeds.push(row);
    res.status(201).json(row);
});
app.patch("/api/feed/:id", requireAuth, requireRole("admin"), (req, res) => {
    const current = feeds.find((x) => x.id === req.params.id);
    if (!current) {
        res.status(404).json({ error: "not_found", message: "Feed not found" });
        return;
    }
    const body = req.body;
    if (body.source !== undefined) {
        const source = normalizeSource(body.source);
        const err = sourceValidationError(source);
        if (err) {
            res.status(400).json({ error: "validation_error", message: err });
            return;
        }
        const dup = feeds.some((x) => x.id !== current.id && x.source.toLowerCase() === source.toLowerCase());
        if (dup) {
            res.status(400).json({ error: "validation_error", message: "Duplicate source name" });
            return;
        }
        current.source = source;
        current.updatedAt = new Date().toISOString();
    }
    if (typeof body.enabled === "boolean") {
        current.enabled = body.enabled;
        current.updatedAt = new Date().toISOString();
    }
    res.json(current);
});
app.get("/api/dashboard/summary", requireAuth, (req, res) => {
    const activeFeeds = feeds.filter((x) => x.enabled).length;
    const totalEvents = activeFeeds * 120 + 80;
    const days = parseDays(req.query.days);
    const granularity = parseGranularity(req.query.granularity);
    const buckets = bucketCountFor(days, granularity);
    const trendLabels = bucketLabels(buckets, granularity);
    const trend = days === 7 && granularity === "day" ? [...DEFAULT_TREND] : extendedTrend(buckets, activeFeeds);
    res.json({
        kpis: { activeFeeds, totalEvents },
        trend,
        timeRange: { days, granularity, labels: trendLabels },
    });
});
app.get("/api/datasets", requireAuth, (_req, res) => {
    const activeFeeds = feeds.filter((x) => x.enabled).length;
    const estEvents = activeFeeds * 120 + 80;
    res.json({
        items: [
            {
                id: "feeds",
                name: "feeds",
                kind: "physical",
                description: "Synthetic ingestion feed definitions (Apache Superset: Dataset / physical table).",
                rowCountEstimate: feeds.length,
                columns: [
                    { name: "id", type: "VARCHAR" },
                    { name: "source", type: "VARCHAR" },
                    { name: "enabled", type: "BOOLEAN" },
                    { name: "updated_at", type: "TIMESTAMP" },
                ],
            },
            {
                id: "events_daily",
                name: "events_daily",
                kind: "virtual",
                description: "Rollup view derived from active feeds (lab substitute for a metrics layer).",
                rowCountEstimate: Math.max(1, activeFeeds),
                columns: [
                    { name: "day", type: "DATE" },
                    { name: "event_count", type: "BIGINT" },
                    { name: "source_mix", type: "VARCHAR" },
                ],
            },
        ],
        hints: estEvents,
    });
});
app.post("/api/sqllab/run", requireAuth, (req, res) => {
    const body = req.body;
    const normalized = normalizeSqlQuery(body.query);
    if (!normalized.length) {
        res.status(400).json({ error: "validation_error", message: "query is required" });
        return;
    }
    if (!/^SELECT\b/.test(normalized)) {
        res.status(400).json({
            error: "validation_error",
            message: "Only read-only SELECT against feeds is enabled in SQL Lab lite",
        });
        return;
    }
    const out = runFeedsSelect(normalized);
    if ("error" in out) {
        res.status(400).json({ error: "sql_error", message: out.error });
        return;
    }
    res.json({ ...out, engine: "lab-sqlite-ish", rowCount: out.rows.length });
});
if (process.env.APP_ENABLE_RESET === "true") {
    app.post("/api/__reset", (_req, res) => {
        resetState();
        res.status(204).send();
    });
}
app.use(express.static(path.join(__dirname, "public")));
export { app };
/** Start HTTP server using `APP_PORT` (default 3100). Idempotent only if called once per process. */
export function startServer() {
    app.listen(APP_PORT, () => {
        console.log(`Analytics demo app listening on http://127.0.0.1:${APP_PORT}`);
    });
}
//# sourceMappingURL=server.js.map