const AVAILABLE_VOICES = {
  hindi_male: "hi-IN-MadhurNeural",
  hindi_female: "hi-IN-SwaraNeural",
  english_male: "en-US-ChristopherNeural",
  english_female: "en-US-JennyNeural",
};

function getVoice(key) {
  return AVAILABLE_VOICES[key] || AVAILABLE_VOICES.english_male;
}

module.exports = { AVAILABLE_VOICES, getVoice };
