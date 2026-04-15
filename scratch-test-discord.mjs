import 'dotenv/config';

async function testDiscordCreds() {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    client_secret: process.env.DISCORD_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    code: "invalid_code_just_for_testing",
    redirect_uri: "https://dev.nekomata.moe/login",
  });

  console.log("Testing with client id:", process.env.DISCORD_CLIENT_ID);
  
  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  console.log("Discord response:", data);
}

testDiscordCreds();
