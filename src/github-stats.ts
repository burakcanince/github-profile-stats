#!/usr/bin/env node

import { createClient } from "./github.js";
import { HELP, parseOptions } from "./options.js";
import { createStyle, printComparison, printReport, printUserSections, type Style } from "./render.js";
import { buildCompareRows, buildUserReport, getRepoReport, getUserStats } from "./report.js";
import type { Options } from "./types.js";

interface Output {
  data: unknown;
  print: () => void;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function buildOutputs(options: Options, style: Style): Promise<Output[]> {
  const request = createClient(options.token);
  const output: Output[] = [];

  if (options.user && options.compare) {
    const [first, second] = await Promise.all([
      getUserStats(request, options.user, options),
      getUserStats(request, options.compare, options),
    ]);
    const rows = buildCompareRows(first, second, options);
    output.push({
      data: { compare: [buildUserReport(first, options).data, buildUserReport(second, options).data] },
      print: () => printComparison(first, second, rows, style),
    });
  } else if (options.user) {
    const stats = await getUserStats(request, options.user, options);
    const report = buildUserReport(stats, options);
    output.push({
      data: report.data,
      print: () => {
        printReport(report, style);
        printUserSections(stats, options, style);
      },
    });
  }

  if (options.repo) {
    const report = await getRepoReport(request, options.repo, options.days);
    output.push({ data: report.data, print: () => printReport(report, style) });
  }

  return output;
}

async function main(): Promise<void> {
  let options: Options;
  try {
    options = parseOptions(process.argv.slice(2), process.env, Boolean(process.stdout.isTTY));
  } catch (err) {
    console.error(`Error: ${errorMessage(err)}\nRun "github-profile-stats --help" for usage.`);
    process.exitCode = 1;
    return;
  }

  if (options.help || (!options.user && !options.repo)) {
    console.log(HELP);
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const style = createStyle(options.ansi, options.theme);

  let output: Output[];
  try {
    output = await buildOutputs(options, style);
  } catch (err) {
    console.error(style.error(`Error: ${errorMessage(err)}`));
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    const data = output.map((item) => item.data);
    console.log(JSON.stringify(data.length === 1 ? data[0] : data, null, 2));
    return;
  }

  output.forEach((item, index) => {
    if (index > 0) console.log("");
    item.print();
  });
}

void main();
