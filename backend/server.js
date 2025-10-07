const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const locationRoutes = require("./routes/locationRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const { initDB } = require("./db/database");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
initDB();

const app = express();
app.use(
  cors({
    origin: "http://localhost:5172", // Adjust as needed for your frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
