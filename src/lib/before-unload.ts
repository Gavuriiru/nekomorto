export const applyBeforeUnloadCompatibility = (event: BeforeUnloadEvent): void => {
  // Preserve the prompt behavior in browsers that still require returnValue.
  event.preventDefault();
  Reflect.set(event, "returnValue", "");
};
