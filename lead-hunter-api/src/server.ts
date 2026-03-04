import cors from "cors";
import "dotenv/config";
import express from "express";
import * as http from "node:http";
import authRoutes from "./routes/auth.routes";
import leadRoutes from "./routes/lead.routes";
import configRoutes from "./routes/config.routes";
import scrapeRoutes from "./routes/scrape.routes";
import userRoutes from "./routes/user.routes";
import { socketService } from "./services/socket.service";

const app = express();

// Wrap Express app with HTTP server to support WebSockets
const server = http.createServer(app);
socketService.init(server);

const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*", // Allow all origins in development, restrict in production
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/queries", configRoutes);
app.use("/api/scrape", scrapeRoutes);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
