#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SpawnSyncOptions } from "node:child_process";
import spawn from "cross-spawn";
import mri from "mri";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  FRAMEWORKS,
  FRAMEWORK_DEPS,
  FRAMEWORK_INDEX,
  FRAMEWORK_LABELS,
} from "./frameworks.js";
import { type PkgManager, PKG_MANAGERS } from "./pkg-managers.js";

type Argv = mri.Argv<{ framework?: string; pm?: string; verbose?: boolean }>;

/** Resolved options coming from the CLI or user prompts. */
type Options = {
  projectName: string;
  framework: Framework;
  pkgManager: PkgManager;
  verbose: boolean;
};

/** Creates a colored gradient text effect */
function gradient(
  text: string,
  stops: [number, number, number][],
  whiteRange?: [number, number],
): string {
  const chars = [...text];
  return (
    chars
      .map((char, i) => {
        if (whiteRange && i >= whiteRange[0] && i < whiteRange[1])
          return `\x1b[38;2;255;255;255m${char}`;
        const t = chars.length === 1 ? 0 : i / (chars.length - 1);
        const seg = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
        const segT = t * (stops.length - 1) - seg;
        const [r1, g1, b1] = stops[seg];
        const [r2, g2, b2] = stops[seg + 1];
        const r = Math.round(r1 + (r2 - r1) * segT);
        const g = Math.round(g1 + (g2 - g1) * segT);
        const b = Math.round(b1 + (b2 - b1) * segT);
        return `\x1b[38;2;${r};${g};${b}m${char}`;
      })
      .join("") + "\x1b[0m"
  );
}

/** Detects the package manager used to invoke the CLI via npm_config_user_agent. */
function detectPkgManager(): PkgManager {
  const ua: string = process.env.npm_config_user_agent ?? "";
  for (const pm of PKG_MANAGERS) {
    if (ua.startsWith(pm)) return pm;
  }
  return "npm";
}

/** Builds the install/add command args for the given package manager. */
function addArgs(pkgManager: PkgManager, packages: string[], dev: boolean): string[] {
  const cmd = pkgManager === "npm" ? "install" : "add";
  const devFlag: Record<string, string> = {
    npm: "--save-dev",
    pnpm: "-D",
    yarn: "--dev",
    bun: "-d",
  };
  return dev ? [cmd, devFlag[pkgManager] ?? "--save-dev", ...packages] : [cmd, ...packages];
}

/** Runs a command synchronously, exiting the process if it fails. */
function run(cmd: string, args: string[], opts?: SpawnSyncOptions) {
  const result = spawn.sync(cmd, args, { stdio: "ignore", ...opts });
  if (result.error) throw result.error;
  if (result.status != null && result.status !== 0) {
    p.cancel(`${cmd} ${args.join(" ")} failed with exit code ${result.status}`);
    process.exit(result.status);
  }
}

/** Recursively copies a directory, renaming _gitignore to .gitignore. */
function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry === "_gitignore" ? ".gitignore" : entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Returns true if a directory doesn't exist or contains only a .git folder. */
function isEmpty(dir: string): boolean {
  if (!fs.existsSync(dir)) return true;
  const files = fs.readdirSync(dir);
  return files.length === 0 || (files.length === 1 && files[0] === ".git");
}

/** Resolves the project name from the CLI arg or prompts the user. */
async function resolveProjectName(fromArg: string | undefined): Promise<string> {
  if (fromArg) return fromArg;

  const answer = await p.text({
    message: "Project name:",
    placeholder: "rigg-project",
    defaultValue: "rigg-project",
  });

  if (p.isCancel(answer)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  return answer || "rigg-project";
}

/** Resolves the framework from the --framework flag or prompts the user. */
async function resolveFramework(fromArg: string | undefined): Promise<Framework> {
  if (fromArg && FRAMEWORK_DEPS[fromArg as Framework]) return fromArg as Framework;

  const answer = await p.select<Framework>({
    message: "Backend framework:",
    options: FRAMEWORKS,
    initialValue: "none",
  });

  if (p.isCancel(answer)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  return answer;
}

/** Asks the user to confirm before wiping a non-empty target directory. */
async function confirmOverwrite(projectName: string, targetDir: string): Promise<void> {
  if (isEmpty(targetDir)) return;

  const overwrite = await p.confirm({
    message: `${pc.white(projectName)} is not empty. Remove existing files and continue?`,
    initialValue: false,
  });
  if (p.isCancel(overwrite) || !overwrite) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
}

/** Copies the base template, sets the package name, and writes the framework starter code. */
function scaffoldFiles(options: Options, targetDir: string) {
  const directory: string = path.dirname(fileURLToPath(import.meta.url));
  copyDir(path.join(directory, "..", "template"), targetDir);

  const pkgJsonPath: string = path.join(targetDir, "package.json");
  const pkg: Record<string, unknown> = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  pkg.name = options.projectName;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

  fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(targetDir, "src", "index.ts"), FRAMEWORK_INDEX[options.framework]);
}

/** Installs shared dev dependencies and any framework-specific packages. */
function installDependencies(options: Options, targetDir: string) {
  const { pkgManager, framework, verbose } = options;
  const stdio = verbose ? "inherit" : "ignore";

  p.log.step(
    `Installing dependencies with ${gradient(pkgManager, [
      [168, 85, 247],
      [99, 102, 241],
    ])}...`,
  );

  run(
    pkgManager,
    addArgs(
      pkgManager,
      ["@types/node", "oxfmt", "oxlint", "tsdown", "tsx", "typescript", "vitest"],
      true,
    ),
    { cwd: targetDir, stdio },
  );

  if (framework !== "none") {
    p.log.step(
      `Installing ${gradient(FRAMEWORK_LABELS[framework], [
        [168, 85, 247],
        [99, 102, 241],
      ])}...`,
    );
    const { deps, devDeps } = FRAMEWORK_DEPS[framework];
    if (deps.length > 0)
      run(pkgManager, addArgs(pkgManager, deps, false), { cwd: targetDir, stdio });
    if (devDeps.length > 0)
      run(pkgManager, addArgs(pkgManager, devDeps, true), { cwd: targetDir, stdio });
  }
}

/** Prints the gradient intro. */
function showIntro() {
  p.intro(
    pc.bold(
      gradient(
        "rigg - The Unified Toolchain Starter for Node.js",
        [
          [255, 255, 255],
          [168, 85, 247],
          [99, 102, 241],
        ],
        [0, 6],
      ),
    ),
  );
}

/** Prints the gradient outro with next steps. */
function showOutro(options: Options) {
  const { projectName, framework, pkgManager } = options;
  const frameworkLabel = FRAMEWORK_LABELS[framework];
  const stops: [number, number, number][] = [
    [168, 85, 247],
    [99, 102, 241],
  ];
  const text =
    frameworkLabel !== "None"
      ? `Created ${projectName} with ${frameworkLabel}`
      : `Created ${projectName}`;
  const title = gradient(text, stops, ["Created ".length, "Created ".length + projectName.length]);
  const devCmd = pkgManager === "npm" ? "npm run dev" : `${pkgManager} dev`;
  p.outro(`${title}\n\n  ${pc.dim("Now run:")}\n  cd ${projectName}\n  ${devCmd}`);
}

/**
 * Resolves options either from CLI args or user prompts.
 */
async function resolveOptions(argv: Argv): Promise<Options> {
  const projectName: string = await resolveProjectName(argv._[0] as string | undefined);
  await confirmOverwrite(projectName, path.resolve(process.cwd(), projectName));

  const framework: Framework = await resolveFramework(argv.framework);
  const pkgManager: PkgManager = (argv.pm as PkgManager) || detectPkgManager();
  const verbose: boolean = argv.verbose ?? false;

  return {
    projectName,
    framework,
    pkgManager,
    verbose,
  };
}

function initializeGit(options: Options, targetDir: string) {
  p.log.step("Initializing git repository");
  const stdio = options.verbose ? "inherit" : "ignore";
  run("git", ["init", "-b", "main"], { cwd: targetDir, stdio });
}

function formatCode(options: Options, targetDir: string) {
  p.log.step("Formatting code");
  const { pkgManager, verbose } = options;
  const stdio = verbose ? "inherit" : "ignore";
  const execCmd = pkgManager === "bun" ? "x" : "exec";
  const sep = pkgManager === "npm" || pkgManager === "yarn" ? ["--"] : [];
  run(pkgManager, [execCmd, "oxlint", ...sep, "--init"], { cwd: targetDir, stdio });
  run(pkgManager, [execCmd, "oxfmt", ...sep, "--init"], { cwd: targetDir, stdio });
  run(pkgManager, [execCmd, "oxfmt", ...sep, "."], { cwd: targetDir, stdio });
}

async function main(): Promise<void> {
  // Parse CLI arguments
  const argv: Argv = mri(process.argv.slice(2), {
    string: ["framework", "pm"],
    boolean: ["verbose"],
    alias: { f: "framework", v: "verbose" },
  });

  showIntro();

  // Get options either from CLI or user prompts
  const options: Options = await resolveOptions(argv);
  const targetDir: string = path.resolve(process.cwd(), options.projectName);

  scaffoldFiles(options, targetDir);
  initializeGit(options, targetDir);
  installDependencies(options, targetDir);
  formatCode(options, targetDir);

  showOutro(options);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
