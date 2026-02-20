const args = process.argv.slice(2);

const getArgValue = (name) => {
  const item = args.find((entry) => entry.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : "";
};

const parseBoolean = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
};

const baseUrl = (getArgValue("--base") || "http://localhost:8080").replace(/\/+$/, "");
const expectedSource = getArgValue("--expect-source");
const expectedMaintenanceRaw = getArgValue("--expect-maintenance");
const expectedMaintenance = parseBoolean(expectedMaintenanceRaw);

if (expectedMaintenanceRaw && expectedMaintenance === null) {
  console.error("--expect-maintenance must be true|false");
  process.exit(1);
}

const main = async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`/api/health returned ${response.status}: ${body}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("/api/health returned invalid JSON payload");
  }

  if (expectedSource && String(payload.dataSource || "") !== expectedSource) {
    throw new Error(
      `health dataSource mismatch: expected "${expectedSource}", got "${payload.dataSource}"`,
    );
  }

  if (expectedMaintenance !== null && Boolean(payload.maintenanceMode) !== expectedMaintenance) {
    throw new Error(
      `health maintenanceMode mismatch: expected "${expectedMaintenance}", got "${payload.maintenanceMode}"`,
    );
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        expectedSource: expectedSource || null,
        expectedMaintenance: expectedMaintenanceRaw ? expectedMaintenance : null,
        payload,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
