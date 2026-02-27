const alertFingerprint = (alert) =>
  JSON.stringify({
    code: String(alert?.code || ""),
    severity: String(alert?.severity || ""),
    title: String(alert?.title || ""),
    description: String(alert?.description || ""),
  });

export const indexAlertsByCode = (alerts) => {
  const map = new Map();
  (Array.isArray(alerts) ? alerts : []).forEach((alert) => {
    const code = String(alert?.code || "").trim();
    if (!code) {
      return;
    }
    map.set(code, {
      ...alert,
      code,
      _fingerprint: alertFingerprint(alert),
    });
  });
  return map;
};

export const diffOperationalAlertSets = ({ previousAlerts = [], currentAlerts = [] } = {}) => {
  const previousByCode = indexAlertsByCode(previousAlerts);
  const currentByCode = indexAlertsByCode(currentAlerts);

  const triggered = [];
  const changed = [];
  const resolved = [];

  currentByCode.forEach((currentAlert, code) => {
    const previous = previousByCode.get(code);
    if (!previous) {
      const { _fingerprint: _ignored, ...plain } = currentAlert;
      triggered.push(plain);
      return;
    }
    if (previous._fingerprint !== currentAlert._fingerprint) {
      const { _fingerprint: _ignored, ...plain } = currentAlert;
      changed.push(plain);
    }
  });

  previousByCode.forEach((previousAlert, code) => {
    if (currentByCode.has(code)) {
      return;
    }
    const { _fingerprint: _ignored, ...plain } = previousAlert;
    resolved.push(plain);
  });

  return {
    triggered,
    changed,
    resolved,
    hasChanges: triggered.length > 0 || changed.length > 0 || resolved.length > 0,
  };
};

