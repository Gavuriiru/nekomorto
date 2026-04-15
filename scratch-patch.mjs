import fs from 'fs';
import path from 'path';

export function injectLogIntoAuthRoutes() {
  const filePath = path.join(process.cwd(), 'server/lib/register-auth-routes.js');
  let content = fs.readFileSync(filePath, 'utf8');

  // Find the exact if (!tokenResponse.ok) block
  const target = `
      if (!tokenResponse.ok) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "token_exchange_failed" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "token_exchange_failed" });`;
        
  const replacement = `
      if (!tokenResponse.ok) {
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "token_exchange_failed" });
        let discordErrorText = 'unknown';
        try { discordErrorText = await tokenResponse.text(); } catch(e){}
        appendAuditLog(req, "auth.login.failed", "auth", { error: "token_exchange_failed", discordError: discordErrorText, redirectUri: redirectUri });`;

  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully injected log into register-auth-routes.js");
  } else {
    // try shorter
    const target2 = `
      if (!tokenResponse.ok) {
        try { const errBody = await tokenResponse.text(); console.error("Discord Token Exchange Failed Body:", errBody); } catch(e){}
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "token_exchange_failed" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "token_exchange_failed" });`;
    const rep2 = `
      if (!tokenResponse.ok) {
        let discordErrorText = 'unknown';
        try { discordErrorText = await tokenResponse.text(); console.error("Discord Token Exchange Failed Body:", discordErrorText); } catch(e){}
        metricsRegistry.inc("auth_login_total", { status: "failed" });
        handleAuthFailureSecuritySignals({ req, error: "token_exchange_failed" });
        appendAuditLog(req, "auth.login.failed", "auth", { error: "token_exchange_failed", discordError: discordErrorText, redirectUri: redirectUri });`;
    
    if (content.includes(target2)) {
      content = content.replace(target2, rep2);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log("Successfully injected log into register-auth-routes.js (from target2)");
    } else {
      console.log("Could not find target in register-auth-routes.js");
    }
  }
}

injectLogIntoAuthRoutes();
