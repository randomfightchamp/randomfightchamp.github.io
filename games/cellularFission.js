// Игра "Клеточный Делёж"

const CellularFissionGame = {
    id: 'cellular-fission',
    name: "Клеточный Делёж",
    description: "Расти, делись, пожирай меньших.",
    icon: "🧬",
    
    // Константы
    ARENA_RADIUS: 380,
    INITIAL_RADIUS: 15,
    MAX_RADIUS_BEFORE_SPLIT: 45,
    RADIUS_AFTER_SPLIT: 28,
    BASE_SPEED: 140,
    COMPANION_RADIUS: 10,
    FOOD_COUNT_TARGET: 40,
    FOOD_SPAWN_INTERVAL: 800,
    DAMAGE_THRESHOLD: 1.2,
    INVULNERABLE_TIME: 2000,
    SPLIT_COOLDOWN: 15000,
    EAT_RADIUS_GAIN: 0.6,
    POISON_DAMAGE: 1,
    
    // Состояние игры
    arena: null,
    players: [],
    companions: [],
    foods: [],
    gameManager: null,
    gameState: 'running',
    isPaused: false,
    isEscalated: false,
    lastFoodSpawnTime: 0,
    lastTime: 0,
    
    init(canvas, players, gameManager) {
        this.arena = {
            width: canvas.width,
            height: canvas.height,
            centerX: canvas.width / 2,
            centerY: canvas.height / 2
        };
        
        this.gameManager = gameManager;
        this.lastTime = performance.now();
        
        // Инициализация игроков
        this.players = players.map(player => ({
            ...player,
            x: this.arena.centerX + (Math.random() - 0.5) * this.ARENA_RADIUS * 0.8,
            y: this.arena.centerY + (Math.random() - 0.5) * this.ARENA_RADIUS * 0.8,
            vx: 0,
            vy: 0,
            radius: this.INITIAL_RADIUS,
            hp: 3,
            targetAngle: Math.random() * Math.PI * 2,
            dirChangeTimer: Math.random() * 2000 + 1000, // 1-3 сек
            companion: null,
            splitCooldown: 0,
            invulnerableUntil: 0,
            isAlive: true,
            place: null
        }));
        
        // Инициализация еды
        this.foods = [];
        this.spawnFood(this.FOOD_COUNT_TARGET);
        
        // Инициализация спутников
        this.companions = [];
    },
    
    spawnFood(count) {
        for (let i = 0; i < count; i++) {
            let x, y;
            let validPosition = false;
            
            // Ищем подходящую позицию
            while (!validPosition) {
                x = this.arena.centerX + (Math.random() - 0.5) * this.ARENA_RADIUS * 1.8;
                y = this.arena.centerY + (Math.random() - 0.5) * this.ARENA_RADIUS * 1.8;
                
                const dx = x - this.arena.centerX;
                const dy = y - this.arena.centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Проверяем, что внутри арены
                if (dist > this.ARENA_RADIUS - 10) continue;
                
                // Проверяем, что не пересекается с игроками
                validPosition = true;
                for (const player of this.players) {
                    if (!player.isAlive) continue;
                    
                    const pDx = x - player.x;
                    const pDy = y - player.y;
                    const pDist = Math.sqrt(pDx * pDx + pDy * pDy);
                    
                    if (pDist < player.radius + 10) {
                        validPosition = false;
                        break;
                    }
                }
            }
            
            this.foods.push({
                x: x,
                y: y,
                radius: 4,
                poisoned: this.isEscalated
            });
        }
    },
    
    update(dt) {
        if (this.isPaused) return;
        
        const now = Date.now();
        
        // Обновление игроков
        this.players.forEach(player => {
            if (!player.isAlive) return;
            
            // Обновление таймеров
            player.dirChangeTimer -= dt * 1000;
            player.splitCooldown -= dt * 1000;
            
            // Смена направления
            if (player.dirChangeTimer <= 0) {
                player.targetAngle = Math.random() * Math.PI * 2;
                player.dirChangeTimer = Math.random() * 2000 + 1000; // 1-3 сек
            }
            
            // Поворот к целевому углу (плавный)
            const currentAngle = Math.atan2(player.vy, player.vx);
            let angleDiff = player.targetAngle - currentAngle;
            
            // Нормализация разницы углов
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            // Поворот с максимальной скоростью 1 радиан/сек
            const maxTurn = 1 * dt;
            angleDiff = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
            
            const newAngle = currentAngle + angleDiff;
            const speed = this.BASE_SPEED * (this.INITIAL_RADIUS / player.radius);
            
            player.vx = Math.cos(newAngle) * speed;
            player.vy = Math.sin(newAngle) * speed;
            
            // Движение
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            
            // Отскок от границы арены
            this.boundaryCollision(player);
            
            // Уменьшение времени неуязвимости
            if (player.invulnerableUntil > now) {
                player.invulnerableUntil = now;
            }
        });
        
        // Обновление спутников
        this.updateCompanions(dt);
        
        // Проверка столкновений
        this.handleCollisions();
        
        // Поедание еды
        this.eatFood();
        
        // Спавн еды
        this.lastFoodSpawnTime += dt * 1000;
        if (this.lastFoodSpawnTime >= this.FOOD_SPAWN_INTERVAL) {
            if (this.foods.length < this.FOOD_COUNT_TARGET) {
                this.spawnFood(1);
            }
            this.lastFoodSpawnTime = 0;
        }
        
        // Проверка завершения игры
        const alivePlayers = this.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
            this.gameState = 'ending';
        }
    },
    
    boundaryCollision(player) {
        const dx = player.x - this.arena.centerX;
        const dy = player.y - this.arena.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.ARENA_RADIUS - player.radius) {
            // Нормаль от центра
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Мягкое отталкивание
            const overlap = distance - (this.ARENA_RADIUS - player.radius);
            const force = overlap * 100; // коэффициент отталкивания
            
            player.x -= nx * overlap;
            player.y -= ny * overlap;
            
            // Уменьшаем скорость в направлении границы
            const dotProduct = player.vx * nx + player.vy * ny;
            if (dotProduct > 0) {
                player.vx -= dotProduct * nx;
                player.vy -= dotProduct * ny;
            }
        }
    },
    
    updateCompanions(dt) {
        for (let i = 0; i < this.companions.length; i++) {
            const companion = this.companions[i];
            
            // Найти владельца
            const owner = this.players.find(p => p.id === companion.ownerId && p.isAlive);
            if (!owner) {
                // Владелец мертв, удаляем спутника
                this.companions.splice(i, 1);
                i--;
                continue;
            }
            
            // Обновление угла орбиты
            companion.angle += 1.5 * dt;
            
            // Позиция спутника
            companion.x = owner.x + Math.cos(companion.angle) * companion.orbitRadius;
            companion.y = owner.y + Math.sin(companion.angle) * companion.orbitRadius;
            
            // Если владелец стал слишком маленьким, поглощаем спутника
            if (owner.radius < this.INITIAL_RADIUS * 1.5) {
                owner.radius += companion.radius;
                this.companions.splice(i, 1);
                i--;
                owner.companion = null;
            }
        }
    },
    
    handleCollisions() {
        // Игрок - игрок
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
                    // Разделение по нормали
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const overlap = (playerA.radius + playerB.radius) - distance;
                    
                    // Раздвинуть пропорционально радиусам
                    const totalRadius = playerA.radius + playerB.radius;
                    const pushA = overlap * (playerB.radius / totalRadius);
                    const pushB = overlap * (playerA.radius / totalRadius);
                    
                    playerA.x -= nx * pushA;
                    playerA.y -= ny * pushA;
                    playerB.x += nx * pushB;
                    playerB.y += ny * pushB;
                    
                    // Упругий отскок (масса пропорциональна радиусу в квадрате)
                    const massA = playerA.radius * playerA.radius;
                    const massB = playerB.radius * playerB.radius;
                    
                    const vDot = (playerB.vx - playerA.vx) * nx + (playerB.vy - playerA.vy) * ny;
                    
                    if (vDot < 0) { // Объекты сближаются
                        const impulse = 2 * vDot / (massA + massB);
                        
                        playerA.vx += impulse * massB * nx;
                        playerA.vy += impulse * massB * ny;
                        playerB.vx -= impulse * massA * nx;
                        playerB.vy -= impulse * massA * ny;
                    }
                    
                    // Нанесение урона
                    this.damagePlayers(playerA, playerB);
                }
            }
        }
        
        // Игрок - спутник
        for (const player of this.players) {
            if (!player.isAlive) continue;
            
            for (let i = 0; i < this.companions.length; i++) {
                const companion = this.companions[i];
                
                if (companion.ownerId === player.id) continue; // Не с собственным спутником
                
                const dx = companion.x - player.x;
                const dy = companion.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < player.radius + companion.radius) {
                    // Разделение
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const overlap = (player.radius + companion.radius) - distance;
                    
                    player.x -= nx * overlap * 0.5;
                    player.y -= ny * overlap * 0.5;
                    companion.x += nx * overlap * 0.5;
                    companion.y += ny * overlap * 0.5;
                    
                    // Упругий отскок
                    const vDot = (companion.vx - player.vx) * nx + (companion.vy - player.vy) * ny;
                    
                    if (vDot < 0) {
                        const impulse = 2 * vDot / (player.radius * player.radius + companion.radius * companion.radius);
                        
                        player.vx += impulse * companion.radius * companion.radius * nx;
                        player.vy += impulse * companion.radius * companion.radius * ny;
                        companion.vx -= impulse * player.radius * player.radius * nx;
                        companion.vy -= impulse * player.radius * player.radius * ny;
                    }
                    
                    // Нанесение урона
                    if (player.radius > companion.radius * this.DAMAGE_THRESHOLD) {
                        companion.hp--;
                        if (companion.hp <= 0) {
                            this.companions.splice(i, 1);
                            i--;
                        }
                    } else if (companion.radius > player.radius * this.DAMAGE_THRESHOLD) {
                        const owner = this.players.find(p => p.id === companion.ownerId && p.isAlive);
                        if (owner && Date.now() > owner.invulnerableUntil) {
                            owner.hp--;
                            owner.invulnerableUntil = Date.now() + this.INVULNERABLE_TIME;
                            
                            if (owner.hp <= 0) {
                                this.triggerDeath(owner);
                            }
                        }
                    }
                }
            }
        }
    },
    
    damagePlayers(playerA, playerB) {
        const now = Date.now();
        
        // Проверяем урон от A к B
        if (playerA.radius > playerB.radius * this.DAMAGE_THRESHOLD && 
            now > playerB.invulnerableUntil) {
            playerB.hp--;
            playerB.invulnerableUntil = now + this.INVULNERABLE_TIME;
            
            if (playerB.hp <= 0) {
                this.triggerDeath(playerB);
            }
        }
        
        // Проверяем урон от B к A
        if (playerB.radius > playerA.radius * this.DAMAGE_THRESHOLD && 
            now > playerA.invulnerableUntil) {
            playerA.hp--;
            playerA.invulnerableUntil = now + this.INVULNERABLE_TIME;
            
            if (playerA.hp <= 0) {
                this.triggerDeath(playerA);
            }
        }
    },
    
    eatFood() {
        for (let i = 0; i < this.foods.length; i++) {
            const food = this.foods[i];
            
            for (const player of this.players) {
                if (!player.isAlive) continue;
                
                const dx = food.x - player.x;
                const dy = food.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < player.radius + food.radius) {
                    // Поедание еды
                    player.radius += this.EAT_RADIUS_GAIN;
                    
                    // Ядовитая еда
                    if (food.poisoned) {
                        player.hp -= this.POISON_DAMAGE;
                        player.radius -= 2;
                        
                        if (player.hp <= 0) {
                            this.triggerDeath(player);
                        }
                    }
                    
                    // Проверка необходимости деления
                    if (player.radius >= this.MAX_RADIUS_BEFORE_SPLIT && 
                        player.splitCooldown <= 0 && 
                        !player.companion) {
                        this.split(player);
                    }
                    
                    // Удаляем еду
                    this.foods.splice(i, 1);
                    i--;
                    break; // Один игрок может съесть одну еду за раз
                }
            }
        }
    },
    
    split(player) {
        // Уменьшаем радиус владельца
        player.radius = this.RADIUS_AFTER_SPLIT;
        player.splitCooldown = this.SPLIT_COOLDOWN;
        
        // Создаем спутника
        const companion = {
            ownerId: player.id,
            x: player.x,
            y: player.y,
            angle: Math.random() * Math.PI * 2,
            orbitRadius: 35,
            radius: this.COMPANION_RADIUS,
            hp: 1
        };
        
        this.companions.push(companion);
        player.companion = companion;
    },
    
    triggerDeath(player) {
        // Удаляем спутника, если есть
        if (player.companion) {
            const companionIndex = this.companions.findIndex(c => c.ownerId === player.id);
            if (companionIndex !== -1) {
                this.companions.splice(companionIndex, 1);
            }
        }
        
        // Отметка как мертвого
        player.isAlive = false;
        player.place = this.players.filter(p => !p.isAlive).length;
        
        // Создание частиц распада
        this.createDeathParticles(player);
        
        // Спавн еды из "тела"
        this.spawnFoodFromBody(player);
        
        // Вызов коллбэка менеджера игры
        if (this.gameManager) {
            this.gameManager.eliminatePlayer(player.id);
        }
    },
    
    createDeathParticles(player) {
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            const size = 2 + Math.random() * 3;
            
            // Здесь можно добавить частицы для визуального эффекта
            // В реальной реализации они будут отображаться в draw()
        }
    },
    
    spawnFoodFromBody(player) {
        // Спавн 5 единиц еды вокруг позиции смерти
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 10 + Math.random() * 20;
            
            const x = player.x + Math.cos(angle) * distance;
            const y = player.y + Math.sin(angle) * distance;
            
            // Проверка границ
            const dx = x - this.arena.centerX;
            const dy = y - this.arena.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < this.ARENA_RADIUS - 10) {
                this.foods.push({
                    x: x,
                    y: y,
                    radius: 4,
                    poisoned: this.isEscalated
                });
            }
        }
    },
    
    draw(ctx) {
        // Очищаем холст
        ctx.fillStyle = this.isEscalated ? '#1a0a18' : '#0a0a18'; // Фиолетовый фон при эскалации
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Рассчитываем центр арены для текущего размера canvas
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        const displayRadius = Math.min(this.ARENA_RADIUS, Math.min(ctx.canvas.width, ctx.canvas.height) * 0.4);
        
        // Рисуем границу арены
        ctx.beginPath();
        ctx.arc(centerX, centerY, displayRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(100, 100, 200, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Рисуем мягкую границу (градиент)
        const gradient = ctx.createRadialGradient(
            centerX, centerY, displayRadius * 0.8,
            centerX, centerY, displayRadius
        );
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'rgba(20, 20, 60, 0.5)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Сохраняем оригинальные значения для вычислений
        const originalCenterX = this.arena.centerX;
        const originalCenterY = this.arena.centerY;
        
        // Корректируем позиции для отображения
        this.arena.centerX = centerX;
        this.arena.centerY = centerY;
        
        // Рисуем еду
        for (const food of this.foods) {
            const adjustedX = centerX + (food.x - originalCenterX);
            const adjustedY = centerY + (food.y - originalCenterY);
            
            ctx.beginPath();
            ctx.arc(adjustedX, adjustedY, food.radius, 0, Math.PI * 2);
            
            if (food.poisoned) {
                ctx.fillStyle = '#ff3366';
            } else {
                ctx.fillStyle = '#ffcc00';
                
                // Свечение для обычной еды
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 10;
            }
            
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Рисуем спутников
        for (const companion of this.companions) {
            const owner = this.players.find(p => p.id === companion.ownerId && p.isAlive);
            if (!owner) continue;
            
            const adjustedX = centerX + (companion.x - originalCenterX);
            const adjustedY = centerY + (companion.y - originalCenterY);
            
            ctx.beginPath();
            ctx.arc(adjustedX, adjustedY, companion.radius, 0, Math.PI * 2);
            ctx.fillStyle = owner.color;
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            // Обводка спутника
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Рисуем игроков
        for (const player of this.players) {
            if (!player.isAlive) continue;
            
            const adjustedX = centerX + (player.x - originalCenterX);
            const adjustedY = centerY + (player.y - originalCenterY);
            
            // Трясущийся эффект у больших клеток
            const shakeAmplitude = player.radius > 30 ? Math.sin(Date.now() / 100) * (player.radius > 40 ? 2 : 1) : 0;
            const shakeX = adjustedX + shakeAmplitude * (Math.random() - 0.5);
            const shakeY = adjustedY + shakeAmplitude * (Math.random() - 0.5);
            
            // Полупрозрачная заливка
            ctx.beginPath();
            ctx.arc(shakeX, shakeY, player.radius, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.globalAlpha = 0.4;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            // Обводка
            ctx.strokeStyle = player.color;
            if (Date.now() < player.invulnerableUntil) {
                // Мигание в инвулне
                const blinkPhase = (Date.now() / 150) % 2; // 150ms period
                if (Math.floor(blinkPhase) === 0) {
                    ctx.strokeStyle = '#ffffff';
                }
            }
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Имя внутри
            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(player.name, shakeX, shakeY);
            
            // HP в виде точек над именем
            for (let i = 0; i < player.hp; i++) {
                ctx.beginPath();
                ctx.arc(shakeX - (player.hp - 1) * 3 + i * 6, shakeY - player.radius - 8, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }
        }
        
        // Восстанавливаем оригинальные значения
        this.arena.centerX = originalCenterX;
        this.arena.centerY = originalCenterY;
    },
    
    onEscalation() {
        // Все существующие еды становятся ядовитыми
        this.foods.forEach(food => {
            food.poisoned = true;
        });
        
        // Новая еда тоже будет ядовитой
        this.isEscalated = true;
        
        // Проверка, есть ли еще нормальная еда
        const hasNormalFood = this.foods.some(food => !food.poisoned);
        if (!hasNormalFood) {
            // Спавним немного нормальной еды как "окно передышки"
            this.spawnFood(10);
        }
    },
    
    pause() {
        this.isPaused = true;
    },
    
    resume() {
        this.isPaused = false;
    },
    
    restart() {
        // Сброс всех игроков к жизни
        this.players.forEach(player => {
            player.isAlive = true;
            player.hp = 3;
            player.radius = this.INITIAL_RADIUS;
            player.companion = null;
            player.splitCooldown = 0;
            player.invulnerableUntil = 0;
            player.place = null;
        });
        
        this.companions = [];
        this.foods = [];
        this.spawnFood(this.FOOD_COUNT_TARGET);
        this.isEscalated = false;
        this.gameState = 'running';
    },
    
    destroy() {
        this.players = [];
        this.companions = [];
        this.foods = [];
        this.arena = null;
        this.gameManager = null;
        this.gameState = 'finished';
    }
};

// Экспортируем глобально для доступа из других скриптов
window.CellularFissionGame = CellularFissionGame;
