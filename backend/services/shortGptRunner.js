const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const SHORTGPT_DIR = path.join(__dirname, "..", "..", "ShortGPT");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";

/**
 * Spawns `python faceless_cli.py --topic TOPIC --niche NICHE --voice VOICE --output-json OUT_JSON`
 * inside the ShortGPT folder and streams real-time stdout/stderr progress logs.
 */
function runFacelessPipeline({ topic, niche = "Facts", voice = "en-US-ChristopherNeural" }, onProgress) {
  let proc = null;
  const promise = new Promise((resolve, reject) => {
    if (!fs.existsSync(SHORTGPT_DIR)) {
      return reject(new Error("ShortGPT directory is missing. Please ensure ShortGPT folder exists in project root."));
    }

    const outputJsonPath = path.join(
      os.tmpdir(),
      `faceless_result_${Date.now()}.json`
    );

    const args = [
      "faceless_cli.py",
      "--topic",
      topic,
      "--niche",
      niche,
      "--voice",
      voice,
      "--output-json",
      outputJsonPath,
    ];

    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const userSitePackages = path.join(appData, "Python", "Python314", "site-packages");

    const existingPythonPath = process.env.PYTHONPATH || "";
    const pythonPath = existingPythonPath
      ? `${userSitePackages};${existingPythonPath}`
      : userSitePackages;

    proc = spawn(PYTHON_BIN, args, {
      cwd: SHORTGPT_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PYTHONPATH: pythonPath,
      },
    });

    let lineBuf = "";
    let stderrBuf = "";

    proc.stdout.on("data", (d) => {
      lineBuf += d.toString();
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          process.stdout.write(`[shortgpt] ${trimmed}\n`);
          if (onProgress) onProgress(trimmed);
        }
      }
    });

    proc.stderr.on("data", (d) => {
      const line = d.toString();
      stderrBuf += line;
      process.stderr.write(`[shortgpt-err] ${line}`);
      if (onProgress) onProgress(line);
    });

    proc.on("close", (code) => {
      if (fs.existsSync(outputJsonPath)) {
        try {
          const raw = fs.readFileSync(outputJsonPath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed.status === "error") {
            return reject(new Error(parsed.error || "Generation error"));
          }
          return resolve(parsed);
        } catch (e) {
          return reject(new Error(`Failed to parse faceless generator output: ${e.message}`));
        } finally {
          fs.unlink(outputJsonPath, () => {});
        }
      }

      if (code !== 0) {
        const lines = stderrBuf.trim().split("\n").map((l) => l.trim()).filter(Boolean);
        const errLine = lines.find((l) => l.startsWith("ERROR:") || l.startsWith("FAILED:")) || lines[lines.length - 1] || `Process exited with code ${code}`;
        return reject(new Error(`Faceless engine error: ${errLine}`));
      }

      return reject(new Error("Faceless generator finished but produced no JSON output file."));
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start ShortGPT python runner: ${err.message}`));
    });
  });

  promise.getProc = () => proc;
  return promise;
}

module.exports = { runFacelessPipeline };
