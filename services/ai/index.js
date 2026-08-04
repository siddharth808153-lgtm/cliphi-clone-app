require("dotenv").config();

async function generateScript({ topic, niche, language = "English" }) {
  console.log(`[service-ai] Generating script for topic: "${topic}" | niche: "${niche}" | lang: ${language}`);

  // Fallback intelligent script template
  if (language === "Hindi" || niche.includes("Hindi") || niche.includes("Cat")) {
    return {
      topic,
      niche,
      script: `एक बार की बात है, ${topic} में एक चालाक मोटा बिल्ला रहता था!\nवह रोज नए-नए कारनामे करता और सबको हंसाता था!\nअगर आपको यह मजेदार कहानी पसंद आई तो वीडियो को लाइक करें और सब्सक्राइब करें!`,
    };
  }

  return {
    topic,
    niche,
    script: `Did you know this about ${topic}?\nHere are three mind-blowing secrets you probably never heard of.\nFirst, ${topic} holds mysterious facts scientists are uncovering today.\nSubscribe for more daily shorts!`,
  };
}

module.exports = { generateScript };
