// Общий менеджер игр (правила, темп, эскалация)

class GameManager {
    constructor(players, canvas, gameModule, onGameOver, onUpdate) {
        this.players = [...players];
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameModule = gameModule;
        this.onGameOver = onGameOver;
        this.onUpdate = onUpdate;
        
        // Состояния игры
        this.startTime = null;
        this.lastDeathTime = null;
        this.isEscalation = false;
        this.deathCooldown = false;
        this.pendingDeaths = [];
        
        // Таймеры
        this.lastTimestamp = 0;
        this.animationFrameId = null;
        
        // Callbacks для игры
        this.callbacks = {
            eliminatePlayer: this.eliminatePlayer.bind(this),
            onEscalation: this.triggerEscalation.bind(this)
        };
    }
    
    init() {
        this.startTime = Date.now();
        this.lastDeathTime = Date.now();
        this.isEscalation = false;
        this.deathCooldown = false;
        this.pendingDeaths = [];
        
        // Инициализация конкретной игры
        this.gameModule.init(this.canvas, this.players, this.callbacks);
        
        // Запуск игрового цикла
        this.lastTimestamp = performance.now();
        this.gameLoop();
    }
    
    gameLoop(timestamp) {
        const dt = (timestamp - this.lastTimestamp) / 1000; // Delta time в секундах
        this.lastTimestamp = timestamp;
        
        // Обновление игры
        try {
            this.gameModule.update(dt);
        } catch (error) {
            console.error('Ошибка в обновлении игры:', error);
            this.handleError(error);
            return;
        }
        
        // Проверка окончания игры
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length <= 1) {
            this.endGame(alivePlayers[0]);
            return;
        }
        
        // Проверка эскалации
        this.checkEscalation();
        
        // Обработка отложенных исключений
        this.processPendingDeaths();
        
        // Обновление UI
        this.updateUI();
        
        // Рендеринг
        try {
            this.gameModule.draw(this.ctx);
        } catch (error) {
            console.error('Ошибка в рендеринге игры:', error);
            this.handleError(error);
            return;
        }
        
        // Продолжение цикла
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    updateUI() {
        const currentTime = (Date.now() - this.startTime) / 1000;
        const timeInMinutes = Math.floor(currentTime / 60);
        const timeInSeconds = Math.floor(currentTime % 60);
        const formattedTime = `${String(timeInMinutes).padStart(2, '0')}:${String(timeInSeconds).padStart(2, '0')}`;
        
        if (this.onUpdate) {
            this.onUpdate(formattedTime, this.isEscalation);
        }
    }
    
    eliminatePlayer(playerId) {
        // Проверяем кулдаун на исключения
        if (this.deathCooldown) {
            // Если кулдаун активен, добавляем в очередь
            this.pendingDeaths.push(playerId);
            return;
        }
        
        // Исключаем игрока
        const player = this.players.find(p => p.id === playerId);
        if (player && player.alive) {
            player.alive = false;
            player.eliminated = true;
            player.rank = this.players.filter(p => !p.alive).length;
            
            // Активируем кулдаун
            this.deathCooldown = true;
            this.lastDeathTime = Date.now();
            
            // Запускаем таймер кулдауна (10 секунд)
            setTimeout(() => {
                this.deathCooldown = false;
                // Обрабатываем отложенные исключения
                this.processPendingDeaths();
            }, 10000);
            
            // Визуальные эффекты
            this.createEliminationEffect(player);
            
            // Звуковое уведомление
            this.playEliminationSound();
        }
    }
    
    processPendingDeaths() {
        // Обрабатываем отложенные исключения
        while (!this.deathCooldown && this.pendingDeaths.length > 0) {
            const nextPlayerId = this.pendingDeaths.shift();
            this.eliminatePlayer(nextPlayerId);
        }
    }
    
    checkEscalation() {
        const now = Date.now();
        const timeSinceLastDeath = (now - this.lastDeathTime) / 1000;
        
        // Если прошло более 30 секунд с последнего исключения
        if (timeSinceLastDeath > 30 && !this.isEscalation) {
            this.triggerEscalation();
        }
    }
    
    triggerEscalation() {
        this.isEscalation = true;
        this.lastDeathTime = Date.now();
        
        // Вызываем метод эскалации у текущей игры
        if (this.gameModule.onEscalation) {
            this.gameModule.onEscalation();
        }
        
        // Визуальные эффекты эскалации
        this.createEscalationEffect();
        
        // Звук эскалации
        this.playEscalationSound();
        
        // Отменяем эскалацию через 5 секунд
        setTimeout(() => {
            this.isEscalation = false;
        }, 5000);
    }
    
    createEliminationEffect(player) {
        // Создание частиц при исключении игрока
        const particles = [];
        const particleCount = 15;
        
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 5 + 2,
                speedX: (Math.random() - 0.5) * 4,
                speedY: (Math.random() - 0.5) * 4,
                color: player.color,
                life: 1.0
            });
        }
        
        // Анимация частиц
        const animateParticles = (timestamp) => {
            this.ctx.fillStyle = '#0f0f1a';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            particles.forEach((particle, index) => {
                particle.x += particle.speedX;
                particle.y += particle.speedY;
                particle.life -= 0.02;
                
                this.ctx.globalAlpha = particle.life;
                this.ctx.fillStyle = particle.color;
                this.ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
                
                if (particle.life <= 0) {
                    particles.splice(index, 1);
                }
            });
            
            this.ctx.globalAlpha = 1.0;
            
            if (particles.length > 0) {
                requestAnimationFrame(animateParticles);
            }
        };
        
        requestAnimationFrame(animateParticles);
    }
    
    createEscalationEffect() {
        // Мигание экрана красным
        this.canvas.style.filter = 'brightness(1.5) sepia(1) hue-rotate(0deg)';
        
        setTimeout(() => {
            this.canvas.style.filter = '';
        }, 500);
        
        // Тряска камеры
        document.body.classList.add('shake');
        setTimeout(() => {
            document.body.classList.remove('shake');
        }, 500);
    }
    
    playEliminationSound() {
        // Простой звук исключения через Web Audio API
        if (window.AudioContext) {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        }
    }
    
    playEscalationSound() {
        // Звук эскалации
        if (window.AudioContext) {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 1);
            
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 1);
        }
    }
    
    endGame(winner) {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        if (this.onGameOver && winner) {
            this.onGameOver(winner);
        }
    }
    
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Очистка игры
        if (this.gameModule.destroy) {
            this.gameModule.destroy();
        }
        
        // Очистка холста
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    handleError(error) {
        console.error('Ошибка в GameManager:', error);
        
        // Показываем сообщение об ошибке
        alert(`Произошла ошибка в игре: ${error.message}`);
        
        // Возвращаемся к выбору игр
        if (window.app) {
            window.app.switchScreen('games');
        }
    }
}
