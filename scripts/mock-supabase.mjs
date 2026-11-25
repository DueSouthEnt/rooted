/**
 * A tiny Supabase stand-in for the browser check.
 * Email confirmation stays on: sign-up returns no session until /auth/callback exchanges the code.
 */
import { createServer } from "node:http";

const users = new Map();
const usersById = new Map();
const tokens = new Map();
const codes = new Map();

function json(res, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  });
  res.end(payload);
}

function userRecord(user, confirmed) {
  const now = new Date().toISOString();
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: confirmed ? now : null,
    phone: "",
    confirmed_at: confirmed ? now : null,
    last_sign_in_at: confirmed ? now : null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {
      display_name: user.displayName,
      enabled_sections: user.sections,
    },
    identities: [
      {
        identity_id: user.id,
        id: user.id,
        user_id: user.id,
        identity_data: { email: user.email, sub: user.id },
        provider: "email",
        last_sign_in_at: now,
        created_at: user.createdAt,
        updated_at: now,
      },
    ],
    created_at: user.createdAt,
    updated_at: now,
    is_anonymous: false,
  };
}

function sessionFor(user) {
  const access = jwt(user.id);
  const refresh = `refresh-${user.id}-${Date.now()}`;
  tokens.set(access, user.id);
  tokens.set(refresh, user.id);
  const record = userRecord(user, true);
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refresh,
    user: record,
  };
}

function jwt(sub) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub,
    role: "authenticated",
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
  })}.signature`;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function bearer(req) {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const id = tokens.get(token);
  return id ? usersById.get(id) : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "OPTIONS") return json(res, 204, {});
  const body = req.method === "GET" ? {} : await readBody(req);

  if (url.pathname === "/__test/inbox") {
    const email = url.searchParams.get("email");
    const user = [...users.values()].find((item) => item.email === email);
    return json(res, 200, { code: user?.code ?? null, confirmed: Boolean(user?.confirmed) });
  }

  if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    if (users.has(email)) {
      return json(res, 400, { error: "user_already_exists", msg: "User already registered", error_description: "User already registered" });
    }
    const id = crypto.randomUUID();
    const code = crypto.randomUUID();
    const sections = Array.isArray(body.data?.enabled_sections) ? body.data.enabled_sections : ["flowers"];
    const user = {
      id,
      email,
      password: String(body.password ?? ""),
      displayName: String(body.data?.display_name ?? email.split("@")[0]),
      sections,
      code,
      confirmed: false,
      createdAt: new Date().toISOString(),
    };
    users.set(email, user);
    usersById.set(id, user);
    codes.set(code, email);
    return json(res, 200, userRecord(user, false));
  }

  if (url.pathname === "/auth/v1/resend" && req.method === "POST") {
    const user = users.get(String(body.email ?? "").toLowerCase());
    if (user) {
      const code = crypto.randomUUID();
      user.code = code;
      codes.set(code, user.email);
    }
    return json(res, 200, {});
  }

  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const user = users.get(String(body.email ?? "").toLowerCase());
      if (!user || user.password !== body.password) {
        return json(res, 400, { error: "invalid_grant", msg: "Invalid login credentials", error_description: "Invalid login credentials" });
      }
      if (!user.confirmed) {
        return json(res, 400, { error: "email_not_confirmed", msg: "Email not confirmed", error_description: "Email not confirmed" });
      }
      return json(res, 200, sessionFor(user));
    }
    if (grant === "pkce") {
      const email = codes.get(String(body.auth_code ?? ""));
      const user = email ? users.get(email) : null;
      if (!user) return json(res, 400, { error: "invalid_grant", msg: "Invalid code", error_description: "Invalid code" });
      user.confirmed = true;
      return json(res, 200, sessionFor(user));
    }
    if (grant === "refresh_token") {
      const id = tokens.get(String(body.refresh_token ?? ""));
      const user = [...users.values()].find((item) => item.id === id);
      if (!user) return json(res, 400, { error: "invalid_grant", msg: "Invalid refresh", error_description: "Invalid refresh" });
      return json(res, 200, sessionFor(user));
    }
  }

  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const user = bearer(req);
    if (!user) return json(res, 401, { error: "invalid_token", msg: "Invalid token" });
    return json(res, 200, userRecord(user, user.confirmed));
  }

  if (url.pathname === "/auth/v1/logout") return json(res, 204, {});

  if (url.pathname === "/rest/v1/profiles") {
    const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
    const user = [...users.values()].find((item) => item.id === id) ?? bearer(req);
    if (req.method === "PATCH") {
      if (user && Array.isArray(body.enabled_sections)) user.sections = body.enabled_sections;
      return json(res, 200, []);
    }
    if (!user) {
      return json(res, 406, { code: "PGRST116", message: "No rows" });
    }
    const row = { id: user.id, display_name: user.displayName, units: "metric", enabled_sections: user.sections };
    const accept = req.headers.accept ?? "";
    if (accept.includes("object+json")) return json(res, 200, row);
    return json(res, 200, [row]);
  }

  if (url.pathname === "/rest/v1/farms") return json(res, 200, []);
  if (url.pathname.startsWith("/rest/v1/")) return json(res, 200, []);

  console.log("unhandled", req.method, url.pathname);
  return json(res, 404, { error: "not_found", path: url.pathname });
});

const port = Number(process.env.MOCK_PORT ?? 5499);
server.listen(port, "127.0.0.1", () => {
  console.log(`mock supabase on ${port}`);
});
