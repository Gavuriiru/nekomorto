const REQUIRED_DEPENDENCY_KEYS = [
  "getNormalizeUploadsDeep",
  "getNormalizeUsers",
  "ownerIds",
  "sanitizeIconSource",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[data-repository-basic-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

const resolveLazyDependency = (dependencyName, getter) => {
  if (typeof getter !== "function") {
    throw new Error(`[data-repository-basic-runtime] ${dependencyName} getter must be a function`);
  }
  const value = getter();
  if (typeof value === "function") {
    return value;
  }
  throw new Error(
    `[data-repository-basic-runtime] ${dependencyName} getter must resolve to a function`,
  );
};

export const createDataRepositoryBasicRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    dataRepository = null,
    getNormalizeUploadsDeep,
    getNormalizeUsers,
    ownerIds,
    sanitizeIconSource,
  } = dependencies;

  const hasMethod = (methodName) =>
    Boolean(dataRepository) && typeof dataRepository[methodName] === "function";

  const normalizeOwnerIds = (ids) =>
    Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter(Boolean)),
    );

  const loadOwnerIds = () => {
    if (!hasMethod("loadOwnerIds")) {
      return normalizeOwnerIds(ownerIds);
    }
    const stored = dataRepository.loadOwnerIds();
    return normalizeOwnerIds([...(Array.isArray(ownerIds) ? ownerIds : []), ...(stored || [])]);
  };

  const writeOwnerIds = (ids) => {
    if (hasMethod("writeOwnerIds")) {
      dataRepository.writeOwnerIds(normalizeOwnerIds(ids));
    }
  };

  const isOwner = (id) => loadOwnerIds().includes(String(id));
  const getPrimaryOwnerId = () => loadOwnerIds()[0] || null;
  const isPrimaryOwner = (id) => {
    const primaryOwnerId = getPrimaryOwnerId();
    return Boolean(primaryOwnerId && String(id) === String(primaryOwnerId));
  };

  const loadAllowedUsers = () => {
    if (!hasMethod("loadAllowedUsers")) {
      return [...loadOwnerIds()];
    }
    const parsed = dataRepository.loadAllowedUsers();
    const dbUsers = Array.isArray(parsed) ? parsed : [];
    return Array.from(new Set([...loadOwnerIds(), ...dbUsers]));
  };

  const writeAllowedUsers = (ids) => {
    if (hasMethod("writeAllowedUsers")) {
      dataRepository.writeAllowedUsers(ids);
    }
  };

  const writeUsers = (users) => {
    if (!hasMethod("writeUsers")) {
      return;
    }
    const normalizeUploadsDeep = resolveLazyDependency(
      "getNormalizeUploadsDeep",
      getNormalizeUploadsDeep,
    );
    dataRepository.writeUsers(normalizeUploadsDeep(users));
  };

  const loadUsers = () => {
    if (!hasMethod("loadUsers")) {
      return [];
    }
    const parsed = dataRepository.loadUsers();
    const normalizeUsers = resolveLazyDependency("getNormalizeUsers", getNormalizeUsers);
    const source = Array.isArray(parsed) ? parsed : [];
    const normalized = normalizeUsers(source);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeUsers(normalized);
    }
    return normalized;
  };

  const loadUserLocalAuthRecord = (userId) => {
    if (!hasMethod("loadUserLocalAuthRecord")) {
      return null;
    }
    return dataRepository.loadUserLocalAuthRecord(userId);
  };

  const findUserLocalAuthRecordByIdentifier = (identifier) => {
    if (!hasMethod("findUserLocalAuthRecordByIdentifier")) {
      return null;
    }
    return dataRepository.findUserLocalAuthRecordByIdentifier(identifier);
  };

  const writeUserLocalAuthRecord = (userId, record) => {
    if (!hasMethod("writeUserLocalAuthRecord")) {
      return;
    }
    dataRepository.writeUserLocalAuthRecord(userId, record);
  };

  const deleteUserLocalAuthRecord = (userId) => {
    if (!hasMethod("deleteUserLocalAuthRecord")) {
      return;
    }
    dataRepository.deleteUserLocalAuthRecord(userId);
  };

  const hasUserLocalAuthRecord = (userId) => Boolean(loadUserLocalAuthRecord(userId));

  const loadAllUserLocalAuthRecords = () => {
    if (!hasMethod("loadAllUserLocalAuthRecords")) {
      return [];
    }
    return dataRepository.loadAllUserLocalAuthRecords();
  };

  const countActiveUserLocalAuthRecords = () => {
    const records = loadAllUserLocalAuthRecords();
    return Array.isArray(records)
      ? records.filter((record) => record && !record.disabledAt && record.passwordHash).length
      : 0;
  };

  void hasUserLocalAuthRecord;
  void countActiveUserLocalAuthRecords;

  const normalizeLinkTypes = (items) => {
    const source = Array.isArray(items) ? items : [];
    const dedupe = new Set();
    const normalized = [];
    source.forEach((item) => {
      const id = String(item?.id || "").trim();
      const label = String(item?.label || "").trim();
      if (!id || !label || dedupe.has(id)) {
        return;
      }
      dedupe.add(id);
      normalized.push({
        id,
        label,
        icon: sanitizeIconSource(item?.icon) || "globe",
      });
    });
    return normalized;
  };

  const writeLinkTypes = (items) => {
    if (hasMethod("writeLinkTypes")) {
      dataRepository.writeLinkTypes(normalizeLinkTypes(items));
    }
  };

  const loadLinkTypes = () => {
    if (!hasMethod("loadLinkTypes")) {
      return [];
    }
    const parsed = dataRepository.loadLinkTypes();
    const normalized = normalizeLinkTypes(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      writeLinkTypes(normalized);
    }
    return normalized;
  };

  return {
    deleteUserLocalAuthRecord,
    findUserLocalAuthRecordByIdentifier,
    getPrimaryOwnerId,
    isOwner,
    isPrimaryOwner,
    loadAllowedUsers,
    loadAllUserLocalAuthRecords,
    loadLinkTypes,
    loadOwnerIds,
    loadUserLocalAuthRecord,
    loadUsers,
    normalizeLinkTypes,
    writeAllowedUsers,
    writeLinkTypes,
    writeOwnerIds,
    writeUserLocalAuthRecord,
    writeUsers,
  };
};

export default createDataRepositoryBasicRuntime;
