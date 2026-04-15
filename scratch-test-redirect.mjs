import { resolveDiscordRedirectUri, isAllowedOrigin, buildOriginConfig } from './server/lib/origin-config.js';

const config = buildOriginConfig({
  appOriginEnv: "https://dev.nekomata.moe,http://localhost:8080",
  adminOriginsEnv: "",
  discordRedirectUriEnv: "auto",
  isProduction: false,
  devPrimaryOriginFallback: "http://127.0.0.1:5173",
});

const req = {
  headers: {
    host: "dev.nekomata.moe"
  },
  protocol: "http",
};

const redirect = resolveDiscordRedirectUri({
  req,
  configuredDiscordRedirectUri: config.configuredDiscordRedirectUri,
  primaryAppOrigin: config.primaryAppOrigin,
  isAllowedOriginFn: (origin) => isAllowedOrigin({ origin, allowedOrigins: config.allowedOrigins, isProduction: false }),
});

console.log("Redirect URI:", redirect);
