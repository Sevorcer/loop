#!/usr/bin/env node

import {
  buildSummaryText,
  didThresholdsPass,
  explainAuthConfig,
  loadThresholds,
  parseHarnessConfig,
  printArtifactLocations,
  runWritePathWorkflow,
  summarizeExecution,
  writeArtifacts,
} from "./write-path-common.mjs";

function parseInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function parseDuration(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

async function runLoad(config) {
  const concurrency = parseInteger(process.env.LOOP_LOAD_CONCURRENCY, 2);
  const totalIterations = parseInteger(process.env.LOOP_LOAD_ITERATIONS, 10);
  const maxDurationSeconds = parseDuration(process.env.LOOP_LOAD_DURATION_SECONDS, 0);

  const startTimeMs = Date.now();
  const deadlineMs = maxDurationSeconds > 0 ? startTimeMs + maxDurationSeconds * 1000 : null;
  const workerCount = Math.min(concurrency, totalIterations);
  const workerAssignments = Array.from({ length: workerCount }, (_, index) => {
    const assigned = [];
    for (let iteration = index + 1; iteration <= totalIterations; iteration += workerCount) {
      assigned.push(iteration);
    }
    return assigned;
  });

  const worker = async (vu, assignedIterations) => {
    const runs = [];
    for (const iteration of assignedIterations) {
      if (deadlineMs && Date.now() > deadlineMs) break;
      const run = await runWritePathWorkflow(config, { vu, iteration });
      runs.push(run);
    }
    return runs;
  };

  const settled = await Promise.all(
    workerAssignments.map((assignedIterations, index) => worker(index + 1, assignedIterations)),
  );
  return {
    workflowRuns: settled.flat(),
    concurrency,
    totalIterations,
    maxDurationSeconds,
  };
}

async function main() {
  const config = parseHarnessConfig(process.env);
  const startedAt = new Date().toISOString();

  if (!config.dryRun && !config.baseUrl) {
    throw new Error(`LOOP_BASE_URL is required for load runs.\n${explainAuthConfig()}`);
  }

  const execution = await runLoad(config);
  const completedAt = new Date().toISOString();

  const summary = summarizeExecution({
    startedAt,
    completedAt,
    workflowRuns: execution.workflowRuns,
    thresholdConfig: loadThresholds("load"),
  });

  const thresholdPass = didThresholdsPass(summary);
  const summaryText = buildSummaryText("load", summary, config.enforceThresholds);
  const artifacts = writeArtifacts(
    "write-path-load",
    config,
    {
      config,
      executionMeta: {
        concurrency: execution.concurrency,
        requestedIterations: execution.totalIterations,
        maxDurationSeconds: execution.maxDurationSeconds,
      },
      summary,
    },
    summaryText,
  );

  console.log(summaryText);
  printArtifactLocations(artifacts);

  const failedRun = execution.workflowRuns.find((run) => !run.success);
  if (failedRun) {
    const failedStep = failedRun.steps.find((step) => !step.ok);
    const message = failedStep
      ? `Load workflow failure: ${failedStep.operation} ${failedStep.method} ${failedStep.path} status=${failedStep.status} error=${failedStep.error ?? "n/a"}`
      : "Load workflow failed with unknown error.";
    throw new Error(message);
  }

  if (!thresholdPass && config.enforceThresholds) {
    throw new Error("Load thresholds failed in blocking mode.");
  }
}

main().catch((error) => {
  console.error("WRITE-PATH LOAD FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
