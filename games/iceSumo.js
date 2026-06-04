// Игра "Ледяное Сумо"

const IceSumoGame = {
    id: 'ice-sumo',
    name: "Ледяное Сумо",
    description: "Скольжение, столкновения, выталкивание.",
    icon: "🧊",
    
    // Константы
    FRICTION: 0.985,
    IMPULSE_INTERVAL: 500,
    IMPULSE_FORCE_MIN: 80,
    IMPULSE_FORCE_MAX: 200,
    MAX_SPEED: 450,
    ARENA_RADIUS: 380,
    PLAYER_RADIUS: 22,
    INVULNERABLE_TIME: 2000,
    
    // Состояние игры
    arena: null,
    players: [],
    gameManager: null,
    gameState: 'preparation', // preparation, running, ending, finished
    prepStartTime: 0,
    prepDuration: 3000, // 3 секунды подготовки
    countdown: 3,
    countdownStep: 0,
    arenaRadius: 380,
    isPaused: false,
    lastTime: 0,
    
    init(canvas, players, gameManager) {
        this.arena = {
            width: canvas.width,
            height: canvas.height,
            centerX: canvas.width / 2,
            centerY: canvas.height / 2
        };
        
        this.gameManager = gameManager;
        this.arenaRadius = this.ARENA_RADIUS;
        this.lastTime = performance.now();
        
        // Инициализация игроков
        this.players = players.map((player, index) => {
            // Располагаем игроков по кругу
            const angle = (2 * Math.PI / players.length) * index;
            const distance = this.arenaRadius - 80;
            
            return {
                ...player,
                x: this.arena.centerX + Math.cos(angle) * distance,
                y: this.arena.centerY + Math.sin(angle) * distance,
                vx: 0,
                vy: 0,
                radius: this.PLAYER_RADIUS,
                hp: 3,
                invulnerableUntil: 0,
                isAlive: true,
                place: null,
                lastImpulseTime: Date.now()
            };
        });
        
        this.gameState = 'preparation';
        this.prepStartTime = Date.now();
        this.countdown = 3;
        this.countdownStep = 0;
    },
    
    update(dt) {
        if (this.isPaused) return;
        
        const now = Date.now();
        
        // Обработка состояния подготовки
        if (this.gameState === 'preparation') {
            const elapsed = now - this.prepStartTime;
            const stepTime = this.prepDuration / 4; // 3 -> 2 -> 1 -> FIGHT!
            
            if (elapsed > this.prepDuration) {
                this.gameState = 'running';
                // Добавляем стартовый импульс к центру
                this.players.forEach(player => {
                    if (player.isAlive) {
                        const dx = this.arena.centerX - player.x;
                        const dy = this.arena.centerY - player.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            const impulse = 100; // лёгкий импульс
                            player.vx = (dx / dist) * impulse;
                            player.vy = (dy / dist) * impulse;
                        }
                    }
                });
            } else {
                // Обновляем обратный отсчёт
                const newCountdown = Math.ceil((this.prepDuration - elapsed) / stepTime);
                if (newCountdown !== this.countdown && newCountdown >= 0) {
                    this.countdown = newCountdown;
                }
            }
            return;
        }
        
        // Обновление во время игры
        if (this.gameState === 'running') {
            // Обновляем физику для каждого игрока
            this.players.forEach(player => {
                if (!player.isAlive) return;
                
                // Трение
                const frictionFactor = Math.pow(this.FRICTION, dt * 60);
                player.vx *= frictionFactor;
                player.vy *= frictionFactor;
                
                // Ограничение максимальной скорости
                const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
                if (speed > this.MAX_SPEED) {
                    player.vx = (player.vx / speed) * this.MAX_SPEED;
                    player.vy = (player.vy / speed) * this.MAX_SPEED;
                }
                
                // Интеграция
                player.x += player.vx * dt;
                player.y += player.vy * dt;
                
                // Отскок от границы арены
                this.checkBoundaryCollision(player);
                
                // Импульсы (каждые IMPULSE_INTERVAL мс)
                if (now - player.lastImpulseTime > this.IMPULSE_INTERVAL) {
                    this.applyRandomImpulse(player);
                    player.lastImpulseTime = now;
                }
                
                // Уменьшение времени неуязвимости
                if (player.invulnerableUntil > now) {
                    player.invulnerableUntil = now;
                }
            });
            
            // Обработка столкновений
            this.handleCollisions();
            
            // Проверка завершения игры
            const alivePlayers = this.players.filter(p => p.isAlive);
            if (alivePlayers.length <= 1) {
                this.gameState = 'ending';
                if (alivePlayers.length === 1) {
                    // Установка места для победителя
                    alivePlayers[0].place = 1;
                }
            }
        }
        
        // Обработка состояния завершения
        if (this.gameState === 'ending') {
            // Здесь может быть финальная анимация
            // Победитель увеличивается, летают частицы и т.д.
        }
    },
    
    checkBoundaryCollision(player) {
        const dx = player.x - this.arena.centerX;
        const dy = player.y - this.arena.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.arenaRadius - player.radius) {
            // Нормаль от центра
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Отражение скорости
            const dotProduct = player.vx * nx + player.vy * ny;
            player.vx -= 2 * dotProduct * nx;
            player.vy -= 2 * dotProduct * ny;
            
            // Потеря энергии
            player.vx *= 0.7;
            player.vy *= 0.7;
            
            // Выталкивание внутрь
            const overlap = distance - (this.arenaRadius - player.radius);
            player.x -= nx * overlap;
            player.y -= ny * overlap;
            
            // Вызов смерти если игрок за пределами уменьшенной арены (при эскалации)
            if (distance > this.arenaRadius - player.radius && this.arenaRadius < this.ARENA_RADIUS) {
                this.triggerDeath(player);
            }
        }
    },
    
    applyRandomImpulse(player) {
        const angle = Math.random() * Math.PI * 2;
        const force = this.IMPULSE_FORCE_MIN + Math.random() * (this.IMPULSE_FORCE_MAX - this.IMPULSE_FORCE_MIN);
        
        player.vx += Math.cos(angle) * force;
        player.vy += Math.sin(angle) * force;
    },
    
    handleCollisions() {
        for (let i = 0; i < this.players.length; i++) {
            const playerA = this.players[i];
            if (!playerA.isAlive) continue;
            
            for (let j = i + 1; j < this.players.length; j++) {
                const playerB = this.players[j];
                if (!playerB.isAlive) continue;
                
                const dx = playerB.x - playerA.x;
                const dy = playerB.y - playerA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < playerA.radius + playerB.radius) {
                    // Разделение игроков
                    const overlap = (playerA.radius + playerB.radius) - distance;
                    const nx = dx / distance;
                    const ny = dy / distance;
                    
                    // Раздвинуть по нормали
                    const separationX = nx * overlap * 0.5;
                    const separationY = ny * overlap * 0.5;
                    
                    playerA.x -= separationX;
                    playerA.y -= separationY;
                    playerB.x += separationX;
                    playerB.y += separationY;
                    
                    // Упругий отскок (равные массы)
                    const relativeVelocityX = playerB.vx - playerA.vx;
                    const relativeVelocityY = playerB.vy - playerA.vy;
                    
                    const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;
                    
                    if (velocityAlongNormal > 0) continue; // объекты удаляются
                    
                    // Импульс для обмена скоростями
                    const impulse = 2 * velocityAlongNormal;
                    
                    playerA.vx += impulse * nx;
                    playerA.vy += impulse * ny;
                    playerB.vx -= impulse * nx;
                    playerB.vy -= impulse * ny;
                    
                    // Нанесение урона (если не в инвулне)
                    const now = Date.now();
                    
                    if (now > playerA.invulnerableUntil) {
                        playerA.hp--;
                        playerA.invulnerableUntil = now + this.INVULNERABLE_TIME;
                        if (playerA.hp <= 0) {
                            this.triggerDeath(playerA);
                        }
                    }
                    
                    if (now > playerB.invulnerableUntil) {
                        playerB.hp--;
                        playerB.invulnerableUntil = now + this.INVULNERABLE_TIME;
                        if (playerB.hp <= 0) {
                            this.triggerDeath(playerB);
                        }
                    }
                }
            }
        }
    },
    
    triggerDeath(player) {
        // Финальный импульс от центра наружу
        const dx = player.x - this.arena.centerX;
        const dy = player.y - this.arena.centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            player.vx = (dx / dist) * 600;
            player.vy = (dy / dist) * 600;
        }
        
        // Установка места
        const aliveCount = this.players.filter(p => p.isAlive).length;
        player.place = aliveCount;
        
        // Отметка как мертвого
        player.isAlive = false;
        
        // Вызов коллбэка менеджера игры
        if (this.gameManager) {
            this.gameManager.eliminatePlayer(player.id);
        }
    },
    
    draw(ctx) {
        // Очищаем холст
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Рассчитываем центр арены для текущего размера canvas
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        const availableRadius = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.4;
        const displayRadius = Math.min(this.arenaRadius, availableRadius);
        
        // Рисуем арену
        ctx.beginPath();
        ctx.arc(centerX, centerY, displayRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, displayRadius
        );
        gradient.addColorStop(0, '#2a3a5a');
        gradient.addColorStop(1, '#1a2a4a');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = this.arenaRadius < this.ARENA_RADIUS ? '#ff3366' : '#00ffcc';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Рисуем линии на льду
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const startX = centerX + Math.cos(angle) * 10;
            const startY = centerY + Math.sin(angle) * 10;
            const endX = centerX + Math.cos(angle) * (displayRadius - 10);
            const endY = centerY + Math.sin(angle) * (displayRadius - 10);
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'rgba(200, 230, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Состояние подготовки - отображаем обратный отсчёт
        if (this.gameState === 'preparation') {
            let text = this.countdown.toString();
            if (this.countdown === 0) text = 'FIGHT!';
            
            ctx.font = 'bold 60px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, centerX, centerY);
        }
        
        // Рисуем игроков
        this.players.forEach(player => {
            if (!player.isAlive) return;
            
            // Определяем прозрачность для инвулна
            let alpha = 1;
            if (Date.now() < player.invulnerableUntil) {
                // Мигание (8 Гц)
                const blinkPhase = (Date.now() / 125) % 2; // 125ms period = 8Hz
                alpha = Math.floor(blinkPhase) === 0 ? 1 : 0.5;
            }
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Рассчитываем позицию игрока относительно нового центра
            const adjustedX = centerX + (player.x - this.arena.centerX);
            const adjustedY = centerY + (player.y - this.arena.centerY);
            
            // Тело игрока
            ctx.beginPath();
            ctx.arc(adjustedX, adjustedY, player.radius, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.fill();
            
            // Обводка игрока
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Индикатор HP
            const hpWidth = player.radius * 2;
            const hpHeight = 4;
            const hpX = adjustedX - player.radius;
            const hpY = adjustedY - player.radius - 8;
            
            // Фон полоски HP
            ctx.fillStyle = '#333';
            ctx.fillRect(hpX, hpY, hpWidth, hpHeight);
            
            // Заполнение HP
            const hpPercent = player.hp / 3;
            ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
            ctx.fillRect(hpX, hpY, hpWidth * hpPercent, hpHeight);
            
            ctx.restore();
        });
    },
    
    onEscalation() {
        // При эскалации уменьшаем радиус арены
        this.arenaRadius = Math.max(150, this.arenaRadius - 10);
    },
    
    pause() {
        this.isPaused = true;
    },
    
    resume() {
        this.isPaused = false;
    },
    
    restart() {
        // Перезапуск игры
        this.gameState = 'preparation';
        this.prepStartTime = Date.now();
        this.countdown = 3;
        this.countdownStep = 0;
        this.arenaRadius = this.ARENA_RADIUS;
        
        // Сброс игроков
        this.players.forEach(player => {
            player.isAlive = true;
            player.hp = 3;
            player.invulnerableUntil = 0;
            player.place = null;
            player.vx = 0;
            player.vy = 0;
        });
    },
    
    destroy() {
        this.players = [];
        this.arena = null;
        this.gameManager = null;
        this.gameState = 'finished';
    }
};

// Экспортируем глобально для доступа из других скриптов
window.IceSumoGame = IceSumoGame;
