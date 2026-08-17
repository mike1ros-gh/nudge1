const FREE_TIER_MONTHLY_LIMIT = 500_000;

export interface UpstashUsage {
  databaseName: string;
  plan: string;
  used: number;
  limit: number | null; // null means no fixed monthly command cap (paid plans)
}

interface UpstashDatabase {
  database_id: string;
  database_name: string;
  endpoint: string;
  type: string;
}

interface UpstashDatabaseStats {
  total_monthly_requests: number;
}

function getRedisHostname(): string | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Pulls monthly command usage for whichever Upstash database REDIS_URL
 * currently points at, via Upstash's account-level Management API (not the
 * per-database REST API). Requires UPSTASH_MANAGEMENT_EMAIL/API_KEY, which
 * are scoped to a single Upstash account — if REDIS_URL ever points at a
 * database under a different account than the configured key, no match is
 * found and this returns null rather than erroring.
 */
export async function getUpstashUsage(): Promise<UpstashUsage | null> {
  const email = process.env.UPSTASH_MANAGEMENT_EMAIL;
  const apiKey = process.env.UPSTASH_MANAGEMENT_API_KEY;
  const hostname = getRedisHostname();
  if (!email || !apiKey || !hostname) return null;

  const auth = Buffer.from(`${email}:${apiKey}`).toString("base64");
  const headers = { Authorization: `Basic ${auth}` };

  try {
    const listResponse = await fetch("https://api.upstash.com/v2/redis/databases", {
      headers,
      next: { revalidate: 60 },
    });
    if (!listResponse.ok) return null;

    const databases: UpstashDatabase[] = await listResponse.json();
    const database = databases.find((db) => db.endpoint === hostname);
    if (!database) return null;

    const statsResponse = await fetch(
      `https://api.upstash.com/v2/redis/stats/${database.database_id}`,
      { headers, next: { revalidate: 60 } }
    );
    if (!statsResponse.ok) return null;

    const stats: UpstashDatabaseStats = await statsResponse.json();

    return {
      databaseName: database.database_name,
      plan: database.type,
      used: stats.total_monthly_requests,
      limit: database.type === "free" ? FREE_TIER_MONTHLY_LIMIT : null,
    };
  } catch {
    return null;
  }
}
