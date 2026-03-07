import 'server-only';

type DebugValue = string | number | boolean | null;

type DashboardQueryLogInput = {
  route: string;
  method: string;
  label: string;
  durationMs: number;
  details?: Record<string, DebugValue>;
};

type DashboardRouteTraceInput = {
  route: string;
  userId?: string | null;
  workspaceId?: string | null;
};

function isTruthy(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export function dashboardDebugEnabled() {
  return isTruthy(process.env.DEBUG_DASHBOARD_QUERIES);
}

export function logDashboardQuery(input: DashboardQueryLogInput) {
  if (!dashboardDebugEnabled()) {
    return;
  }

  const level = input.durationMs >= 750 ? 'warn' : 'info';
  console[level]('[dashboard][query]', {
    route: input.route,
    method: input.method,
    label: input.label,
    durationMs: input.durationMs,
    ...(input.details ?? {}),
  });
}

export function startDashboardRouteTrace(input: DashboardRouteTraceInput) {
  if (!dashboardDebugEnabled()) {
    return () => {};
  }

  const startedAt = Date.now();
  console.info('[dashboard][route]', {
    route: input.route,
    phase: 'start',
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
  });

  return (details?: Record<string, DebugValue>) => {
    console.info('[dashboard][route]', {
      route: input.route,
      phase: 'finish',
      durationMs: Date.now() - startedAt,
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      ...(details ?? {}),
    });
  };
}
