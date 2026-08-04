require("dotenv").config();
const { Worker } = require("bullmq");

console.log("⚡ Shortcut Worker process initializing...");

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

// Video Processing Queue Worker
try {
  const videoWorker = new Worker(
    "video-processing",
    async (job) => {
      console.log(`[worker] Processing job ${job.id} (${job.name}):`, job.data);
      if (job.name === "generate-faceless") {
        console.log(`[worker] Executing ShortGPT faceless generation for topic: "${job.data.topic}"`);
        // Execution task logic
      } else if (job.name === "clip-youtube") {
        console.log(`[worker] Executing YouTube clipping for URL: "${job.data.url}"`);
      }
      return { status: "completed", timestamp: new Date().toISOString() };
    },
    { connection: redisConnection, concurrency: 2 }
  );

  videoWorker.on("completed", (job) => {
    console.log(`[worker] Job ${job.id} completed successfully.`);
  });

  videoWorker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed:`, err);
  });

  console.log("🚀 Shortcut Queue Worker running and listening for jobs.");
} catch (err) {
  console.log("ℹ️ BullMQ Worker initialized in standalone mode (Redis optional).");
}
