// Главный файл приложения - управление экранами и навигацией

class App {
    constructor() {
        this.currentScreen = 'team';
        this.players = [];
        this.gameManager = null;
        
        // Инициализация DOM элементов
        this.initializeElements();
        this.setupEventListeners();
        this.renderGamesGrid();
        
        // Генерация начальных игроков
        this.generatePlayers(20);
    }
    
    initializeElements() {
        // Экраны
        this.teamScreen = document.getElementById('team-screen');
        this.gamesScreen = document.getElementById('games-screen');
        this.arenaScreen = document.getElementById('arena-screen');
        
        // Кнопки
        this.startGamesBtn = document.getElementById('start-games-btn');
        this.backToTeamBtn = document.getElementById('back-to-team-btn');
        this.stopRestartBtn = document.getElementById('stop-restart-btn');
        this.playAgainBtn = document.getElementById('play-again-btn');
        this.muteBtn = document.getElementById('mute-btn');
        
        // Элементы управления игроками
        this.playerCountInput = document.getElementById('player-count');
        this.decreaseBtn = document.getElementById('decrease-btn');
        this.increaseBtn = document.getElementById('increase-btn');
        this.playersList = document.getElementById('players-list');
        
        // Элементы игры
        this.canvas = document.getElementById('game-canvas');
        this.winnerModal = document.getElementById('winner-modal');
        this.winnerName = document.getElementById('winner-name');
        
        // Панель игроков на арене
        this.alivePlayersPanel = document.getElementById('alive-players');
        this.eliminatedPlayersPanel = document.getElementById('eliminated-players');
        
        // Таймер и индикатор эскалации
        this.timerElement = document.getElementById('timer');
        this.escalationIndicator = document.getElementById('escalation-indicator');
    }
    
    setupEventListeners() {
        // Управление количеством игроков
        this.playerCountInput.addEventListener('change', (e) => {
            const count = parseInt(e.target.value);
            if (count >= 2 && count <= 100) {
                this.generatePlayers(count);
            } else {
                e.target.value = Math.max(2, Math.min(100, count));
                this.generatePlayers(e.target.value);
            }
        });
        
        this.decreaseBtn.addEventListener('click', () => {
            let count = parseInt(this.playerCountInput.value);
            if (count > 2) {
                count--;
                this.playerCountInput.value = count;
                this.generatePlayers(count);
            }
        });
        
        this.increaseBtn.addEventListener('click', () => {
            let count = parseInt(this.playerCountInput.value);
            if (count < 100) {
                count++;
                this.playerCountInput.value = count;
                this.generatePlayers(count);
            }
        });
        
        // Переключение экранов
        this.startGamesBtn.addEventListener('click', () => {
            this.switchScreen('games');
        });
        
        this.backToTeamBtn.addEventListener('click', () => {
            this.switchScreen('team');
        });
        
        this.stopRestartBtn.addEventListener('click', () => {
            if (this.gameManager) {
                this.gameManager.destroy();
                this.gameManager = null;
                this.switchScreen('games');
            }
        });
        
        this.playAgainBtn.addEventListener('click', () => {
            this.winnerModal.classList.remove('active');
            this.switchScreen('games');
        });
        
        // Управление звуком
        this.muteBtn.addEventListener('click', () => {
            const isMuted = this.muteBtn.textContent === '🔇';
            this.muteBtn.textContent = isMuted ? '🔊' : '🔇';
        });
        
        // Обновление размера canvas при изменении размера окна
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    switchScreen(screenName) {
        // Скрыть все экраны
        this.teamScreen.classList.remove('active');
        this.gamesScreen.classList.remove('active');
        this.arenaScreen.classList.remove('active');
        
        // Показать нужный экран
        if (screenName === 'team') {
            this.teamScreen.classList.add('active');
        } else if (screenName === 'games') {
            this.gamesScreen.classList.add('active');
        } else if (screenName === 'arena') {
            this.arenaScreen.classList.add('active');
            this.resizeCanvas();
        }
        
        this.currentScreen = screenName;
    }
    
    generatePlayers(count) {
        this.players = generateRandomPlayers(count);
        this.renderPlayerCards();
    }
    
    renderPlayerCards() {
        this.playersList.innerHTML = '';
        
        this.players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            playerCard.innerHTML = `
                <div class="color-circle" style="background-color: ${player.color};">${player.name.charAt(0)}</div>
                <input type="text" class="player-name-input" value="${player.name}" data-index="${index}">
                <input type="color" class="color-picker" value="${player.color}" data-index="${index}">
            `;
            
            this.playersList.appendChild(playerCard);
        });
        
        // Добавляем обработчики для изменения данных игроков
        document.querySelectorAll('.player-name-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.players[index].name = e.target.value;
            });
        });
        
        document.querySelectorAll('.color-picker').forEach(picker => {
            picker.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.players[index].color = e.target.value;
                const colorCircle = e.target.parentElement.querySelector('.color-circle');
                colorCircle.style.backgroundColor = e.target.value;
            });
        });
    }
    
    renderGamesGrid() {
        const gamesGrid = document.getElementById('games-grid');
        gamesGrid.innerHTML = '';
        
        const games = [
            { game: IceSumoGame, id: 'ice-sumo' },
            { game: BulletStormGame, id: 'bullet-storm' },
            { game: CellularFissionGame, id: 'cellular-fission' },
            { game: GridColonyGame, id: 'grid-colony' },
            { game: PolygonRouletteGame, id: 'polygon-roulette' }
        ];
        
        games.forEach(gameData => {
            const game = gameData.game;
            const card = document.createElement('div');
            card.className = 'game-card';
            card.dataset.gameId = gameData.id;
            
            card.innerHTML = `
                <div class="game-icon">${game.icon}</div>
                <h3 class="game-title">${game.name}</h3>
                <p class="game-description">${game.description}</p>
            `;
            
            card.addEventListener('click', () => {
                this.startGame(game);
            });
            
            gamesGrid.appendChild(card);
        });
    }
    
    startGame(gameModule) {
        // Инициализируем Game Manager с текущими игроками
        this.gameManager = new GameManager(
            [...this.players], 
            this.canvas, 
            gameModule,
            (winner) => this.showWinner(winner),
            (time, escalation) => this.updateGameUI(time, escalation)
        );
        
        this.gameManager.init();
        this.switchScreen('arena');
        this.updatePlayersPanel();
    }
    
    updatePlayersPanel() {
        this.alivePlayersPanel.innerHTML = '';
        this.eliminatedPlayersPanel.innerHTML = '';
        
        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = `player-item ${player.eliminated ? 'eliminated' : ''}`;
            
            playerItem.innerHTML = `
                <div class="player-color" style="background-color: ${player.color}"></div>
                <div class="player-info">
                    ${player.eliminated ? `${player.name} (${player.rank})` : player.name}
                </div>
            `;
            
            if (player.eliminated) {
                this.eliminatedPlayersPanel.appendChild(playerItem);
            } else {
                this.alivePlayersPanel.appendChild(playerItem);
            }
        });
    }
    
    updateGameUI(time, escalation) {
        // Обновление таймера
        const minutes = Math.floor(time / 60).toString().padStart(2, '0');
        const seconds = (time % 60).toString().padStart(2, '0');
        this.timerElement.textContent = `${minutes}:${seconds}`;
        
        // Обновление индикатора эскалации
        if (escalation) {
            this.escalationIndicator.textContent = '⚡ ЭСКАЛАЦИЯ ⚡';
            this.escalationIndicator.style.background = '#ff00aa';
        } else {
            this.escalationIndicator.textContent = '⚡ НОРМАЛЬНО ⚡';
            this.escalationIndicator.style.background = '#00ffcc';
        }
    }
    
    showWinner(winner) {
        this.winnerName.textContent = winner.name;
        this.winnerModal.classList.add('active');
    }
    
    resizeCanvas() {
        if (this.canvas) {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
    }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
