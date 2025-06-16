const fs = require("fs-extra");
const moment = require("moment-timezone");
const { utils } = global;

module.exports = {
  config: {
    name: "prefix",
    version: "2.3",
    author: "Blẳȼk",
    countDown: 5,
    role: 0,
    shortDescription: "Affiche et modifie le préfixe",
    longDescription: "Affiche les préfixes système et du groupe ou les modifie",
    category: "config",
    guide: {
      en:
        "   {pn} <new prefix>: change prefix in your group\n" +
        "   {pn} <new prefix> -g: change system prefix (admin only)\n" +
        "   {pn} reset: reset group prefix to default\n" +
        "   Or simply type 'prefix' to view current ones"
    }
  },

  langs: {
    en: {
      reset: "✅ Your group prefix has been reset to default: %1",
      onlyAdmin: "❌ Only the bot admin can change the system prefix.",
      confirmGlobal: "⚠ React to this message to confirm changing the system prefix.",
      confirmThisThread: "⚠ React to this message to confirm changing the prefix in this group.",
      successGlobal: "✅ System prefix changed to: %1",
      successThisThread: "✅ Group prefix changed to: %1"
    }
  },

  onStart: async function ({ message, role, args, commandName, event, threadsData, getLang }) {
    if (!args[0]) return message.SyntaxError();

    if (args[0] === "reset") {
      await threadsData.set(event.threadID, null, "data.prefix");
      return message.reply(getLang("reset", global.GoatBot.config.prefix));
    }

    const newPrefix = args[0];
    const formSet = {
      commandName,
      author: event.senderID,
      newPrefix,
      setGlobal: args[1] === "-g"
    };

    if (formSet.setGlobal && role < 2)
      return message.reply(getLang("onlyAdmin"));

    return message.reply(
      formSet.setGlobal ? getLang("confirmGlobal") : getLang("confirmThisThread"),
      (err, info) => {
        if (!err) {
          formSet.messageID = info.messageID;
          global.GoatBot.onReaction.set(info.messageID, formSet);
        }
      }
    );
  },

  onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
    const { author, newPrefix, setGlobal } = Reaction;
    if (event.userID !== author) return;

    if (setGlobal) {
      global.GoatBot.config.prefix = newPrefix;
      fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
      return message.reply(getLang("successGlobal", newPrefix));
    } else {
      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      return message.reply(getLang("successThisThread", newPrefix));
    }
  },

  onChat: async function ({ event, message, threadsData, usersData }) {
    if (!event.body || event.body.toLowerCase() !== "prefix") return;

    // ✅ Système : gérer tableau ou string
    const rawPrefix = global.GoatBot.config.prefix || "!";
    const systemPrefix = Array.isArray(rawPrefix) ? rawPrefix[0] : rawPrefix;

    const threadPrefix = await threadsData.get(event.threadID, "data.prefix") || systemPrefix;
    const name = await usersData.getName(event.senderID);
    const time = moment().tz("Africa/Abidjan").format("DD MMMM YYYY - hh:mmA");

    // ✅ Affichage kawaii et clair
    const content = `🎀︱${name}🐇

₊˚₊꒷︶⊹ [Mᴇɢᴀɴ•ʙᴏᴛ] ⊹︶꒷₊˚₊
━━━━━━━━ × ━━━━━━━━
𝙿𝚁𝙴𝙵𝙸𝚇: ♡⇆〔${systemPrefix}〕
ʙᴏx ᴄʜᴀᴛ:♡⇆〔${threadPrefix}〕 
𝙾𝚆𝙽𝙴𝚁: 🌺 ꗇ︱Blẳȼk 义
━━━━━━━━ × ━━━━━━━━
🌸⌇𝚃𝙸𝙼𝙴: ${time}⌇🌸
━━━━━━━━ × ━━━━━━━━`;

    return message.reply(content, (err, info) => {
      if (!err && info.messageID) {
        message.react("💖", info.messageID);
      }
    });
  }
};
