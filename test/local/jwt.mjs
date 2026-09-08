// Mint an HS256 JWT for the local PostgREST (role claim switches roles).
import { createHmac } from "node:crypto";
const secret = process.argv[2] ?? "m21-local-test-secret-m21-local-test-secret";
const role = process.argv[3] ?? "service_role";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64({ role, iss: "local", exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
console.log(`${head}.${body}.${sig}`);
