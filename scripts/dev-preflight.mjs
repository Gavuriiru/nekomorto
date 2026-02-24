import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_APP_PORT = 8080;
const DEFAULT_HMR_PORT = 24678;
const TARGET_COMMAND_FRAGMENT = "server/index.js";
const SIGTERM_GRACE_MS = 1_500;
const SIGKILL_GRACE_MS = 500;

const thisFilePath = fileURLToPath(import.meta.url);
const isDirectRun =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === thisFilePath;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parsePort = (value, fallback) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    return fallback;
  }
  return parsed;
};

const resolveTargetPorts = () => {
  const appPort = parsePort(process.env.PORT, DEFAULT_APP_PORT);
  const hmrPort = parsePort(process.env.DEV_HMR_PORT, DEFAULT_HMR_PORT);
  return Array.from(new Set([appPort, hmrPort]));
};

const runCommand = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf-8" });
  return {
    status: result.status,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    error: result.error || null,
  };
};

const extractPortFromAddress = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("[") && raw.includes("]:")) {
    const segment = raw.slice(raw.lastIndexOf("]:") + 2);
    const parsed = Number.parseInt(segment, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }
  const lastColonIndex = raw.lastIndexOf(":");
  if (lastColonIndex < 0 || lastColonIndex === raw.length - 1) {
    return null;
  }
  const parsed = Number.parseInt(raw.slice(lastColonIndex + 1), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const buildEmptyPidMap = (ports) => {
  const map = new Map();
  for (const port of ports) {
    map.set(port, new Set());
  }
  return map;
};

const getListeningPidsByPortWindows = (ports) => {
  const pidsByPort = buildEmptyPidMap(ports);
  const targetPorts = new Set(ports);
  const result = runCommand("netstat", ["-ano", "-p", "tcp"]);
  if (result.error || result.status !== 0) {
    return pidsByPort;
  }
  for (const rawLine of result.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const normalized = line.replace(/\s+/g, " ");
    const parts = normalized.split(" ");
    if (parts.length < 5) {
      continue;
    }
    const state = String(parts[3] || "").toUpperCase();
    if (state !== "LISTENING") {
      continue;
    }
    const localAddress = parts[1];
    const port = extractPortFromAddress(localAddress);
    if (!port || !targetPorts.has(port)) {
      continue;
    }
    const pid = Number.parseInt(parts[4], 10);
    if (Number.isInteger(pid) && pid > 0) {
      pidsByPort.get(port)?.add(pid);
    }
  }
  return pidsByPort;
};

const getListeningPidsByPortUnixViaLsof = (ports) => {
  const pidsByPort = buildEmptyPidMap(ports);
  for (const port of ports) {
    const result = runCommand("lsof", [
      "-nP",
      `-iTCP:${port}`,
      "-sTCP:LISTEN",
      "-t",
    ]);
    if (result.error && result.error.code === "ENOENT") {
      return null;
    }
    if (result.status !== 0) {
      continue;
    }
    for (const rawLine of result.stdout.split(/\r?\n/)) {
      const pid = Number.parseInt(rawLine.trim(), 10);
      if (Number.isInteger(pid) && pid > 0) {
        pidsByPort.get(port)?.add(pid);
      }
    }
  }
  return pidsByPort;
};

const getListeningPidsByPortUnixViaSs = (ports) => {
  const pidsByPort = buildEmptyPidMap(ports);
  const targetPorts = new Set(ports);
  const result = runCommand("ss", ["-ltnp"]);
  if (result.error || result.status !== 0) {
    return null;
  }
  for (const rawLine of result.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes("LISTEN")) {
      continue;
    }
    const parts = line.replace(/\s+/g, " ").split(" ");
    if (parts.length < 5) {
      continue;
    }
    const localAddress = parts[3];
    const port = extractPortFromAddress(localAddress);
    if (!port || !targetPorts.has(port)) {
      continue;
    }
    const pidMatches = [...line.matchAll(/pid=(\d+)/g)];
    for (const match of pidMatches) {
      const pid = Number.parseInt(match[1], 10);
      if (Number.isInteger(pid) && pid > 0) {
        pidsByPort.get(port)?.add(pid);
      }
    }
  }
  return pidsByPort;
};

const getListeningPidsByPort = (ports) => {
  if (process.platform === "win32") {
    return getListeningPidsByPortWindows(ports);
  }
  const viaLsof = getListeningPidsByPortUnixViaLsof(ports);
  if (viaLsof) {
    return viaLsof;
  }
  const viaSs = getListeningPidsByPortUnixViaSs(ports);
  if (viaSs) {
    return viaSs;
  }
  return buildEmptyPidMap(ports);
};

const isPortInUse = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (error?.code === "EADDRINUSE") {
        resolve(true);
        return;
      }
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen({ port });
  });

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "EPERM") {
      return true;
    }
    return false;
  }
};

const readNodeProcessesUnix = () => {
  const result = runCommand("ps", ["-ax", "-o", "pid=,command="]);
  if (result.error || result.status !== 0) {
    return [];
  }
  const processes = [];
  for (const rawLine of result.stdout.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(\d+)\s+(.*)$/);
    if (!match) {
      continue;
    }
    const pid = Number.parseInt(match[1], 10);
    const command = String(match[2] || "").trim();
    if (!Number.isInteger(pid) || pid <= 0 || !command) {
      continue;
    }
    if (!/\bnode(\.exe)?\b/i.test(command)) {
      continue;
    }
    processes.push({ pid, command });
  }
  return processes;
};

const readNodeProcessesWindows = () => {
  const psCommand =
    "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress";
  const result = runCommand("powershell", ["-NoProfile", "-Command", psCommand]);
  if (result.error || result.status !== 0) {
    return [];
  }
  const raw = result.stdout.trim();
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .map((entry) => {
        const pid = Number.parseInt(String(entry?.ProcessId ?? ""), 10);
        const command = String(entry?.CommandLine || "").trim();
        return { pid, command };
      })
      .filter((entry) => Number.isInteger(entry.pid) && entry.pid > 0);
  } catch {
    return [];
  }
};

const readNodeProcesses = () =>
  process.platform === "win32"
    ? readNodeProcessesWindows()
    : readNodeProcessesUnix();

const normalizeCommand = (value) =>
  String(value || "")
    .replace(/\\/g, "/")
    .toLowerCase();

const isTargetAppCommand = (command) =>
  normalizeCommand(command).includes(TARGET_COMMAND_FRAGMENT);

const sendSignal = (pid, signal) => {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
};

const describePidUnix = (pid) => {
  const result = runCommand("ps", ["-p", String(pid), "-o", "command="]);
  if (result.error || result.status !== 0) {
    return "<unknown>";
  }
  const command = result.stdout.trim();
  return command || "<unknown>";
};

const describePidWindows = (pid) => {
  const psCommand = `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`;
  const result = runCommand("powershell", ["-NoProfile", "-Command", psCommand]);
  if (result.error || result.status !== 0) {
    return "<unknown>";
  }
  const raw = result.stdout.trim();
  if (!raw) {
    return "<unknown>";
  }
  try {
    const parsed = JSON.parse(raw);
    const command = String(parsed?.CommandLine || "").trim();
    return command || "<unknown>";
  } catch {
    return "<unknown>";
  }
};

const describePid = (pid) =>
  process.platform === "win32" ? describePidWindows(pid) : describePidUnix(pid);

const getPortState = async (ports) => {
  const pidsByPort = getListeningPidsByPort(ports);
  const states = [];
  for (const port of ports) {
    const ownerPids = Array.from(pidsByPort.get(port) || []);
    let inUse = ownerPids.length > 0;
    if (!inUse) {
      inUse = await isPortInUse(port);
    }
    states.push({ port, inUse, ownerPids });
  }
  return states;
};

const buildManualInstructions = (ports) => {
  if (process.platform === "win32") {
    return ports.flatMap((port) => [
      `- Verifique a porta ${port}: netstat -ano | findstr :${port}`,
      "- Mate manualmente se necessario: taskkill /PID <pid> /F",
    ]);
  }
  return ports.flatMap((port) => [
    `- Verifique a porta ${port}: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    "- Mate manualmente se necessario: kill -TERM <pid>",
  ]);
};

const formatConflictError = (states) => {
  const occupied = states.filter((state) => state.inUse);
  const lines = ["Port conflict detected before dev server startup."];
  for (const state of occupied) {
    if (!state.ownerPids.length) {
      lines.push(
        `- Port ${state.port}: occupied (PID owner could not be resolved automatically).`,
      );
      continue;
    }
    lines.push(`- Port ${state.port}: PID(s) ${state.ownerPids.join(", ")}`);
    for (const pid of state.ownerPids) {
      lines.push(`  - PID ${pid}: ${describePid(pid)}`);
    }
  }
  lines.push("Manual recovery:");
  lines.push(...buildManualInstructions(occupied.map((state) => state.port)));
  return lines.join("\n");
};

export const runDevPreflight = async () => {
  const ports = resolveTargetPorts();
  const initialState = await getPortState(ports);
  const initiallyOccupied = initialState.filter((state) => state.inUse);
  if (!initiallyOccupied.length) {
    return;
  }

  const ownersOnTargetPorts = new Set(
    initiallyOccupied.flatMap((state) => state.ownerPids),
  );
  const nodeProcesses = readNodeProcesses().filter((processInfo) => {
    if (processInfo.pid === process.pid) {
      return false;
    }
    return isTargetAppCommand(processInfo.command);
  });
  const appNodePidSet = new Set(nodeProcesses.map((processInfo) => processInfo.pid));
  const targetPids = Array.from(ownersOnTargetPorts).filter((pid) =>
    appNodePidSet.has(pid),
  );

  if (targetPids.length) {
    console.log(
      `[dev:preflight] Found existing app process(es): ${targetPids.join(", ")}. Stopping before restart...`,
    );
    for (const pid of targetPids) {
      sendSignal(pid, "SIGTERM");
    }
    await sleep(SIGTERM_GRACE_MS);

    const survivors = targetPids.filter((pid) => isProcessAlive(pid));
    if (survivors.length) {
      for (const pid of survivors) {
        sendSignal(pid, "SIGKILL");
      }
      await sleep(SIGKILL_GRACE_MS);
    }
  }

  const finalState = await getPortState(ports);
  const stillOccupied = finalState.filter((state) => state.inUse);
  if (stillOccupied.length) {
    throw new Error(formatConflictError(finalState));
  }
};

if (isDirectRun) {
  runDevPreflight().catch((error) => {
    console.error(`[dev:preflight] ${String(error?.message || error)}`);
    process.exit(1);
  });
}
