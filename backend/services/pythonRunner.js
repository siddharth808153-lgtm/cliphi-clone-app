const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PYTHON_PROJECT_DIR = process.env.PYTHON_PROJECT_DIR;
const PYTHON_BIN = process.env.PYTHON_BIN || "python";

/**
 * Runs `python main.py <videoUrl> --mode local --num-clips N --output-json <tmpfile>`
 * inside the AI-Youtube-Shorts-Generator project, then reads and returns the
 * resulting JSON (transcript + highlights + shorts with local clip paths).
 */
function runPipeline(videoUrl, numClips, onProgress) {
  let proc = null;
  const promise = new Promise((resolve, reject) => {
    if (!PYTHON_PROJECT_DIR) {
      return reject(
        new Error(
          "PYTHON_PROJECT_DIR is not set. Point it at your cloned AI-Youtube-Shorts-Generator folder in backend/.env"
        )
      );
    }

    const outputJsonPath = path.join(
      os.tmpdir(),
      `shorts_result_${Date.now()}.json`
    );

    const args = [
      "main.py",
      videoUrl,
      "--mode",
      "local",
      "--num-clips",
      String(numClips),
      "--output-json",
      outputJsonPath,
    ];

    proc = spawn(PYTHON_BIN, args, {
      cwd: PYTHON_PROJECT_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        MKL_NUM_THREADS: "1",
        OMP_NUM_THREADS: "1",
        OPENBLAS_NUM_THREADS: "1",
        VECLIB_MAXIMUM_THREADS: "1",
        NUMEXPR_NUM_THREADS: "1",
      },
    });

    let lineBuf = "";

    proc.stdout.on("data", (d) => {
      lineBuf += d.toString();
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          process.stdout.write(`[python] ${trimmed}\n`);
          if (onProgress) onProgress(trimmed);
        }
      }
    });

    proc.stderr.on("data", (d) => {
      const line = d.toString();
      stderrBuf += line;
      process.stderr.write(`[python] ${line}`);
      if (onProgress) onProgress(line);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        // Extract cleanest error line if possible
        const lines = stderrBuf.trim().split("\n").map(l => l.trim()).filter(Boolean);
        const errLine = lines.find(l => l.startsWith("ERROR:") || l.startsWith("FAILED:")) || lines[lines.length - 1] || `Exit code ${code}`;
        return reject(
          new Error(errLine)
        );
      }
      if (!fs.existsSync(outputJsonPath)) {
        return reject(
          new Error("Pipeline finished but produced no output JSON.")
        );
      }
      try {
        const raw = fs.readFileSync(outputJsonPath, "utf-8");
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error(`Failed to parse pipeline output: ${e.message}`));
      } finally {
        fs.unlink(outputJsonPath, () => {});
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start python process: ${err.message}`));
    });
  });

  promise.getProc = () => proc;
  return promise;
}

module.exports = { runPipeline };
