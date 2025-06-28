import express from "express";
import cors from "cors";
import apiRouter from "./routes";
import path from "path";
import { taskStatusService } from "./services/taskStatusService";
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.json());

// Mount all API v1 routes under /api/v1
app.use("/api/v1", apiRouter);

// app.get("/", (_, res) => {
//   res.send("TFD Manpower Allocation API running!");
// });


// Health check endpoint that includes task status service info
app.get("/health", (_, res) => {
  res.json({
    status: "OK",
  });
});

// Serve the frontend static files
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Fallback to index.html for SPA routes
app.get("/*splat", (_, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist", "index.html"));
});


// Start the task status service - check every 2 minutes for more responsiveness
taskStatusService.startScheduledUpdates(2);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  taskStatusService.stopScheduledUpdates();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  taskStatusService.stopScheduledUpdates();
  process.exit(0);
});


app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
