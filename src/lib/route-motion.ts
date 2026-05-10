let isPopstate = false;

const onPopstate = () => {
  isPopstate = true;
  document.documentElement.classList.add("skip-route-motion");
};

const attach = () => {
  window.addEventListener("popstate", onPopstate);
};

const detach = () => {
  window.removeEventListener("popstate", onPopstate);
};

export const initRouteMotion = () => {
  attach();
  return detach;
};

export const consumePopstate = () => {
  const was = isPopstate;
  if (was) {
    isPopstate = false;
  }
  return was;
};

export const clearSkipRouteMotion = () => {
  document.documentElement.classList.remove("skip-route-motion");
};
