const fs = require("fs");
const winsFile = __dirname + "/snake_wins.json";

const snakeGames = {};
let winData = {};

if (fs.existsSync(winsFile)) {
    try {
        winData = JSON.parse(fs.readFileSync(winsFile, "utf8"));
    } catch (e) {
        winData = {};
    }
}

const COLORS = {
    "🟢🟩": { head: "🟢", body: "🟩" },
    "🔵🟦": { head: "🔵", body: "🟦" },
    "🔴🟥": { head: "🔴", body: "🟥" },
    "🟠🟧": { head: "🟠", body: "🟧" },
    "🟡🟨": { head: "🟡", body: "🟨" },
    "🟣🟪": { head: "🟣", body: "🟪" },
    "🟤🟫": { head: "🟤", body: "🟫" },
    "🌈": { head: "🌈", body: "✨" } // Nouvelle couleur spéciale
};

const SPECIAL_ITEMS = {
    "🍎": { type: "normal", points: 1 },
    "🥇": { type: "gold", points: 2, lifetime: 5 },
    "💣": { type: "bomb", effect: "shrink" },
    "⚡": { type: "speed", effect: "double_move", duration: 3 }
};

module.exports = {
    config: {
        name: "snake",
        version: "2.0",
        author: "Blẳȼk",
        description: "Jeu Snake multijoueur avec effets spéciaux et commandes améliorées",
        category: "game",
        usage: "<@joueur2 | ID | IA>",
        cooldown: 5
    },

    onStart: async function ({ message, event, args, usersData }) {
        const player1 = event.senderID;
        let player2 = null;

        if (Object.keys(event.mentions).length > 0) {
            player2 = Object.keys(event.mentions)[0];
        } else if (args[0]) {
            if (args[0].toLowerCase() === "ia") player2 = "IA";
            else player2 = args[0].replace(/[^0-9]/g, "");
        }

        if (!player2) return message.reply("❗ Mentionnez un joueur ou tapez IA pour jouer contre l'intelligence artificielle.");
        if (player1 === player2) return message.reply("❌ Vous ne pouvez pas jouer contre vous-même.");

        const id = `${player1}_${player2}`;
        if (snakeGames[id]) return message.reply("⚠ Une partie est déjà en cours entre vous deux.");

        // Démarre la sélection des couleurs
        snakeGames[id] = {
            state: "choosingColors",
            players: [player1, player2],
            colorChoice: {},
            message
        };

        let prompt = "🎨 Choisissez chacun une couleur parmi celles-ci :\n\n";
        prompt += Object.keys(COLORS).join("  ") + "\n\n";
        prompt += "Répondez simplement par la couleur (ex: 🟢🟩) pour choisir votre serpent.\n";
        prompt += "Vous pouvez aussi taper 'stop' à tout moment pour quitter la partie.\n";
        prompt += `${player2 === "IA" ? "Toi" : "Les deux joueurs"}, choisis(sez) votre couleur.`;

        message.reply(prompt);
    },

    onChat: async function ({ event, message, usersData }) {
        const userId = event.senderID;
        const input = event.body.trim();
        const id = Object.keys(snakeGames).find(key => key.includes(userId));
        if (!id) return;

        const game = snakeGames[id];

        // Gestion de la commande stop
        if (input.toLowerCase() === "stop") {
            if (game.state === "choosingColors") {
                message.reply("🚫 Partie annulée.");
                delete snakeGames[id];
                return;
            }

            const quitter = userId;
            const gagnant = game.players.find(p => p !== quitter) || game.players[0];
            
            winData[gagnant] = (winData[gagnant] || 0) + 1;
            fs.writeFileSync(winsFile, JSON.stringify(winData, null, 2));

            Promise.all([
                usersData.getName(quitter),
                gagnant === "IA" ? "IA" : usersData.getName(gagnant)
            ]).then(([quitterName, gagnantName]) => {
                message.reply(`🚫 ${quitterName} a quitté la partie ! ${gagnantName} gagne par forfait !`);
                delete snakeGames[id];
            });
            return;
        }

        if (game.state === "choosingColors") {
            if (!Object.keys(COLORS).includes(input)) return;
            if (Object.values(game.colorChoice).includes(input)) return message.reply("❗ Cette couleur a déjà été choisie. Choisis une autre.");

            const player1 = game.players[0];
            const player2 = game.players[1];

            game.colorChoice[userId] = input;

            if (player2 === "IA") {
                game.colorChoice["IA"] = "🔵🟦";
                if (game.colorChoice[player1]) {
                    startGame(id, message, usersData);
                }
            } else {
                if (game.colorChoice[player1] && game.colorChoice[player2]) {
                    startGame(id, message, usersData);
                }
            }
        } else {
            handleGameMove(id, event, message, usersData);
        }
    }
};

function startGame(id, message, usersData) {
    const game = snakeGames[id];
    game.state = "playing";

    const [player1, player2] = game.players;
    const grid = Array(8).fill(null).map(() => Array(8).fill("⬛"));
    const snake1 = [{ x: 0, y: 1 }];
    const snake2 = [{ x: 7, y: 6 }];
    const apple = spawnApple(grid, [...snake1, ...snake2]);

    const color1 = COLORS[game.colorChoice[player1]];
    const color2 = player2 === "IA" ? COLORS["🔵🟦"] : COLORS[game.colorChoice[player2]];

    grid[1][0] = color1.head;
    grid[6][7] = color2.head;
    grid[apple.y][apple.x] = "🍎";

    // Initialisation des effets spéciaux
    game.specialItems = {
        goldApple: null,
        bomb: null,
        speedBoost: null
    };

    Object.assign(game, {
        grid,
        snakes: { [player1]: snake1, [player2]: snake2 },
        apple,
        turn: player2,
        scores: { [player1]: 0, [player2]: 0 },
        colors: { [player1]: color1, [player2]: color2 },
        effects: {},
        itemTimers: {}
    });

    Promise.all([
        usersData.getName(player1),
        player2 === "IA" ? "IA" : usersData.getName(player2)
    ]).then(([name1, name2]) => {
        message.reply(renderGrid(grid, game.scores, name1, name2, name2));
        if (player2 === "IA") aiPlay(id, message, usersData);
    });
}

function handleGameMove(id, event, message, usersData) {
    const game = snakeGames[id];
    const direction = event.body.toLowerCase();
    const directions = {
        haut: { x: 0, y: -1 },
        bas: { x: 0, y: 1 },
        gauche: { x: -1, y: 0 },
        droite: { x: 1, y: 0 }
    };

    // Vérifie si c'est une commande spéciale
    if (!directions[direction]) return;

    if (event.senderID !== game.turn) {
        return usersData.getName(event.senderID).then(name => message.reply(`❌ ${name}, ce n'est pas ton tour !`));
    }

    // Gestion des effets spéciaux
    const player = event.senderID;
    const opponent = game.players.find(p => p !== player);
    
    // Appliquer l'effet de vitesse si actif
    if (game.effects[player] === "speed" && game.itemTimers[player] > 0) {
        game.itemTimers[player]--;
        if (game.itemTimers[player] <= 0) {
            delete game.effects[player];
            delete game.itemTimers[player];
        }
    }

    const delta = directions[direction];
    const snake = game.snakes[player];
    const head = snake[0];
    const newHead = { x: head.x + delta.x, y: head.y + delta.y };

    // Vérification des collisions
    const isCollision = (
        newHead.x < 0 || newHead.y < 0 ||
        newHead.x > 7 || newHead.y > 7 ||
        game.snakes[player].some(p => p.x === newHead.x && p.y === newHead.y) ||
        game.snakes[opponent].some(p => p.x === newHead.x && p.y === newHead.y)
    );

    if (isCollision) {
        Promise.all([
            usersData.getName(player),
            opponent === "IA" ? "IA" : usersData.getName(opponent)
        ]).then(([loser, winner]) => {
            winData[opponent] = (winData[opponent] || 0) + 1;
            fs.writeFileSync(winsFile, JSON.stringify(winData, null, 2));

            message.reply(`💥 ${loser} s'est écrasé ! ${winner} gagne !\n\n${renderGrid(game.grid, game.scores, loser, winner)}`);
            delete snakeGames[id];
        });
        return;
    }

    // Vérification de la victoire (10 points)
    if (game.scores[player] >= 9) {
        game.scores[player]++;
        const winner = player;
        const loser = opponent;
        
        Promise.all([
            usersData.getName(winner),
            loser === "IA" ? "IA" : usersData.getName(loser)
        ]).then(([winnerName, loserName]) => {
            winData[winner] = (winData[winner] || 0) + 1;
            fs.writeFileSync(winsFile, JSON.stringify(winData, null, 2));
            
            message.reply(`🎉 ${winnerName} a atteint 10 pommes en premier et remporte la partie !\n\nScore final: ${winnerName} ${game.scores[winner]} - ${loserName} ${game.scores[loser]}`);
            delete snakeGames[id];
        });
        return;
    }

    // Gestion des objets spéciaux
    let specialEffect = null;
    let pointsEarned = 0;

    // Vérifier la pomme d'or
    if (game.specialItems.goldApple && 
        newHead.x === game.specialItems.goldApple.x && 
        newHead.y === game.specialItems.goldApple.y) {
        pointsEarned += 2;
        game.specialItems.goldApple = null;
        specialEffect = "🥇 +2 points!";
    }

    // Vérifier la bombe
    if (game.specialItems.bomb && 
        newHead.x === game.specialItems.bomb.x && 
        newHead.y === game.specialItems.bomb.y) {
        game.scores[player] = Math.max(0, game.scores[player] - 1);
        if (snake.length > 1) snake.pop();
        game.specialItems.bomb = null;
        specialEffect = "💣 Bombe! -1 point";
    }

    // Vérifier le boost de vitesse
    if (game.specialItems.speedBoost && 
        newHead.x === game.specialItems.speedBoost.x && 
        newHead.y === game.specialItems.speedBoost.y) {
        game.effects[player] = "speed";
        game.itemTimers[player] = 3;
        game.specialItems.speedBoost = null;
        specialEffect = "⚡ Vitesse x2 pendant 3 tours!";
    }

    // Vérifier la pomme normale
    const ateApple = newHead.x === game.apple.x && newHead.y === game.apple.y;
    if (ateApple) {
        pointsEarned += 1;
        game.apple = spawnApple(game.grid, getOccupiedCells(game));
        spawnSpecialItems(game);
    }

    // Mise à jour du score et du serpent
    game.scores[player] += pointsEarned;
    snake.unshift(newHead);
    if (!ateApple && !specialEffect) snake.pop();

    // Mise à jour des effets spéciaux
    updateSpecialItems(game);

    // Mise à jour de la grille
    updateGameGrid(game);

    // Déterminer le prochain joueur
    if (game.effects[player] === "speed" && game.itemTimers[player] > 0) {
        game.turn = player; // Rejoue si effet vitesse
    } else {
        game.turn = opponent;
    }

    // Préparer le message avec effets spéciaux
    Promise.all([
        usersData.getName(game.players[0]),
        game.players[1] === "IA" ? "IA" : usersData.getName(game.players[1]),
        game.turn === "IA" ? "IA" : usersData.getName(game.turn)
    ]).then(([name1, name2, next]) => {
        let reply = renderGrid(game.grid, game.scores, name1, name2, next);
        if (specialEffect) reply += `\n\n🌟 ${specialEffect}`;
        message.reply(reply);
        if (game.turn === "IA") aiPlay(id, message, usersData);
    });
}

function spawnSpecialItems(game) {
    // 25% de chance de faire apparaître un item spécial
    if (Math.random() < 0.25) {
        const items = ["🥇", "💣", "⚡"];
        const itemType = items[Math.floor(Math.random() * items.length)];
        
        if (itemType === "🥇" && !game.specialItems.goldApple) {
            game.specialItems.goldApple = spawnApple(game.grid, getOccupiedCells(game));
            game.itemTimers.goldApple = 5;
        } 
        else if (itemType === "💣" && !game.specialItems.bomb) {
            game.specialItems.bomb = spawnApple(game.grid, getOccupiedCells(game));
        } 
        else if (itemType === "⚡" && !game.specialItems.speedBoost) {
            game.specialItems.speedBoost = spawnApple(game.grid, getOccupiedCells(game));
        }
    }
}

function updateSpecialItems(game) {
    // Mettre à jour le timer de la pomme d'or
    if (game.specialItems.goldApple && game.itemTimers.goldApple > 0) {
        game.itemTimers.goldApple--;
        if (game.itemTimers.goldApple <= 0) {
            game.specialItems.goldApple = null;
        }
    }
}

function getOccupiedCells(game) {
    const occupied = [];
    for (const player of game.players) {
        occupied.push(...game.snakes[player]);
    }
    occupied.push(game.apple);
    if (game.specialItems.goldApple) occupied.push(game.specialItems.goldApple);
    if (game.specialItems.bomb) occupied.push(game.specialItems.bomb);
    if (game.specialItems.speedBoost) occupied.push(game.specialItems.speedBoost);
    return occupied;
}

function updateGameGrid(game) {
    // Réinitialiser la grille
    game.grid = Array(8).fill(null).map(() => Array(8).fill("⬛"));

    // Dessiner les serpents
    for (const player of game.players) {
        const snake = game.snakes[player];
        for (let i = 0; i < snake.length; i++) {
            const part = snake[i];
            game.grid[part.y][part.x] = i === 0 
                ? game.colors[player].head 
                : game.colors[player].body;
        }
    }

    // Dessiner les objets
    game.grid[game.apple.y][game.apple.x] = "🍎";
    if (game.specialItems.goldApple) {
        game.grid[game.specialItems.goldApple.y][game.specialItems.goldApple.x] = "🥇";
    }
    if (game.specialItems.bomb) {
        game.grid[game.specialItems.bomb.y][game.specialItems.bomb.x] = "💣";
    }
    if (game.specialItems.speedBoost) {
        game.grid[game.specialItems.speedBoost.y][game.specialItems.speedBoost.x] = "⚡";
    }
}

function renderGrid(grid, scores, name1, name2, joueurActuel = "") {
    const top = "   A B C D E F G H\n";
    const middle = grid.map((row, i) => `${i + 1} ${row.join(" ")} ${i + 1}`).join("\n");
    const bottom = "   A B C D E F G H\n";
    const scoreLine = `Scores : ${name1} ${scores[Object.keys(scores)[0]]} - ${name2} ${scores[Object.keys(scores)[1]]}`;
    const prompt = joueurActuel ? `\n\n🎮 ${joueurActuel}, à toi ! (haut, bas, gauche, droite ou stop) :` : "";
    return `${top}${middle}\n${bottom}\n${scoreLine}${prompt}`;
}

function spawnApple(grid, occupied) {
    let x, y;
    do {
        x = Math.floor(Math.random() * 8);
        y = Math.floor(Math.random() * 8);
    } while (occupied.some(p => p.x === x && p.y === y));
    return { x, y };
}

function aiPlay(gameId, message, usersData) {
    const game = snakeGames[gameId];
    if (!game || game.turn !== "IA") return;

    setTimeout(() => {
        const directions = {
            haut: { x: 0, y: -1 },
            bas: { x: 0, y: 1 },
            gauche: { x: -1, y: 0 },
            droite: { x: 1, y: 0 }
        };

        const head = game.snakes["IA"][0];
        const goal = game.apple;
        const gridSize = 8;

        // Priorité aux objets spéciaux
        let target = goal;
        if (game.specialItems.goldApple) target = game.specialItems.goldApple;
        if (game.specialItems.speedBoost && game.itemTimers.IA === undefined) target = game.specialItems.speedBoost;

        const isBlocked = (x, y) => {
            if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return true;
            const occupied = [...game.snakes[game.players[0]], ...game.snakes["IA"]];
            return occupied.some(p => p.x === x && p.y === y);
        };

        const openSet = [{ x: head.x, y: head.y, path: [] }];
        const visited = new Set();
        const hash = (x, y) => `${x},${y}`;

        while (openSet.length) {
            const current = openSet.shift();
            if (current.x === target.x && current.y === target.y) {
                const dir = current.path[0];
                const fakeEvent = { senderID: "IA", body: dir };
                return module.exports.onChat({ event: fakeEvent, message, usersData });
            }

            visited.add(hash(current.x, current.y));
            for (const [dir, delta] of Object.entries(directions)) {
                const nx = current.x + delta.x;
                const ny = current.y + delta.y;
                if (visited.has(hash(nx, ny)) || isBlocked(nx, ny)) continue;
                openSet.push({ x: nx, y: ny, path: [...current.path, dir] });
            }
        }

        const safeMoves = Object.entries(directions).filter(([_, delta]) => {
            const nx = head.x + delta.x;
            const ny = head.y + delta.y;
            return !isBlocked(nx, ny);
        });

        const chosen = safeMoves[Math.floor(Math.random() * safeMoves.length)];
        const fakeEvent = { senderID: "IA", body: chosen ? chosen[0] : "haut" };
        module.exports.onChat({ event: fakeEvent, message, usersData });

    }, 1000);
        }
