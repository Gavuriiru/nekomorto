export const createSystemAuditReqFactory = ({ createRequestId } = {}) => () => ({
  headers: {},
  ip: "127.0.0.1",
  session: {
    user: {
      id: "system",
      name: "System",
    },
  },
  requestId: `auto-reorg-${typeof createRequestId === "function" ? createRequestId() : "system"}`,
});

export default {
  createSystemAuditReqFactory,
};
