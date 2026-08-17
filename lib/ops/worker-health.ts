import { getDMQueue, getRedisConnection } from "@/lib/queue/client";

const WORKER_HEALTH_KEY = "health:worker:dm";
const WORKER_ACTIVITY_KEY = "health:worker:dm:lastActive";
const WORKER_ALERTS_KEY = "alerts:worker:dm";
const WORKER_HEARTBEAT_TTL_SECONDS = 120;
// How long a queue can sit with jobs waiting and nothing active before we
// call it stalled rather than just "quiet." The BullMQ Worker's heartbeat
// setInterval loop and its job-consumption loop are independent — a Redis
// connection blip can wedge the latter while the former keeps ticking, so
// the heartbeat alone can't detect this; a stuck backlog can.
const STALL_THRESHOLD_MS = 10 * 60 * 1000;

export interface WorkerHeartbeat {
  status: "running";
  worker: "dm";
  pid: number;
  hostname?: string;
  startedAt?: string;
  checkedAt: string;
}

export interface WorkerHealth {
  healthy: boolean;
  heartbeat: WorkerHeartbeat | null;
  ageMs: number | null;
  stalled: boolean;
  queueWaiting: number;
}

export interface WorkerAlert {
  level: "warning" | "error";
  message: string;
  jobId?: string;
  instagramAccountId?: string;
  commentId?: string;
  createdAt: string;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function recordWorkerHeartbeat(
  heartbeat: Omit<WorkerHeartbeat, "checkedAt" | "status" | "worker">
) {
  const payload: WorkerHeartbeat = {
    ...heartbeat,
    status: "running",
    worker: "dm",
    checkedAt: new Date().toISOString(),
  };

  await getRedisConnection().set(
    WORKER_HEALTH_KEY,
    JSON.stringify(payload),
    "EX",
    WORKER_HEARTBEAT_TTL_SECONDS
  );
}

/**
 * Called whenever the worker actually picks up a job (BullMQ's "active"
 * event). Distinct from the heartbeat: this is the signal that the job
 * loop, not just the process, is alive.
 */
export async function recordWorkerActivity() {
  await getRedisConnection().set(WORKER_ACTIVITY_KEY, new Date().toISOString());
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  const redis = getRedisConnection();
  const [heartbeatRaw, lastActiveRaw, queueCounts] = await Promise.all([
    redis.get(WORKER_HEALTH_KEY),
    redis.get(WORKER_ACTIVITY_KEY),
    getDMQueue().getJobCounts("waiting", "active"),
  ]);
  const heartbeat = parseJson<WorkerHeartbeat>(heartbeatRaw);

  const ageMs = heartbeat
    ? Date.now() - new Date(heartbeat.checkedAt).getTime()
    : null;
  const heartbeatHealthy =
    ageMs != null && ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000;

  const queueWaiting = queueCounts.waiting ?? 0;
  const lastActiveAgeMs = lastActiveRaw
    ? Date.now() - new Date(lastActiveRaw).getTime()
    : null;
  const stalled =
    queueWaiting > 0 &&
    queueCounts.active === 0 &&
    (lastActiveAgeMs == null || lastActiveAgeMs > STALL_THRESHOLD_MS);

  return {
    healthy: heartbeatHealthy && !stalled,
    heartbeat,
    ageMs,
    stalled,
    queueWaiting,
  };
}

export async function recordWorkerAlert(alert: Omit<WorkerAlert, "createdAt">) {
  const payload: WorkerAlert = {
    ...alert,
    createdAt: new Date().toISOString(),
  };

  const redis = getRedisConnection();
  await redis.lpush(WORKER_ALERTS_KEY, JSON.stringify(payload));
  await redis.ltrim(WORKER_ALERTS_KEY, 0, 24);
}

export async function getWorkerAlerts(limit = 10): Promise<WorkerAlert[]> {
  const values = await getRedisConnection().lrange(
    WORKER_ALERTS_KEY,
    0,
    Math.max(0, limit - 1)
  );

  return values
    .map((value) => parseJson<WorkerAlert>(value))
    .filter((value): value is WorkerAlert => Boolean(value));
}
