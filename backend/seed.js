// Seed script to create a default admin user.
// Run: node seed.js

const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("⚠️  Admin already exists:", existingAdmin.email);
      process.exit(0);
    }

    const admin = await User.create({
      name: "Admin",
      email: "admin@beyondtheoffer.com",
      password: "admin123",
      role: "admin",
    });

    console.log("✅ Admin created successfully!");
    console.log("   Email:", admin.email);
    console.log("   Password: admin123");
    console.log("   ⚠️  Change this password after first login!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error.message);
    process.exit(1);
  }
};

seedAdmin();
