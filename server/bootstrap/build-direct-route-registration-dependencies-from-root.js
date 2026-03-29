import { buildApiContractV1 } from "../lib/api-contract-v1.js";
import { buildDirectRouteRegistrationDependencies } from "./build-direct-route-registration-dependencies.js";

export const buildDirectRouteRegistrationDependenciesFromRoot = (dependencies = {}) =>
  buildDirectRouteRegistrationDependencies({
    app: dependencies.app,
    apiContractVersion: dependencies.apiContractVersion ?? dependencies.API_CONTRACT_VERSION,
    appendAuditLog: dependencies.appendAuditLog,
    buildApiContractV1Payload:
      dependencies.buildApiContractV1Payload ??
      (() =>
        buildApiContractV1({
          capabilities: {
            project_epub_import_async: dependencies.isEpubImportJobStorageAvailable?.() ?? false,
            project_manga_import_async:
              dependencies.isProjectImageImportJobStorageAvailable?.() ?? false,
          },
        })),
    buildAuthRedirectUrl: dependencies.buildAuthRedirectUrl,
    buildMySecuritySummary: dependencies.buildMySecuritySummary,
    buildRuntimeMetadata: dependencies.buildRuntimeMetadata,
    buildUserPayload: dependencies.buildUserPayload,
    canAttemptAuth: dependencies.canAttemptAuth,
    clearEnrollmentFromSession: dependencies.clearEnrollmentFromSession,
    createDiscordAvatarUrl: dependencies.createDiscordAvatarUrl,
    dataEncryptionKeyring: dependencies.dataEncryptionKeyring,
    deleteUserMfaTotpRecord: dependencies.deleteUserMfaTotpRecord,
    discordApi: dependencies.discordApi ?? dependencies.DISCORD_API,
    discordClientId: dependencies.discordClientId ?? dependencies.DISCORD_CLIENT_ID,
    discordClientSecret:
      dependencies.discordClientSecret ?? dependencies.DISCORD_CLIENT_SECRET,
    encryptStringWithKeyring: dependencies.encryptStringWithKeyring,
    ensureOwnerUser: dependencies.ensureOwnerUser,
    establishAuthenticatedSession: dependencies.establishAuthenticatedSession,
    evaluateOperationalMonitoring: dependencies.evaluateOperationalMonitoring,
    generateRecoveryCodes: dependencies.generateRecoveryCodes,
    getRequestIp: dependencies.getRequestIp,
    handleAuthFailureSecuritySignals: dependencies.handleAuthFailureSecuritySignals,
    handleMfaFailureSecuritySignals: dependencies.handleMfaFailureSecuritySignals,
    hashRecoveryCode: dependencies.hashRecoveryCode,
    isAllowedOrigin: dependencies.isAllowedOrigin,
    isMetricsEnabled: dependencies.isMetricsEnabled,
    isPlainObject: dependencies.isPlainObject,
    isTotpEnabledForUser: dependencies.isTotpEnabledForUser,
    listActiveSessionsForUser: dependencies.listActiveSessionsForUser,
    loadAllowedUsers: dependencies.loadAllowedUsers,
    loadSecurityEvents: dependencies.loadSecurityEvents,
    loadUserPreferences: dependencies.loadUserPreferences,
    loadUserSessionIndexRecords: dependencies.loadUserSessionIndexRecords,
    maybeEmitExcessiveSessionsEvent: dependencies.maybeEmitExcessiveSessionsEvent,
    maybeEmitNewNetworkLoginEvent: dependencies.maybeEmitNewNetworkLoginEvent,
    metricsRegistry: dependencies.metricsRegistry,
    metricsTokenNormalized:
      dependencies.metricsTokenNormalized ?? dependencies.METRICS_TOKEN_NORMALIZED,
    mfaRecoveryCodePepper:
      dependencies.mfaRecoveryCodePepper ?? dependencies.MFA_RECOVERY_CODE_PEPPER,
    normalizeUserPreferences: dependencies.normalizeUserPreferences,
    primaryAppOrigin: dependencies.primaryAppOrigin ?? dependencies.PRIMARY_APP_ORIGIN,
    proxyDiscordAvatarRequest: dependencies.proxyDiscordAvatarRequest,
    requireAuth: dependencies.requireAuth,
    resolveAuthAppOrigin: dependencies.resolveAuthAppOrigin,
    resolveDiscordRedirectUri: dependencies.resolveDiscordRedirectUri,
    resolveEnrollmentFromSession: dependencies.resolveEnrollmentFromSession,
    resolveMfaMetadata: dependencies.resolveMfaMetadata,
    revokeSessionBySid: dependencies.revokeSessionBySid,
    revokeUserSessionIndexRecord: dependencies.revokeUserSessionIndexRecord,
    saveSessionState: dependencies.saveSessionState,
    scopes: dependencies.scopes ?? dependencies.SCOPES,
    securityEventStatusOpen:
      dependencies.securityEventStatusOpen ?? dependencies.SecurityEventStatus?.OPEN,
    sessionCookieConfig: dependencies.sessionCookieConfig,
    sessionIndexTouchTsBySid: dependencies.sessionIndexTouchTsBySid,
    startTotpEnrollment: dependencies.startTotpEnrollment,
    syncPersistedDiscordAvatarForLogin: dependencies.syncPersistedDiscordAvatarForLogin,
    updateSessionIndexFromRequest: dependencies.updateSessionIndexFromRequest,
    userPreferencesMaxBytes:
      dependencies.userPreferencesMaxBytes ?? dependencies.USER_PREFERENCES_MAX_BYTES,
    verifyTotpCode: dependencies.verifyTotpCode,
    verifyTotpOrRecoveryCode: dependencies.verifyTotpOrRecoveryCode,
    writeUserMfaTotpRecord: dependencies.writeUserMfaTotpRecord,
    writeUserPreferences: dependencies.writeUserPreferences,
  });

export default buildDirectRouteRegistrationDependenciesFromRoot;
