const express = require("express");
const cors = require("cors");
const { checkSchema } = require('./db/postgresMigrations');
const { requestSecurity } = require('./middleware/requestSecurity');
const { createAuth } = require("./middleware/authMiddleware");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { wrap } = require("./lib/http");
const { createAuthController } = require("./controllers/authController");
const { createUserController } = require("./controllers/userController");
const {
  createEmployeeController,
} = require("./controllers/employeeController");
const {
  createLocationController,
} = require("./controllers/locationController");
const {
  createAttendanceController,
} = require("./controllers/attendanceController");
const { createGoogleIdentity } = require("./services/googleIdentity");
const { createAuthRoutes } = require("./routes/authRoutes");
const { createUserRoutes } = require("./routes/userRoutes");
const { createEmployeeRoutes } = require("./routes/employeeRoutes");
const { createLocationRoutes } = require("./routes/locationRoutes");
const { createAttendanceRoutes } = require("./routes/attendanceRoutes");

function createApp({
  store,
  config,
  now = () => new Date(),
  googleIdentity = createGoogleIdentity(config),
}) {
  const app = express();
  const auth = createAuth({ store, config, now });
  const dependencies = { store, config, now, auth, googleIdentity };
  const authController = createAuthController(dependencies);
  const userController = createUserController(dependencies);
  const employeeController = createEmployeeController(dependencies);
  const locationController = createLocationController(dependencies);
  const attendanceController = createAttendanceController(dependencies);

  app.set("env", config.production ? "production" : "development");
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: config.frontendUrl,
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    })
  );
  app.use(express.json());

  app.get(
    "/api/health",
    wrap(async (_req, res) => {
      await checkSchema(store);
      res.json({ status: "ok" });
    })
  );
  app.use("/api/auth", requestSecurity(config), createAuthRoutes({ auth, controller: authController }));
  app.use(
    "/api/users",
    createUserRoutes({ auth, controller: userController, employeeController })
  );
  app.use(
    "/api/employees",
    createEmployeeRoutes({ auth, controller: employeeController })
  );
  app.use(
    "/api/locations",
    createLocationRoutes({ auth, controller: locationController })
  );
  app.use(
    "/api/attendance",
    createAttendanceRoutes({ auth, controller: attendanceController })
  );

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
