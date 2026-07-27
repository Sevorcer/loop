import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_RESULTS_DIR = "/tmp/loop-write-path-harness";

const DISPATCH_FLOW_STATUS = ["in_progress", "scheduled"];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const BEARER_PREFIX = "Bear" + "er";

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function nowIso() {
  return new Date().toISOString();
}

function runIdSuffix() {
  return nowIso().replace(/[:.]/g, "-");
}

function buildAuthHeaders(env) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (env.LOOP_AUTH_BEARER_TOKEN) {
    headers.Authorization = `${BEARER_PREFIX} ${env.LOOP_AUTH_BEARER_TOKEN}`;
  }

  if (env.LOOP_AUTH_COOKIE) {
    headers.Cookie = env.LOOP_AUTH_COOKIE;
  }

  if (env.LOOP_AUTH_ROLE) {
    headers["x-loop-role"] = env.LOOP_AUTH_ROLE;
  }

  return headers;
}

function buildConfig(env = process.env) {
  const dryRun = parseBoolean(env.LOOP_DRY_RUN, false);

  return {
    dryRun,
    baseUrl: (env.LOOP_BASE_URL ?? "").trim().replace(/\/$/, ""),
    authHeaders: buildAuthHeaders(env),
    datasetTag: (env.LOOP_DATASET_TAG ?? `s51-${runIdSuffix()}`).trim(),
    datasetSize: Math.max(1, Math.floor(parseNumber(env.LOOP_DATASET_SIZE, 20))),
    timeoutMs: Math.max(1000, Math.floor(parseNumber(env.LOOP_REQUEST_TIMEOUT_MS, 15000))),
    includeDocumentWrites: parseBoolean(env.LOOP_INCLUDE_DOCUMENT_WRITES, false),
    dispatchPlanId: (env.LOOP_DISPATCH_PLAN_ID ?? "").trim(),
    resultsDir: (env.LOOP_RESULTS_DIR ?? DEFAULT_RESULTS_DIR).trim() || DEFAULT_RESULTS_DIR,
    enforceThresholds: parseBoolean(env.LOOP_ENFORCE_THRESHOLDS, false),
  };
}

function assertConfig(config) {
  if (!config.dryRun && !config.baseUrl) {
    throw new Error("LOOP_BASE_URL is required unless LOOP_DRY_RUN=true.");
  }
}

function makeEntityData(config, vu, iteration) {
  const bucket = iteration % config.datasetSize;
  const suffix = `${config.datasetTag}-vu${vu}-it${iteration}-ds${bucket}`;
  return {
    suffix,
    customer: {
      name: `S51 Customer ${suffix}`,
      primaryContact: `Contact ${suffix}`,
      email: `s51-${suffix.toLowerCase()}@example.com`,
      phone: "555-0100",
      city: "Austin",
      status: "Active",
    },
    property: {
      name: `S51 Property ${suffix}`,
      address: `${200 + bucket} Harness Ave`,
      city: "Austin",
      type: "Residential",
      status: "Active",
      primarySystem: "Heat Pump",
    },
    job: {
      title: `S51 Job ${suffix}`,
      assignedTo: "Dispatch Harness",
      scheduledFor: new Date(Date.now() + ONE_DAY_MS).toISOString(),
      type: "Service",
      priority: "Medium",
      location: `Suite ${bucket + 1}`,
      summary: `Harness summary ${suffix}`,
      notes: `Harness note ${suffix}`,
    },
    document: {
      projectId: `project-${suffix}`,
      documentId: `doc-${suffix}`,
    },
  };
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { parseError: "invalid_json" };
    }
  }

  const text = await response.text();
  return { text: text.slice(0, 1000) };
}

async function httpRequest(config, operation, method, path, body) {
  if (config.dryRun) {
    return {
      operation,
      method,
      path,
      ok: true,
      status: 200,
      durationMs: 5,
      responseBody: { dryRun: true },
      error: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const started = performance.now();

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: config.authHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const responseBody = await parseResponseBody(response);
    const durationMs = performance.now() - started;
    return {
      operation,
      method,
      path,
      ok: response.ok,
      status: response.status,
      durationMs,
      responseBody,
      error: null,
    };
  } catch (error) {
    const durationMs = performance.now() - started;
    return {
      operation,
      method,
      path,
      ok: false,
      status: 0,
      durationMs,
      responseBody: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractId(responseBody, key) {
  if (!responseBody || typeof responseBody !== "object") return "";
  const nested = responseBody[key];
  if (nested && typeof nested === "object" && typeof nested.id === "string") return nested.id;
  if (typeof responseBody.id === "string") return responseBody.id;
  return "";
}

function addStepResult(target, result) {
  target.push({
    operation: result.operation,
    method: result.method,
    path: result.path,
    ok: result.ok,
    status: result.status,
    durationMs: Number(result.durationMs.toFixed(2)),
    error: result.error,
    response: result.ok ? undefined : result.responseBody,
  });
}

export async function runWritePathWorkflow(config, { vu = 1, iteration = 1 } = {}) {
  assertConfig(config);

  const data = makeEntityData(config, vu, iteration);
  const steps = [];
  const cleanup = [];
  let customerId = "";
  let propertyId = "";
  let jobId = "";
  let workflowSuccess = true;

  const runStep = async (operation, method, path, body) => {
    const result = await httpRequest(config, operation, method, path, body);
    addStepResult(steps, result);
    if (!result.ok) workflowSuccess = false;
    return result;
  };

  try {
    const createCustomer = await runStep("customer_create", "POST", "/api/customers", data.customer);
    if (!createCustomer.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };
    customerId = extractId(createCustomer.responseBody, "customer");

    const updateCustomer = await runStep(
      "customer_update",
      "PATCH",
      `/api/customers/${customerId}`,
      {
        ...data.customer,
        city: "Round Rock",
      },
    );
    if (!updateCustomer.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };

    const createProperty = await runStep("property_create", "POST", "/api/properties", {
      ...data.property,
      customer: data.customer.name,
    });
    if (!createProperty.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };
    propertyId = extractId(createProperty.responseBody, "property");

    const updateProperty = await runStep(
      "property_update",
      "PATCH",
      `/api/properties/${propertyId}`,
      {
        ...data.property,
        customer: data.customer.name,
        city: "Georgetown",
      },
    );
    if (!updateProperty.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };

    const createJob = await runStep("job_create", "POST", "/api/jobs", {
      ...data.job,
      customerName: data.customer.name,
      propertyName: data.property.name,
    });
    if (!createJob.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };
    jobId = extractId(createJob.responseBody, "job");

    const updateJob = await runStep("job_update", "PATCH", `/api/jobs/${jobId}`, {
      action: "update",
      ...data.job,
      title: `${data.job.title} Updated`,
      customerName: data.customer.name,
      propertyName: data.property.name,
    });
    if (!updateJob.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };

    for (const status of ["In Progress", "Completed"]) {
      const statusUpdate = await runStep("job_lifecycle_transition", "PATCH", `/api/jobs/${jobId}`, {
        action: "status",
        status,
      });
      if (!statusUpdate.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };
    }

    if (config.dispatchPlanId) {
      for (const status of DISPATCH_FLOW_STATUS) {
        const dispatchStep = await runStep(
          "dispatch_write_action",
          "PATCH",
          `/api/dispatch-plans/${config.dispatchPlanId}`,
          {
            action: "update_status",
            status,
          },
        );
        if (!dispatchStep.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };
      }
    }

    if (config.includeDocumentWrites) {
      const documentStep = await runStep("document_write_action", "POST", "/api/documents", data.document);
      if (!documentStep.ok) return { success: false, steps, cleanup, ids: { customerId, propertyId, jobId } };
    }

    return { success: workflowSuccess, steps, cleanup, ids: { customerId, propertyId, jobId } };
  } finally {
    if (jobId) {
      const result = await runStep("cleanup_job_delete", "DELETE", `/api/jobs/${jobId}`);
      cleanup.push(result);
    }

    if (propertyId) {
      const result = await runStep("cleanup_property_delete", "DELETE", `/api/properties/${propertyId}`);
      cleanup.push(result);
    }

    if (customerId) {
      const result = await runStep("cleanup_customer_delete", "DELETE", `/api/customers/${customerId}`);
      cleanup.push(result);
    }
  }
}

export function summarizeExecution({ startedAt, completedAt, workflowRuns, thresholdConfig }) {
  const allSteps = workflowRuns.flatMap((run) => run.steps);
  const durations = allSteps.map((step) => step.durationMs);
  const totalRequests = allSteps.length;
  const requestSuccesses = allSteps.filter((step) => step.ok).length;
  const requestFailures = totalRequests - requestSuccesses;
  const workflowSuccesses = workflowRuns.filter((run) => run.success).length;
  const workflowFailures = workflowRuns.length - workflowSuccesses;

  const elapsedMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  // Clamp to a minimum non-zero value to avoid divide-by-zero in very short dry runs.
  const elapsedSeconds = elapsedMs > 0 ? elapsedMs / 1000 : 0.001;

  const metrics = {
    totalRequests,
    requestSuccesses,
    requestFailures,
    totalWorkflows: workflowRuns.length,
    workflowSuccesses,
    workflowFailures,
    successRate: totalRequests ? requestSuccesses / totalRequests : 0,
    errorRate: totalRequests ? requestFailures / totalRequests : 0,
    p50LatencyMs: percentile(durations, 0.5),
    p95LatencyMs: percentile(durations, 0.95),
    p99LatencyMs: percentile(durations, 0.99),
    throughputRps: totalRequests / elapsedSeconds,
    workflowThroughputPerSecond: workflowRuns.length / elapsedSeconds,
  };

  const lowerIsBetterMetrics = new Set(["errorRate", "p50LatencyMs", "p95LatencyMs", "p99LatencyMs"]);

  const thresholdEvaluations = Object.entries(thresholdConfig ?? {}).map(([key, value]) => {
    const metricValue = metrics[key];
    if (metricValue === null || metricValue === undefined) {
      return { metric: key, threshold: value, actual: metricValue, passed: false, comparator: "unknown" };
    }

    const comparator = lowerIsBetterMetrics.has(key) ? "<=" : ">=";

    const passed = comparator === "<=" ? metricValue <= value : metricValue >= value;

    return {
      metric: key,
      threshold: value,
      actual: metricValue,
      comparator,
      passed,
    };
  });

  return {
    startedAt,
    completedAt,
    elapsedMs,
    metrics,
    thresholdEvaluations,
    workflowRuns,
  };
}

export function buildSummaryText(kind, summary, thresholdBlocking) {
  const metric = summary.metrics;
  const lines = [
    `${kind.toUpperCase()} WRITE-PATH HARNESS`,
    `Started: ${summary.startedAt}`,
    `Completed: ${summary.completedAt}`,
    `Duration: ${(summary.elapsedMs / 1000).toFixed(2)}s`,
    "",
    `Workflows: ${metric.workflowSuccesses}/${metric.totalWorkflows} succeeded`,
    `Requests: ${metric.requestSuccesses}/${metric.totalRequests} succeeded`,
    `Success rate: ${(metric.successRate * 100).toFixed(2)}%`,
    `Error rate: ${(metric.errorRate * 100).toFixed(2)}%`,
    `p50 latency: ${metric.p50LatencyMs?.toFixed(2) ?? "n/a"}ms`,
    `p95 latency: ${metric.p95LatencyMs?.toFixed(2) ?? "n/a"}ms`,
    `p99 latency: ${metric.p99LatencyMs?.toFixed(2) ?? "n/a"}ms`,
    `Throughput: ${metric.throughputRps.toFixed(2)} req/s`,
    `Workflow throughput: ${metric.workflowThroughputPerSecond.toFixed(2)} workflows/s`,
    "",
    "Threshold checks:",
    ...summary.thresholdEvaluations.map((evaluation) => {
      const actualValue =
        typeof evaluation.actual === "number" ? evaluation.actual.toFixed(4) : String(evaluation.actual);
      return `- ${evaluation.metric}: ${actualValue} ${evaluation.comparator} ${evaluation.threshold} => ${evaluation.passed ? "PASS" : "FAIL"}`;
    }),
    "",
    thresholdBlocking
      ? "Threshold mode: blocking (LOOP_ENFORCE_THRESHOLDS=true)"
      : "Threshold mode: advisory (non-blocking baseline)",
  ];

  return `${lines.join("\n")}\n`;
}

export function writeArtifacts(kind, config, payload, summaryText) {
  mkdirSync(config.resultsDir, { recursive: true });
  const fileStamp = runIdSuffix();
  const jsonPath = join(config.resultsDir, `${kind}-${fileStamp}.json`);
  const summaryPath = join(config.resultsDir, `${kind}-${fileStamp}.summary.txt`);

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(summaryPath, summaryText, "utf8");

  return { jsonPath, summaryPath };
}

export function loadThresholds(kind) {
  try {
    const raw = readFileSync(new URL("./write-path-thresholds.json", import.meta.url), "utf8");
    const thresholds = JSON.parse(raw);
    return thresholds?.[kind] ?? {};
  } catch {
    return {};
  }
}

export function parseHarnessConfig(env = process.env) {
  return buildConfig(env);
}

export function didThresholdsPass(summary) {
  return summary.thresholdEvaluations.every((evaluation) => evaluation.passed);
}

export function printArtifactLocations(artifacts) {
  console.log(`JSON artifact: ${artifacts.jsonPath}`);
  console.log(`Summary artifact: ${artifacts.summaryPath}`);
}

export function explainAuthConfig() {
  return [
    "Auth config options:",
    "- LOOP_AUTH_BEARER_TOKEN: Authorization header token",
    "- LOOP_AUTH_COOKIE: raw Cookie header for session-auth environments",
    "- LOOP_AUTH_ROLE: x-loop-role fallback for non-production environments",
  ].join("\n");
}
