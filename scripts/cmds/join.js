const fontMapping = {
    a: "𝖺", b: "𝖻", c: "𝖼", d: "𝖽", e: "𝖾", f: "𝖿", g: "𝗀", h: "𝗁", i: "𝗂", j: "𝗃", k: "𝗄", l: "𝗅", m: "𝗆",
    n: "𝗇", o: "𝗈", p: "𝗉", q: "𝗊", r: "𝗋", s: "𝗌", t: "𝗍", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓",
    A: "𝖠", B: "𝖡", C: "𝖢", D: "𝖣", E: "𝖤", F: "𝖥", G: "𝖦", H: "𝖧", I: "𝖨", J: "𝖩", K: "𝖪", L: "𝖫", M: "𝖬",
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", U: "𝖴", V: "𝖵", W: "𝖶", X: "𝖷", Y: "𝖸", Z: "𝖹"
};

function applyFont(text) {
    return text.split('').map(char => fontMapping[char] || char).join('');
}

function createBox(content) {
    const lines = content.split('\n');
    let result = `╭─⌾⋅ ${applyFont("𝐿𝐴𝑅𝑂𝑈𝑋𝐾𝐼 𝑆𝑇𝐴𝑅𝑇 𝐵𝑂𝑇")} ⌾──╮\n│\n`;
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        result += `│   ${applyFont(line)}\n│\n`;
    }
    
    result += `╰─────⌾⋅  ⋅⌾─────╯`;
    return result;
}

module.exports = {
  config: {
    name: "j",
    version: "1.0",
    author: "voldigo anos",
    role: 0,
    shortDescription: applyFont("Rejoindre un groupe avec le bot"),
    longDescription: createBox(applyFont("Permet à l'admin de rejoindre un groupe\nvia son ID de conversation")),
    category: "admin",
    guide: createBox(applyFont("Utilisation:\n{pn} <ID du groupe>"))
  },

  onStart: async function ({ args, message, event, api }) {
    const adminUID = "61551757747742";
    const senderUID = event.senderID;

    if (senderUID !== adminUID) {
      return message.reply(createBox(applyFont("❌ Accès refusé\nSeul l'admin peut utiliser\ncette commande")));
    }

    const threadID = args[0];
    if (!threadID || isNaN(threadID)) {
      return message.reply(createBox(applyFont("⚠ ID de groupe invalide\nFournis un ID numérique valide")));
    }

    try {
      await api.addUserToGroup(senderUID, threadID);
      message.reply(createBox(applyFont(`✅ Ajout réussi\nTu as été ajouté au groupe\nID: ${threadID}`)));
    } catch (error) {
      console.error(error);
      message.reply(createBox(applyFont("❌ Échec de l'ajout\nVérifie que le bot est\ndans le groupe et a les permissions")));
    }
  }
};
