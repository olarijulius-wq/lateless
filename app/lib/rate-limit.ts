import { sql } from '@/app/lib/db';

export type RateLimitResult = {
  ok: boolean;
  retryAfterMs?: number;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const normalizedKey = key.trim().toLowerCase().slice(0, 256);

  const rows = await sql<{
    count: number;
    retry_after_sec: number;
  }[]>`
    with bumped as (
      insert into public.api_rate_limits (bucket, key, window_start, count)
      values ('legacy', ${normalizedKey}, now(), 1)
      on conflict (bucket, key)
      do update
      set
        count = case
          when public.api_rate_limits.window_start <= now() - (${windowSec} * interval '1 second')
            then 1
          else public.api_rate_limits.count + 1
        end,
        window_start = case
          when public.api_rate_limits.window_start <= now() - (${windowSec} * interval '1 second')
            then now()
          else public.api_rate_limits.window_start
        end
      returning count, window_start
    )
    select
      count,
      greatest(
        0,
        ceil(${windowSec} - extract(epoch from (now() - window_start)))::int
      ) as retry_after_sec
    from bumped
  `;

  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) {
    return {
      ok: false,
      retryAfterMs: Math.max(0, Number(rows[0]?.retry_after_sec ?? windowSec) * 1000),
    };
  }

  return { ok: true };
}
