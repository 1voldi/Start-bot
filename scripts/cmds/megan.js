const axios = require('axios');  
const PREFIXES = ['larouxki', '/larouxki', '-larouxki'];  
const conversationHistory = {};  
const userMemory = {};  
const meganStatus = {}; // {threadID: true/false}  
  
const baseApiUrl = async () => {  
  const base = await axios.get('https://raw.githubusercontent.com/Blankid018/D1PT0/main/baseApiUrl.json');  
  return base.data.api;  
};  
  
module.exports = {  
  config: {  
    name: 'Larouxki',  
    version: '3.0.1',  
    role: 0,  
    category: 'AI',  
    author: 'Blẳȼk',  
    shortDescription: 'IA intelligente et personnalisée',  
    longDescription: 'Larouxki est une IA féminine, attentive, polie et capable de retenir ce que vous lui dites.',  
    guide: {  
      fr: '{pn} on | off : Active ou désactive Megan dans le groupe.\n{pn} prénom = <ton prénom> : Enregistre ton prénom pour des réponses personnalisées.'  
    }  
  },  
  
  onStart: async function () {},  
  
  onChat: async function ({ message, event, args, api }) {  
    const { threadID, senderID, body } = event;  
    const lowerBody = body?.toLowerCase().trim() || '';  
  
    // Initialiser l'état par défaut à "off"    
    if (!(threadID in meganStatus)) meganStatus[threadID] = false;    
  
    // Gestion des commandes on/off    
    if (['megan on', '/megan on', '-megan on'].includes(lowerBody)) {    
      meganStatus[threadID] = true;    
      return message.reply("Conversation démarrée avec Larouxki, vous pouvez discuter avec votre assistante maintenant ! 💕");    
    }    
  
    if (['megan off', '/megan off', '-megan off'].includes(lowerBody)) {    
      meganStatus[threadID] = false;    
      return message.reply("Très bien, à une prochaine fois. N’hésite pas à revenir échanger avec moi 🫂.");    
    }    
  
    // Si larouxki est désactivée, ne rien faire    
    if (!meganStatus[threadID]) return;    
  
    // Détection prénom personnalisé    
    const nameMatch = lowerBody.match(/(?:je m'appelle|mon prénom est|prénom[ :]?=)\s*(\w+)/i);    
    if (nameMatch) {    
      const name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);    
      userMemory[senderID] = userMemory[senderID] || {};    
      userMemory[senderID].name = name;    
      return message.reply(`Enchantée ${name}, je m’en souviendrai 🌸`);    
    }    
  
    const name = userMemory[senderID]?.name || '';    
  
    const quickReplies = [    
      { patterns: [/^salut( megan)?[\s!]*$/i], reply: () => `Salut ${name || 'à toi'} ! 👋🏻` },    
      { patterns: [/^(ça va|cv|comment ça va)( megan)?[\s\?]*$/i], reply: () => `Je vais bien, merci. Et toi ${name} ?` },    
      { patterns: [/^tu fais quoi( megan)?[\s\?]*$/i], reply: () => "J’observe et je réponds aux messages. Tu veux parler de quelque chose ?" },    
      { patterns: [/^je t’aime( megan)?[\s\!]*$/i], reply: () => "C’est touchant. Je suis ici pour toi, toujours à ton service 💕" },    
      { patterns: [/^je suis triste( megan)?[\s\!]*$/i], reply: () => "Tu veux en parler ? Je suis là pour écouter, même si je suis une IA. Ça va aller, je suis là." },    
      { patterns: [/^bonne nuit( megan)?[\s\!]*$/i], reply: () => "Bonne nuit 🌙. Fais de beaux rêves, prends soin de toi." }    
    ];    
  
    for (const entry of quickReplies) {    
      if (entry.patterns.some(p => p.test(lowerBody))) {    
        return message.reply(entry.reply());    
      }    
    }    
  
    // Analyse des messages classiques ou mention directe    
    let prompt = null;    
    if (event.messageReply && event.messageReply.senderID === (await api.getCurrentUserID?.())) {    
      prompt = body.trim();    
    } else {    
      const prefix = PREFIXES.find(p => lowerBody.startsWith(p));    
      if (prefix) {    
        prompt = body.substring(prefix.length).trim();    
      } else if (event.mentions && Object.keys(event.mentions).includes(await api.getCurrentUserID?.())) {    
        prompt = body.replace(/<@!?[0-9]+>/g, '').trim();    
      }    
    }    
  
    if (!prompt) return;    
  
    // Ajout mémoire utilisateur    
    userMemory[senderID] = userMemory[senderID] || {};    
    const memoryString = Object.entries(userMemory[senderID])    
      .map(([key, val]) => `${key}: ${val}`)    
      .join(', ');    
  
    if (!conversationHistory[senderID]) {    
      conversationHistory[senderID] = [    
        "Tu es Larouxki, une IA féminine, intelligente, explicite, respectueuse, utile, et polie. Tu t'adaptes à ton interlocuteur. Tu es simple mais claire. Tu n'es ni amoureuse, ni flirteuse. Sois factuelle et concise."    
      ];    
    }    
  
    conversationHistory[senderID].push(`Utilisateur (${name || 'inconnu'}): ${prompt}`);    
  
    if (conversationHistory[senderID].length > 20) {    
      conversationHistory[senderID] = conversationHistory[senderID].slice(-20);    
    }    
  
    const finalPrompt = `Mémoire utilisateur: ${memoryString}\nHistorique:\n` +    
      conversationHistory[senderID].join('\n') + `\nMegan:`;    
  
    try {    
      const apiUrl = await baseApiUrl();    
      const res = await axios.get(`${apiUrl}/gemini?prompt=${encodeURIComponent(finalPrompt)}`);    
      const reply = res.data.dipto || "Je n’ai pas compris. Peux-tu reformuler ?";    
      conversationHistory[senderID].push(`Megan: ${reply}`);    
      await message.reply(reply);    
    } catch (err) {    
      console.error("Erreur Megan:", err.message);    
      await message.reply("Je rencontre un souci technique.");    
    }  
  
  }  
};
