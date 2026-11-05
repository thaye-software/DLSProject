// Fails the CI step when a ZAP scan found alerts at or above a risk level, and says why
// in the step log, as annotations on the run page and in the job summary.
//
//   node check-report.js <label> [report.json]
//
// Env: ZAP_FAIL_RISK = lowest risk that fails: 3 High, 2 Medium (default), 1 Low, 0 Informational.
// The report is ZAP's report_json.json; the scan actions write it to the workspace root and every
// scan overwrites it, so this script deletes it once read and a stale one can never be checked twice.
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const RISKS = ["Informational", "Low", "Medium", "High"];
const MAX_INSTANCES = 5;
const MAX_TEXT = 400;

const [label, reportArg] = process.argv.slice(2);
if (!label) {
  console.error("usage: node check-report.js <label> [report.json]");
  process.exit(2);
}
const reportPath = reportArg ?? join(process.env.GITHUB_WORKSPACE ?? ".", "report_json.json");
const failRisk = Number(process.env.ZAP_FAIL_RISK ?? 2);
if (!(failRisk >= 0 && failRisk <= 3)) {
  console.error(`ZAP_FAIL_RISK must be 0-3, got ${process.env.ZAP_FAIL_RISK}`);
  process.exit(2);
}

if (!existsSync(reportPath)) {
  error(`ZAP ${label}`, `No report at ${reportPath}: the scan step above did not finish, see its log.`);
  summary(`### ❌ ZAP ${label}\n\nNo report: the scan did not finish, see the scan step's log.\n`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
rmSync(reportPath);

const alerts = (report.site ?? [])
  .flatMap((site) => site.alerts ?? [])
  .map((alert) => ({ ...alert, risk: Number(alert.riskcode) }))
  .sort((a, b) => b.risk - a.risk || a.name.localeCompare(b.name));
const failing = alerts.filter((alert) => alert.risk >= failRisk);
const counts = RISKS.map((risk, code) => `${risk} ${alerts.filter((alert) => alert.risk === code).length}`).reverse();

// ---- step log ----
console.log(`ZAP ${label}: ${alerts.length} alert type(s): ${counts.join(", ")}. Fails at ${RISKS[failRisk]} and above.\n`);
for (const alert of alerts) {
  const fails = alert.risk >= failRisk;
  console.log(`${fails ? "FAIL" : "ok  "}  ${riskName(alert).padEnd(13)}  ${alert.name}  [rule ${alert.pluginid}, ${alert.instances?.length ?? 0} instance(s)]`);
  if (!fails) continue;
  console.log(`      Why:   ${text(alert.desc)}`);
  for (const instance of (alert.instances ?? []).slice(0, MAX_INSTANCES)) console.log(`      Where: ${where(instance)}`);
  const more = (alert.instances?.length ?? 0) - MAX_INSTANCES;
  if (more > 0) console.log(`             (+ ${more} more)`);
  if (alert.otherinfo) console.log(`      Note:  ${text(alert.otherinfo)}`);
  console.log(`      Fix:   ${text(alert.solution)}`);
  console.log(`      Docs:  ${docs(alert)}\n`);
}

// ---- annotations on the run page ----
for (const alert of failing) {
  const first = alert.instances?.[0];
  error(
    `ZAP ${label}: ${riskName(alert)} - ${alert.name}`,
    `${first ? `${where(first)}. ` : ""}Fix: ${text(alert.solution)} (${docs(alert)})`,
  );
}

// ---- job summary ----
const rows = alerts.map(
  (alert) =>
    `| ${alert.risk >= failRisk ? "❌" : "✅"} | ${riskName(alert)} | [${cell(alert.name)}](${docs(alert)}) | ${alert.instances?.length ?? 0} | ${alert.instances?.[0] ? code(where(alert.instances[0])).replace(/\|/g, "\\|") : ""} |`,
);
summary(
  [
    `### ${failing.length ? "❌" : "✅"} ZAP ${label}`,
    "",
    failing.length
      ? `**${failing.length} alert type(s) at ${RISKS[failRisk]} or above.** Fix them, or if one is a false positive, mark that rule IGNORE in a ZAP rules file.`
      : `No alerts at ${RISKS[failRisk]} or above.`,
    "",
    alerts.length ? "| | Risk | Alert | Instances | First instance |\n|---|---|---|---|---|\n" + rows.join("\n") : "_No alerts._",
    "",
    ...failing.map((alert) =>
      [
        `<details><summary><b>${riskName(alert)}: ${cell(alert.name)}</b></summary>`,
        "",
        `**Why:** ${cell(text(alert.desc))}`,
        "",
        `**Where:**`,
        ...(alert.instances ?? []).slice(0, MAX_INSTANCES).map((instance) => `- ${code(where(instance))}`),
        "",
        `**Fix:** ${cell(text(alert.solution))}`,
        "",
        `**Docs:** ${docs(alert)}`,
        "</details>",
        "",
      ].join("\n"),
    ),
  ].join("\n"),
);

process.exit(failing.length ? 1 : 0);

// ---- helpers ----
function riskName(alert) {
  return `${RISKS[alert.risk] ?? `risk ${alert.riskcode}`}`;
}

function docs(alert) {
  return `https://www.zaproxy.org/docs/alerts/${alert.pluginid}/`;
}

function where(instance) {
  const details = [
    instance.param && `param=${unescape(instance.param)}`,
    instance.attack && `attack=${unescape(instance.attack)}`,
    instance.evidence && `evidence=${unescape(instance.evidence)}`,
  ].filter(Boolean);
  return [`${instance.method} ${unescape(instance.uri)}`, ...details].join("  ");
}

// ZAP HTML-escapes every text field, and descriptions are <p> paragraphs on top.
function unescape(value = "") {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function text(html = "") {
  const plain = unescape(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return plain.length > MAX_TEXT ? `${plain.slice(0, MAX_TEXT)}…` : plain;
}

// Markdown text: attack payloads such as <script> must show as text, not be parsed as HTML.
function cell(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

// Markdown code span: shown verbatim, only a backtick could end it early.
function code(value) {
  return `\`${String(value).replace(/`/g, "'").replace(/\r?\n/g, " ")}\``;
}

// https://docs.github.com/actions/reference/workflow-commands-for-github-actions#setting-an-error-message
function error(title, message) {
  const escapeData = (value) => value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const escapeProperty = (value) => escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=${escapeProperty(title)}::${escapeData(message)}`);
  else console.error(`ERROR ${title}: ${message}`);
}

function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
