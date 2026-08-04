const path = require("path");

function getVideoConfig() {
  return {
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    fps: 30,
    preset: "fast",
    format: "mp4",
  };
}

module.exports = { getVideoConfig };
