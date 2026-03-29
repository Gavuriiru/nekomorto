const REQUIRED_DEPENDENCY_KEYS = [
  "dataEncryptionKeyring",
  "dataRepository",
  "decryptStringWithKeyring",
  "metricsRegistry",
  "sessionStore",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[user-session-security-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createUserSessionSecurityRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    dataEncryptionKeyring,
    dataRepository,
    decryptStringWithKeyring,
    metricsRegistry,
    sessionStore,
  } = dependencies;

  const loadUserMfaTotpRecord = (userId) => {
    const normalizedId = String(userId || "").trim();
    if (
      !normalizedId ||
      !dataRepository ||
      typeof dataRepository.loadUserMfaTotpRecord !== "function"
    ) {
      return null;
    }
    return dataRepository.loadUserMfaTotpRecord(normalizedId);
  };

  const writeUserMfaTotpRecord = (userId, record) => {
    const normalizedId = String(userId || "").trim();
    if (
      !normalizedId ||
      !dataRepository ||
      typeof dataRepository.writeUserMfaTotpRecord !== "function"
    ) {
      return null;
    }
    dataRepository.writeUserMfaTotpRecord(normalizedId, record);
    return loadUserMfaTotpRecord(normalizedId);
  };

  const deleteUserMfaTotpRecord = (userId) => {
    const normalizedId = String(userId || "").trim();
    if (
      !normalizedId ||
      !dataRepository ||
      typeof dataRepository.deleteUserMfaTotpRecord !== "function"
    ) {
      return;
    }
    dataRepository.deleteUserMfaTotpRecord(normalizedId);
  };

  const isTotpEnabledForUser = (userId) => {
    const record = loadUserMfaTotpRecord(userId);
    return Boolean(record && record.enabledAt && !record.disabledAt && record.secretEncrypted);
  };

  const getUserTotpSecret = (userId) => {
    const record = loadUserMfaTotpRecord(userId);
    if (!record || !record.secretEncrypted || record.disabledAt) {
      return null;
    }
    const decrypted = decryptStringWithKeyring({
      keyring: dataEncryptionKeyring,
      payload: record.secretEncrypted,
    });
    if (!decrypted) {
      return null;
    }
    try {
      const parsed = JSON.parse(decrypted);
      const secret = String(parsed?.secret || "")
        .trim()
        .toUpperCase();
      if (!secret) {
        return null;
      }
      return secret;
    } catch {
      return null;
    }
  };

  const loadUserSessionIndexRecords = ({ userId = null, includeRevoked = true } = {}) => {
    if (!dataRepository || typeof dataRepository.loadUserSessionIndexRecords !== "function") {
      return [];
    }
    return dataRepository.loadUserSessionIndexRecords({ userId, includeRevoked });
  };

  const upsertUserSessionIndexRecord = (record) => {
    if (!dataRepository || typeof dataRepository.upsertUserSessionIndexRecord !== "function") {
      return;
    }
    dataRepository.upsertUserSessionIndexRecord(record);
  };

  const revokeUserSessionIndexRecord = (sid, options = {}) => {
    if (!dataRepository || typeof dataRepository.revokeUserSessionIndexRecord !== "function") {
      return;
    }
    dataRepository.revokeUserSessionIndexRecord(sid, options);
  };

  const removeUserSessionIndexRecord = (sid) => {
    if (!dataRepository || typeof dataRepository.removeUserSessionIndexRecord !== "function") {
      return;
    }
    dataRepository.removeUserSessionIndexRecord(sid);
  };

  const listActiveSessionsForUser = (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
      return [];
    }
    return loadUserSessionIndexRecords({ userId: normalizedUserId, includeRevoked: false })
      .filter((item) => !item.revokedAt)
      .sort(
        (a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime(),
      );
  };

  const destroySessionBySid = (sid) =>
    new Promise((resolve) => {
      try {
        sessionStore.destroy(String(sid || ""), () => resolve());
      } catch {
        resolve();
      }
    });

  const revokeSessionBySid = async ({
    sid,
    revokedBy = null,
    revokeReason = "manual_revoke",
  } = {}) => {
    const normalizedSid = String(sid || "").trim();
    if (!normalizedSid) {
      return false;
    }
    await destroySessionBySid(normalizedSid);
    revokeUserSessionIndexRecord(normalizedSid, {
      revokedBy: revokedBy ? String(revokedBy) : null,
      revokeReason: String(revokeReason || "manual_revoke"),
    });
    metricsRegistry.inc("active_sessions_total", {}, -1);
    return true;
  };

  return {
    deleteUserMfaTotpRecord,
    getUserTotpSecret,
    isTotpEnabledForUser,
    listActiveSessionsForUser,
    loadUserMfaTotpRecord,
    loadUserSessionIndexRecords,
    removeUserSessionIndexRecord,
    revokeSessionBySid,
    revokeUserSessionIndexRecord,
    upsertUserSessionIndexRecord,
    writeUserMfaTotpRecord,
  };
};

export default createUserSessionSecurityRuntime;
