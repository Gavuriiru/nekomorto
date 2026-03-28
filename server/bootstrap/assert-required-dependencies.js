const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeSources = (sources = []) =>
  sources.flatMap((source) => {
    if (Array.isArray(source)) {
      return normalizeSources(source);
    }
    return source && typeof source === "object" ? [source] : [];
  });

export const mergeDependencySources = (...sources) =>
  normalizeSources(sources).reduce((merged, source) => Object.assign(merged, source), {});

export const pickDependencyKeys = (source = {}, keys = []) =>
  keys.reduce((picked, key) => {
    if (hasOwn(source, key)) {
      picked[key] = source[key];
    }
    return picked;
  }, {});

export const assertRequiredDependencies = (
  scopeName,
  dependencies = {},
  keys = [],
  options = {},
) => {
  const allowUndefined = options.allowUndefined === true;
  const missing = keys.filter((key) =>
    allowUndefined ? !hasOwn(dependencies, key) : dependencies[key] === undefined,
  );
  if (missing.length === 0) {
    return dependencies;
  }
  throw new Error(
    `[bootstrap] ${scopeName} missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export default assertRequiredDependencies;
