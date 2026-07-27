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

async function main() {
  const config = parseHarnessConfig(process.env);
  const startedAt = new Date().toISOString();

  if (!config.dryRun && !config.baseUrl) {
    throw new Error(`LOOP_BASE_URL is required for smoke runs.\n${explainAuthConfig()}`);
  }

  const workflowRun = await runWritePathWorkflow(config, { vu: 1, iteration: 1 });
  const completedAt = new Date().toISOString();

  const summary = summarizeExecution({
    startedAt,
    completedAt,
    workflowRuns: [workflowRun],
    thresholdConfig: loadThresholds("smoke"),
  });

  const thresholdPass = didThresholdsPass(summary);
  const summaryText = buildSummaryText("smoke", summary, config.enforceThresholds);
  const artifacts = writeArtifacts("write-path-smoke", config, { config, summary }, summaryText);

  console.log(summaryText);
  printArtifactLocations(artifacts);

  if (!workflowRun.success) {
    const failedStep = workflowRun.steps.find((step) => !step.ok);
    const message = failedStep
      ? `Smoke step failed: ${JSON.stringify(
          {
            operation: failedStep.operation,
            method: failedStep.method,
            path: failedStep.path,
            status: failedStep.status,
            error: failedStep.error ?? "n/a",
          },
          null,
          2,
        )}`
      : "Smoke workflow failed with unknown error.";
    throw new Error(message);
  }

  if (!thresholdPass && config.enforceThresholds) {
    throw new Error("Smoke thresholds failed in blocking mode.");
  }
}

main().catch((error) => {
  console.error("WRITE-PATH SMOKE FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
