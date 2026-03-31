#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SpawnSyncOptions } from "node:child_process";
import spawn from "cross-spawn";
import mri from "mri";
import * as p from "@clack/prompts";
import pc from "picocolors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { type Framework, FRAMEWORKS, FRAMEWORK_DEPS, FRAMEWORK_INDEX } from "./frameworks.js";

type Argv = mri.Argv<{ template?: string }>;

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
function detectPkgManager(): string {
  const ua: string = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("bun")) return "bun";
  if (ua.startsWith("yarn")) return "yarn";
  return "npm";
}

/** Builds the install/add command args for the given package manager. */
function addArgs(pkgManager: string, packages: string[], dev: boolean): string[] {
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
function run(cmd: string, args: string[], opts?: SpawnSyncOptions): void {
  const result = spawn.sync(cmd, args, { stdio: "inherit", ...opts });
  if (result.status != null && result.status !== 0) process.exit(result.status);
  if (result.error) throw result.error;
}

/** Recursively copies a directory, renaming _gitignore to .gitignore. */
function copyDir(src: string, dest: string): void {
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

/** Prompts for a project name, or reads it from the first CLI argument. */
async function promptProjectName(argv: Argv): Promise<string> {
  const fromArg = (argv._[0] as string | undefined) ?? "";
  if (fromArg) return fromArg;

  const answer = await p.text({
    message: "Project name:",
    placeholder: "planke-project",
    defaultValue: "planke-project",
  });

  if (p.isCancel(answer)) {
    p.cancel("Cancelled");
    process.exit(0);
  }

  return answer || "planke-project";
}

/** Prompts for a backend framework, or reads it from the --template flag. */
async function promptFramework(argv: Argv): Promise<Framework> {
  const templateArg = argv.template as Framework | undefined;
  if (templateArg && FRAMEWORK_DEPS[templateArg]) return templateArg;

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
    message: `${pc.yellow(projectName)} is not empty. Remove existing files and continue?`,
  });
  if (p.isCancel(overwrite) || !overwrite) {
    p.cancel("Cancelled");
    process.exit(0);
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
}

/** Copies the base template, sets the package name, and writes the framework starter code. */
function scaffoldFiles(projectName: string, framework: Framework, targetDir: string): void {
  copyDir(path.join(__dirname, "..", "template"), targetDir);

  const pkgJsonPath = path.join(targetDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8")) as Record<string, unknown>;
  pkg.name = projectName;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

  fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(targetDir, "src", "index.ts"), FRAMEWORK_INDEX[framework]);
}

/** Installs shared dev dependencies and any framework-specific packages. */
function installDependencies(pkgManager: string, framework: Framework, targetDir: string): void {
  p.log.step(`Installing dependencies with ${pkgManager}...`);
  run(
    pkgManager,
    addArgs(
      pkgManager,
      ["@types/node", "oxfmt", "oxlint", "tsdown", "tsx", "typescript", "vitest"],
      true,
    ),
    { cwd: targetDir },
  );

  /** Install framework dependencies */
  if (framework !== "none") {
    p.log.step(`Installing ${framework}...`);
    const frameworkDeps = FRAMEWORK_DEPS[framework];

    if (frameworkDeps.deps.length > 0)
      run(pkgManager, addArgs(pkgManager, frameworkDeps.deps, false), { cwd: targetDir });

    if (frameworkDeps.devDeps.length > 0)
      run(pkgManager, addArgs(pkgManager, frameworkDeps.devDeps, true), { cwd: targetDir });
  }
}

/** Prints the gradient outro with next steps. */
function showOutro(projectName: string, framework: Framework, pkgManager: string): void {
  const frameworkLabel: string = FRAMEWORKS.find((f) => f.value === framework)?.label ?? framework;
  const outroStops: [number, number, number][] = [
    [168, 85, 247],
    [99, 102, 241],
  ];
  const outroText =
    frameworkLabel !== "None"
      ? `Created ${projectName} with ${frameworkLabel}`
      : `Created ${projectName}`;
  const nameStart = "Created ".length;
  const outro = gradient(outroText, outroStops, [nameStart, nameStart + projectName.length]);

  const devCmd: string = pkgManager === "npm" ? "npm run dev" : `${pkgManager} dev`;
  p.outro(`${outro}\n\n  ${pc.dim("Now run:")}\n  cd ${projectName}\n  ${devCmd}`);
}

async function main(): Promise<void> {
  const argv: Argv = mri(process.argv.slice(2), {
    string: ["template"],
    alias: { t: "template" },
  }) as Argv;

  p.intro(
    pc.bold(
      gradient(
        "planke - The Unified Toolchain Starter for Node.js",
        [
          [255, 255, 255],
          [168, 85, 247],
          [99, 102, 241],
        ],
        [0, 6],
      ),
    ),
  );

  const projectName: string = await promptProjectName(argv);
  const framework: Framework = await promptFramework(argv);
  const targetDir: string = path.resolve(process.cwd(), projectName);
  const pkgManager: string = detectPkgManager();

  await confirmOverwrite(projectName, targetDir);
  scaffoldFiles(projectName, framework, targetDir);

  run("git", ["init", "-b", "main"], { cwd: targetDir, stdio: "ignore" });
  p.log.step("Initializing git repository");

  installDependencies(pkgManager, framework, targetDir);

  p.log.step("Formatting code");
  run(pkgManager, ["exec", "oxlint", "--", "--init"], { cwd: targetDir, stdio: "ignore" });
  run(pkgManager, ["exec", "oxfmt", "--", "--init"], { cwd: targetDir, stdio: "ignore" });
  run(pkgManager, ["exec", "oxfmt"], { cwd: targetDir, stdio: "ignore" });

  showOutro(projectName, framework, pkgManager);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
