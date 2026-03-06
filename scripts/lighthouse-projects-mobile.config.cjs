module.exports = {
  extends: "lighthouse:default",
  settings: {
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 2,
      disabled: false,
    },
    throttlingMethod: "simulate",
    skipAudits: ["robots-txt"],
  },
};
