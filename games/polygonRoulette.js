// Игра "Арканоид Судьбы v2"

const PolygonRouletteGame = {
    id: 'polygon-roulette',
    name: "Арканоид Судьбы",
    description: "Два вложенных многоугольника, вращающихся в противоположных направлениях. Шарик разрушает внутренний и выбивает внешних игроков.",
    icon: "🎯",
    
    // Константы
    BALL_SPEED: 260,
    INNER_ROT_SPEED: 0.6,
    OUTER_ROT_SPEED: -0.25,
    ROUND_PAUSE: 1800,
    INNER_SIDES: 30,
    OUTER_R: 350,
    INNER_R: 210,
    MARGIN: 35,
    BALL_RADIUS: 7,
    MAX_BALL_SPEED: 500,
    ELIMINATION_BANNER_DURATION: 5000,
    LABEL_OFFSET: 28,
    
    // Состояние игры
    arena: null,
    originalPlayers: [],
    players: [],
    gameManager: null,
    gameState: 'preparation', // preparation, running, round_pause, ending, finished
    prepStartTime: 0,
    roundStartTime: 0,
    roundNumber: 1,
    ball: null,
    innerPolygon: null,
    outerPolygon: null,
    particles: [],
    isPaused: false,
    isEscalated: false,
    escalationVisualUntil: 0,
    lastEliminated: null,
    lastEliminatedAt: 0,
    roundPauseTimer: 0,
    lastTime: 0,
    
    init(canvas, players, gameManager) {
        this.arena = {
            width: canvas.width,
            height: canvas.height,
            centerX: canvas.width / 2,
            centerY: canvas.height / 2
        };
        
        this.gameManager = gameManager;
        this.originalPlayers = [...players];
        this.players = players.map((player, index) => ({
            ...player,
            isAlive: true,
            place: null
        }));
        
        this.lastTime = performance.now();
        this.lastEliminated = null;
        this.lastEliminatedAt = 0;
        this.escalationVisualUntil = 0;
        this.createPolygons();
        this.resetBall();
        
        this.gameState = 'preparation';
        this.prepStartTime = Date.now();
    },
    
    createPolygons() {
        const alivePlayers = this.players.filter(p => p.isAlive);
        const outerSides = alivePlayers.length === 2 ? 4 : Math.max(3, alivePlayers.length);
        const outerRadius = this.getOuterRadius();
        const innerRadius = this.getInnerRadiusForOuter(outerRadius, outerSides);
        
        // Малый многоугольник (внутри, постоянное число граней)
        this.innerPolygon = {
            cx: this.arena.centerX,
            cy: this.arena.centerY,
            radius: innerRadius,
            sides: this.INNER_SIDES,
            rotation: 0,
            rotSpeed: this.INNER_ROT_SPEED,
            edges: Array.from({length: this.INNER_SIDES}, (_, i) => ({ active: true }))
        };
        
        // Большой многоугольник (внешний, зависит от числа игроков)
        // Для финала (2 игрока) создаем квадрат
        let edges = [];
        if (alivePlayers.length === 2) {
            // Квадрат с двумя игроками (по две грани у каждого)
            edges = [
                { playerId: alivePlayers[0].id, active: true },
                { playerId: alivePlayers[1].id, active: true },
                { playerId: alivePlayers[0].id, active: true },
                { playerId: alivePlayers[1].id, active: true }
            ];
        } else {
            // Обычный случай
            edges = alivePlayers.map(player => ({
                playerId: player.id,
                active: true
            }));
        }
        
        this.outerPolygon = {
            cx: this.arena.centerX,
            cy: this.arena.centerY,
            radius: outerRadius,
            sides: edges.length,
            rotation: 0,
            rotSpeed: this.OUTER_ROT_SPEED,
            edges: edges
        };
    },
    
    getOuterRadius() {
        return this.OUTER_R;
    },
    
    getInnerRadiusForOuter(outerRadius, outerSides) {
        // Внутренний 30-угольник должен помещаться во внешний многоугольник.
        const outerInradius = outerRadius * Math.cos(Math.PI / outerSides);
        return Math.max(80, Math.min(this.INNER_R, outerInradius - this.MARGIN));
    },
    
    resetBall() {
        this.ball = {
            x: this.arena.centerX,
            y: this.arena.centerY,
            vx: 0,
            vy: 0,
            radius: this.BALL_RADIUS,
            alive: true,
            trail: []
        };
        
        // Начальное движение шарика
        const angle = Math.random() * Math.PI * 2;
        this.ball.vx = Math.cos(angle) * this.BALL_SPEED;
        this.ball.vy = Math.sin(angle) * this.BALL_SPEED;
    },
    
    update(dt) {
        if (this.isPaused) return;
        
        const now = Date.now();
        if (this.isEscalated && now > this.escalationVisualUntil) {
            this.isEscalated = false;
        }
        
        // Обработка состояния подготовки
        if (this.gameState === 'preparation') {
            if (now - this.prepStartTime > 2000) { // 2 секунды подготовки
                this.gameState = 'running';
                this.roundStartTime = now;
                this.ball.trail = [];
            }
            return;
        }
        
        // Обработка паузы между раундами
        if (this.gameState === 'round_pause') {
            this.roundPauseTimer += dt * 1000;
            if (this.roundPauseTimer >= this.ROUND_PAUSE) {
                this.startNextRound();
            }
            return;
        }
        
        // Обновление во время игры
        if (this.gameState === 'running') {
            // Вращения многоугольников
            this.innerPolygon.rotation += this.innerPolygon.rotSpeed * dt;
            this.outerPolygon.rotation += this.outerPolygon.rotSpeed * dt;
            
            // Движение шарика
            this.ball.x += this.ball.vx * dt;
            this.ball.y += this.ball.vy * dt;
            
            // Сохраняем след шарика
            this.ball.trail.push({ x: this.ball.x, y: this.ball.y });
            if (this.ball.trail.length > 20) {
                this.ball.trail.shift();
            }
            
            // Проверка коллизий шарика с внутренним многоугольником
            this.checkBallInnerCollision();
            
            // Проверка коллизий шарика с внешним многоугольником
            if (!this.checkBallOuterCollision()) {
                // Защита от вылета шарика в космос
                if (this.isBallTooFar()) {
                    this.handleForcedOuterHit();
                }
            }
            
            // Обновление частиц
            this.updateParticles(dt);
            
            // Проверка завершения игры
            const alivePlayers = this.players.filter(p => p.isAlive);
            if (alivePlayers.length <= 1) {
                this.gameState = 'ending';
            }
        }
    },
    
    checkBallInnerCollision() {
        for (let i = 0; i < this.innerPolygon.sides; i++) {
            if (!this.innerPolygon.edges[i].active) continue;
            
            // Вычисляем вершины грани
            const angle1 = this.innerPolygon.rotation + (2 * Math.PI * i / this.innerPolygon.sides);
            const angle2 = this.innerPolygon.rotation + (2 * Math.PI * (i + 1) / this.innerPolygon.sides);
            
            const p1 = {
                x: this.innerPolygon.cx + Math.cos(angle1) * this.innerPolygon.radius,
                y: this.innerPolygon.cy + Math.sin(angle1) * this.innerPolygon.radius
            };
            
            const p2 = {
                x: this.innerPolygon.cx + Math.cos(angle2) * this.innerPolygon.radius,
                y: this.innerPolygon.cy + Math.sin(angle2) * this.innerPolygon.radius
            };
            
            // Находим ближайшую точку на отрезке к центру шарика
            const closestPoint = this.getClosestPointOnSegment(this.ball.x, this.ball.y, p1.x, p1.y, p2.x, p2.y);
            const dx = this.ball.x - closestPoint.x;
            const dy = this.ball.y - closestPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.ball.radius) {
                // Нормаль грани (перпендикуляр, направленный внутрь)
                const edgeVector = { x: p2.x - p1.x, y: p2.y - p1.y };
                const normal = { x: -edgeVector.y, y: edgeVector.x };
                const normalLength = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
                normal.x /= normalLength;
                normal.y /= normalLength;
                
                // Убедимся, что нормаль направлена внутрь
                const centerToEdge = {
                    x: closestPoint.x - this.innerPolygon.cx,
                    y: closestPoint.y - this.innerPolygon.cy
                };
                if (normal.x * centerToEdge.x + normal.y * centerToEdge.y > 0) {
                    normal.x = -normal.x;
                    normal.y = -normal.y;
                }
                
                // Отскок по арканоидному правилу: v' = v - 2*(v·n)*n
                const dotProduct = this.ball.vx * normal.x + this.ball.vy * normal.y;
                this.ball.vx -= 2 * dotProduct * normal.x;
                this.ball.vy -= 2 * dotProduct * normal.y;
                
                // Нормализуем скорость
                const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
                if (speed > 0) {
                    const normalizedSpeed = Math.min(speed, this.MAX_BALL_SPEED);
                    this.ball.vx = (this.ball.vx / speed) * normalizedSpeed;
                    this.ball.vy = (this.ball.vy / speed) * normalizedSpeed;
                }
                
                // Выталкивание шарика из грани
                const pushDistance = this.ball.radius + 0.5;
                this.ball.x += normal.x * pushDistance;
                this.ball.y += normal.y * pushDistance;
                
                // Деактивация грани
                this.innerPolygon.edges[i].active = false;
                
                // Создание частиц-осколков
                this.createParticles(closestPoint.x, closestPoint.y, normal.x, normal.y, '#ffffff');
                
                // Только одна грань за кадр
                break;
            }
        }
    },
    
    checkBallOuterCollision() {
        for (let i = 0; i < this.outerPolygon.sides; i++) {
            const edge = this.outerPolygon.edges[i];
            if (!edge.active) continue;
            
            // Вычисляем вершины грани
            const angle1 = this.outerPolygon.rotation + (2 * Math.PI * i / this.outerPolygon.sides);
            const angle2 = this.outerPolygon.rotation + (2 * Math.PI * (i + 1) / this.outerPolygon.sides);
            
            const p1 = {
                x: this.outerPolygon.cx + Math.cos(angle1) * this.outerPolygon.radius,
                y: this.outerPolygon.cy + Math.sin(angle1) * this.outerPolygon.radius
            };
            
            const p2 = {
                x: this.outerPolygon.cx + Math.cos(angle2) * this.outerPolygon.radius,
                y: this.outerPolygon.cy + Math.sin(angle2) * this.outerPolygon.radius
            };
            
            // Находим ближайшую точку на отрезке к центру шарика
            const closestPoint = this.getClosestPointOnSegment(this.ball.x, this.ball.y, p1.x, p1.y, p2.x, p2.y);
            const dx = this.ball.x - closestPoint.x;
            const dy = this.ball.y - closestPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.ball.radius) {
                // Игрок выбывает
                const playerToEliminate = this.getAlivePlayerById(edge.playerId);
                
                if (playerToEliminate) {
                    edge.active = false;
                    this.triggerDeath(playerToEliminate);
                    return true; // Успешный вылет
                }
            }
        }
        return false; // Нет вылета
    },
    
    isBallTooFar() {
        const dx = this.ball.x - this.outerPolygon.cx;
        const dy = this.ball.y - this.outerPolygon.cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > this.outerPolygon.radius + 50;
    },
    
    handleForcedOuterHit() {
        // Защита от вылета шарика в космос - принудительный вылет по углу
        const dx = this.ball.x - this.outerPolygon.cx;
        const dy = this.ball.y - this.outerPolygon.cy;
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;
        
        // Найти ближайшую грань по углу
        const sectorAngle = 2 * Math.PI / this.outerPolygon.sides;
        const sectorIdx = Math.floor((angle - this.outerPolygon.rotation + 2 * Math.PI) % (2 * Math.PI) / sectorAngle);
        
        if (sectorIdx >= 0 && sectorIdx < this.outerPolygon.sides) {
            const edge = this.outerPolygon.edges[sectorIdx];
            const playerToEliminate = edge && this.getAlivePlayerById(edge.playerId);
            
            if (edge && playerToEliminate) {
                edge.active = false;
                this.triggerDeath(playerToEliminate);
            }
        }
    },
    
    getAlivePlayerById(playerId) {
        return this.players.find(player => player.id === playerId && player.isAlive);
    },
    
    getClosestPointOnSegment(px, py, ax, ay, bx, by) {
        const ap = { x: px - ax, y: py - ay };
        const ab = { x: bx - ax, y: by - ay };
        const ab2 = ab.x * ab.x + ab.y * ab.y;
        const ap_ab = ap.x * ab.x + ap.y * ab.y;
        
        let t = ap_ab / ab2;
        t = Math.max(0, Math.min(1, t));
        
        return {
            x: ax + ab.x * t,
            y: ay + ab.y * t
        };
    },
    
    triggerDeath(player) {
        if (!player || !player.isAlive) return;
        
        // Отметка как мертвого
        player.isAlive = false;
        player.place = this.players.filter(p => !p.isAlive).length;
        this.lastEliminated = player;
        this.lastEliminatedAt = Date.now();
        
        // Вызов коллбэка менеджера игры
        if (this.gameManager) {
            this.gameManager.eliminatePlayer(player.id);
        }
        
        const alivePlayers = this.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
            this.gameState = 'ending';
            return;
        }
        
        // Начало паузы между раундами
        this.gameState = 'round_pause';
        this.roundPauseTimer = 0;
    },
    
    startNextRound() {
        this.createPolygons(); // Обновляем внешний многоугольник
        this.resetBall(); // Сбрасываем шарик
        this.roundNumber++;
        this.gameState = 'preparation';
        this.prepStartTime = Date.now();
        this.roundStartTime = Date.now();
    },
    
    createParticles(x, y, nx, ny, color) {
        for (let i = 0; i < 6; i++) {
            const speed = 30 + Math.random() * 60;
            const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * Math.PI / 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            this.particles.push({
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                radius: 1.5 + Math.random() * 2.5,
                life: 1.0,
                decay: 0.02,
                color: color
            });
        }
    },
    
    updateParticles(dt) {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.life -= particle.decay;
            return particle.life > 0;
        });
    },
    
    draw(ctx) {
        // Очищаем холст
        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Рассчитываем центр арены для текущего размера canvas
        const centerX = ctx.canvas.width / 2;
        const centerY = ctx.canvas.height / 2;
        
        // Сохраняем оригинальные значения для вычислений
        const originalInnerCx = this.innerPolygon.cx;
        const originalInnerCy = this.innerPolygon.cy;
        const originalOuterCx = this.outerPolygon.cx;
        const originalOuterCy = this.outerPolygon.cy;
        
        // Корректируем позиции для отображения
        this.innerPolygon.cx = centerX;
        this.innerPolygon.cy = centerY;
        this.outerPolygon.cx = centerX;
        this.outerPolygon.cy = centerY;
        
        // Рисуем внешний многоугольник (большой)
        for (let i = 0; i < this.outerPolygon.sides; i++) {
            const edge = this.outerPolygon.edges[i];
            if (!edge.active) continue;
            
            const angle1 = this.outerPolygon.rotation + (2 * Math.PI * i / this.outerPolygon.sides);
            const angle2 = this.outerPolygon.rotation + (2 * Math.PI * (i + 1) / this.outerPolygon.sides);
            
            const p1 = {
                x: centerX + Math.cos(angle1) * this.outerPolygon.radius,
                y: centerY + Math.sin(angle1) * this.outerPolygon.radius
            };
            
            const p2 = {
                x: centerX + Math.cos(angle2) * this.outerPolygon.radius,
                y: centerY + Math.sin(angle2) * this.outerPolygon.radius
            };
            
            const player = this.players.find(p => p.id === edge.playerId);
            
            if (player) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = player.color;
                ctx.lineWidth = 6;
                ctx.stroke();
                
                // Добавляем свечение
                ctx.shadowColor = player.color;
                ctx.shadowBlur = 15;
                ctx.stroke();
                ctx.shadowBlur = 0;
                
                this.drawOuterLabel(ctx, player, angle1, angle2, centerX, centerY);
            }
        }
        
        // Рисуем разделители секторов внешнего многоугольника
        for (let i = 0; i < this.outerPolygon.sides; i++) {
            const angle = this.outerPolygon.rotation + (2 * Math.PI * i / this.outerPolygon.sides);
            const endX = centerX + Math.cos(angle) * this.outerPolygon.radius;
            const endY = centerY + Math.sin(angle) * this.outerPolygon.radius;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Рисуем внутренний многоугольник (малый)
        for (let i = 0; i < this.innerPolygon.sides; i++) {
            if (!this.innerPolygon.edges[i].active) continue;
            
            const angle1 = this.innerPolygon.rotation + (2 * Math.PI * i / this.innerPolygon.sides);
            const angle2 = this.innerPolygon.rotation + (2 * Math.PI * (i + 1) / this.innerPolygon.sides);
            
            const p1 = {
                x: centerX + Math.cos(angle1) * this.innerPolygon.radius,
                y: centerY + Math.sin(angle1) * this.innerPolygon.radius
            };
            
            const p2 = {
                x: centerX + Math.cos(angle2) * this.innerPolygon.radius,
                y: centerY + Math.sin(angle2) * this.innerPolygon.radius
            };
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            // Цвет внутреннего многоугольника при эскалации
            if (this.isEscalated) {
                const time = Date.now() / 200; // частота пульсации
                const colorValue = Math.floor(200 + 55 * Math.sin(time));
                ctx.strokeStyle = `rgb(${colorValue}, 100, 100)`;
            } else {
                ctx.strokeStyle = '#ffffff';
            }
            
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Добавляем свечение
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        
        // Рисуем шарик
        if (this.ball && this.gameState !== 'preparation') {
            // Рисуем шлейф из предыдущих позиций
            for (let i = 0; i < this.ball.trail.length; i++) {
                const pos = this.ball.trail[i];
                const alpha = (i / this.ball.trail.length) * 0.4;
                
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(
                    centerX + (pos.x - originalInnerCx), 
                    centerY + (pos.y - originalInnerCy), 
                    this.ball.radius * 0.7, 
                    0, 
                    Math.PI * 2
                );
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }
            
            // Сам шарик
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(
                centerX + (this.ball.x - originalInnerCx), 
                centerY + (this.ball.y - originalInnerCy), 
                this.ball.radius, 
                0, 
                Math.PI * 2
            );
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            // Свечение шарика
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        
        // Рисуем частицы
        this.particles.forEach(particle => {
            ctx.globalAlpha = particle.life;
            ctx.beginPath();
            ctx.arc(
                centerX + (particle.x - originalInnerCx), 
                centerY + (particle.y - originalInnerCy), 
                particle.radius, 
                0, 
                Math.PI * 2
            );
            ctx.fillStyle = particle.color;
            ctx.fill();
        });
        
        // Рисуем центр
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Состояние подготовки - отображаем информацию
        if (this.gameState === 'preparation') {
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`РАУНД ${this.roundNumber}`, centerX, centerY - 50);
            
            ctx.font = '24px Arial';
            ctx.fillText(`ОСТАЛОСЬ ${this.players.filter(p => p.isAlive).length}`, centerX, centerY + 10);
        }
        
        // Состояние паузы между раундами
        if (this.gameState === 'round_pause') {
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#ffcc00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`РАУНД ${this.roundNumber}`, centerX, centerY);
            
            if (this.lastEliminated) {
                ctx.font = 'bold 28px Arial';
                ctx.fillStyle = this.lastEliminated.color;
                ctx.fillText(`Выбыл: ${this.lastEliminated.name}`, centerX, centerY + 48);
            }
        }
        
        this.drawEliminationBanner(ctx, centerX);
        
        // Состояние завершения
        if (this.gameState === 'ending') {
            const winner = this.players.find(p => p.isAlive);
            if (winner) {
                ctx.font = 'bold 48px Arial';
                ctx.fillStyle = '#00ffcc';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🏆 ПОБЕДИТЕЛЬ 🏆', centerX, centerY - 50);
                
                ctx.font = '36px Arial';
                ctx.fillStyle = winner.color;
                ctx.fillText(winner.name, centerX, centerY + 20);
            }
        }
        
        // Восстанавливаем оригинальные значения
        this.innerPolygon.cx = originalInnerCx;
        this.innerPolygon.cy = originalInnerCy;
        this.outerPolygon.cx = originalOuterCx;
        this.outerPolygon.cy = originalOuterCy;
    },
    
    drawOuterLabel(ctx, player, angle1, angle2, centerX, centerY) {
        const midAngle = (angle1 + angle2) / 2;
        const labelRadius = this.outerPolygon.radius + this.LABEL_OFFSET;
        const x = centerX + Math.cos(midAngle) * labelRadius;
        const y = centerY + Math.sin(midAngle) * labelRadius;
        let rotation = midAngle + Math.PI / 2;
        const normalizedRotation = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        
        // Переворачиваем подпись на нижней половине, чтобы имя оставалось читаемым.
        if (normalizedRotation > Math.PI / 2 && normalizedRotation < Math.PI * 1.5) {
            rotation += Math.PI;
        }
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = 'rgba(210, 210, 220, 0.55)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.name, 0, 0, 90);
        ctx.restore();
    },
    
    drawEliminationBanner(ctx, centerX) {
        if (!this.lastEliminated) return;
        
        const age = Date.now() - this.lastEliminatedAt;
        const isRoundPause = this.gameState === 'round_pause' || this.gameState === 'preparation' || this.gameState === 'ending';
        if (age > this.ELIMINATION_BANNER_DURATION && !isRoundPause) return;
        
        const alpha = isRoundPause ? 1 : Math.max(0, 1 - age / this.ELIMINATION_BANNER_DURATION);
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(10, 10, 24, 0.75)';
        ctx.fillRect(centerX - 160, 18, 320, 36);
        ctx.strokeStyle = this.lastEliminated.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - 160, 18, 320, 36);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Выбыл: ${this.lastEliminated.name}`, centerX, 25);
        ctx.restore();
    },
    
    onEscalation() {
        // Сбиваем случайные активные грани внутреннего многоугольника
        const activeInnerEdges = [];
        for (let i = 0; i < this.innerPolygon.sides; i++) {
            if (this.innerPolygon.edges[i].active) {
                activeInnerEdges.push(i);
            }
        }
        
        // Сбиваем до 5 случайных активных граней, но оставляем минимум 8
        const edgesToBreak = Math.max(0, Math.min(5, activeInnerEdges.length - 8, activeInnerEdges.length));
        for (let i = 0; i < edgesToBreak; i++) {
            const randomIndex = Math.floor(Math.random() * activeInnerEdges.length);
            const edgeIndex = activeInnerEdges[randomIndex];
            this.innerPolygon.edges[edgeIndex].active = false;
            activeInnerEdges.splice(randomIndex, 1);
        }
        
        // Увеличиваем скорость шарика
        this.BALL_SPEED = Math.min(this.BALL_SPEED * 1.25, this.MAX_BALL_SPEED);
        if (this.ball) {
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
            if (speed > 0) {
                const normalizedSpeed = Math.min(speed * 1.25, this.MAX_BALL_SPEED);
                this.ball.vx = (this.ball.vx / speed) * normalizedSpeed;
                this.ball.vy = (this.ball.vy / speed) * normalizedSpeed;
            }
        }
        
        // Увеличиваем скорость вращения внутреннего многоугольника
        this.innerPolygon.rotSpeed *= 1.5;
        
        // Включаем режим эскалации для визуального эффекта
        this.isEscalated = true;
        this.escalationVisualUntil = Date.now() + 3000;
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
            player.place = null;
        });
        
        this.gameState = 'preparation';
        this.prepStartTime = Date.now();
        this.roundNumber = 1;
        this.isEscalated = false;
        this.escalationVisualUntil = 0;
        this.lastEliminated = null;
        this.lastEliminatedAt = 0;
        this.BALL_SPEED = 260; // сброс скорости
        this.innerPolygon.rotSpeed = this.INNER_ROT_SPEED; // сброс скорости вращения
        
        this.createPolygons();
        this.resetBall();
    },
    
    destroy() {
        this.players = [];
        this.innerPolygon = null;
        this.outerPolygon = null;
        this.ball = null;
        this.particles = [];
        this.arena = null;
        this.gameManager = null;
        this.gameState = 'finished';
    }
};

// Экспортируем глобально для доступа из других скриптов
window.PolygonRouletteGame = PolygonRouletteGame;
