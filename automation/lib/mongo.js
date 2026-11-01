// Connects with MONGO_URI and reuses the backend's Mongoose models.
// The models are CommonJS and register on backend/node_modules/mongoose, so we load
// mongoose through the same resolver to make sure both use one instance.
import { createRequire } from "node:module";

const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));

let mongoose;
try {
  mongoose = backendRequire("mongoose");
} catch {
  throw new Error("backend dependencies missing: run `npm install` (or `npm ci`) inside backend/ first");
}

export const Job = backendRequire("./models/Job");
export const Quiz = backendRequire("./models/Quiz");
export const News = backendRequire("./models/News");
export const User = backendRequire("./models/User");

export async function connect() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set");
  if (mongoose.connection.readyState >= 1) return mongoose;
  await mongoose.connect(process.env.MONGO_URI);
  return mongoose;
}

export const disconnect = () => mongoose.disconnect();

// Synced items need an owner because postedBy/createdBy are required.
export async function getAutomationUserId() {
  const email = process.env.AUTOMATION_USER_EMAIL;
  const user = email
    ? await User.findOne({ email: email.toLowerCase() })
    : await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
  if (!user) {
    throw new Error(
      email
        ? `AUTOMATION_USER_EMAIL ${email} not found`
        : "No admin user found. Run `npm run seed` in backend/ or set AUTOMATION_USER_EMAIL."
    );
  }
  return user._id;
}
