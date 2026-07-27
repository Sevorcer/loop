import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const checks = [
  {
    file: "src/app/(shell)/properties/[id]/page.tsx",
    test: (content) => content.includes("listJobsForProperty"),
    warning:
      "Expected server-side jobs fetch in /properties/[id] route. Missing listJobsForProperty may reintroduce client waterfall.",
  },
  {
    file: "src/features/properties/components/PropertyDetailTabs.tsx",
    test: (content) => !/\/api\/properties\/.+\/jobs/.test(content),
    warning:
      "Detected client-side /api/properties/:id/jobs fetch in PropertyDetailTabs. This likely reintroduces a jobs waterfall.",
  },
  {
    file: "src/app/(shell)/installed-systems/[id]/page.tsx",
    test: (content) =>
      content.includes("getInstalledSystemById") &&
      !content.includes("InstalledSystemDetailPageClient"),
    warning:
      "Installed systems detail route appears to have moved back to client lookup. Keep server-side fetch path to avoid waterfall.",
  },
  {
    file: "src/app/(shell)/installed-systems/layout.tsx",
    test: (content) => !content.includes("JobsProvider"),
    warning:
      "Installed systems layout includes JobsProvider again. This can add an unnecessary jobs fetch on installed-systems routes.",
  },
  {
    file: "src/features/company-brain/screens/CompanyBrainScreen.tsx",
    test: (content) =>
      content.includes("useDeferredValue") && content.includes("text: deferredSearchText"),
    warning:
      "Company Brain deferred search guardrail failed. Missing deferred search may reduce typing responsiveness.",
  },
];

let warnings = 0;

for (const check of checks) {
  const content = read(check.file);
  if (!check.test(content)) {
    warnings += 1;
    console.log(`::warning file=${check.file}::${check.warning}`);
  }
}

if (warnings === 0) {
  console.log("S5 route guardrail: no regression signals detected.");
} else {
  console.log(`S5 route guardrail: ${warnings} warning(s) detected.`);
}

// Non-blocking by design.
process.exit(0);
