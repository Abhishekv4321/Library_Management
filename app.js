const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// MySQL connection
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "abhi0000",   // <<< yaha agar tumhara MySQL password hai to daalo
  database: "library_db"
});

// TEST connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ MySQL Error:", err);
  } else {
    console.log("✅ Connected to MySQL Database!");
    connection.release();
  }
});

// Simple API test
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working!" });
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
