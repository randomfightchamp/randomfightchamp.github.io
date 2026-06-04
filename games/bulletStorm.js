// Игра "Сужающийся Шторм"

const BulletStormGame = {
    name: "Сужающийся Шторм",
    description: "По мере развития игры область безопасной зоны сужается, и участники должны уклоняться от снарядов",
    icon: "🌀",
    
    arena: null,
    players: [],
    callbacks: {},
    bullets: [],
    safeZoneRadius: 0,
    shrinkSpeed: 0,
    
    init(canvas, players, callbacks) {
        this.arena = {
            width: canvas.width,
            height: canvas.height,
            centerX: canvas.width / 2,
            centerY: canvas.height / 2,
            radius: Math.min(canvas.width, canvas.height) * 0.45
        };
        
        this.players = players.map(player => ({
            ...player,
            x: this.arena.centerX + (Math.random() - 0.5) * this.arena.radius * 0.8,
            y: this.arena.centerY + (Math.random() - 0.5) * this.arena.radius * 0.8,
            radius: 10,
            speed: 100,
            angle: Math.random() * Math.PI * 2
        }));
        
        this.bullets = [];
        this.safeZoneRadius = this.arena.radius;
        this.shrinkSpeed = 0.5; // пикселей в секунду
        this.callbacks = callbacks;
        
        // Создаем начальные пули
        this.spawnBullets(10);
    },
    
    update(dt) {
        // Сужаем безопасную зону
        this.safeZoneRadius -= this.shrinkSpeed * dt;
        
        // Обновляем игроков
        this.players.forEach(player => {
            if (!player.alive) return;
            
            // Движение игрока (вращение вокруг центра)
            player.angle += 0.5 * dt;
            const distanceFromCenter = Math.sqrt(
                Math.pow(player.x - this.arena.centerX, 2) + 
                Math.pow(player.y - this.arena.centerY, 2)
            );
            
            // Поддерживаем дистанцию от центра
            if (distanceFromCenter < this.arena.radius * 0.7) {
                const targetX = this.arena.centerX + Math.cos(player.angle) * (this.arena.radius * 0.7);
                const targetY = this.arena.centerY + Math.sin(player.angle) * (this.arena.radius * 0.7);
                
                const dx = targetX - player.x;
                const dy = targetY - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 1) {
                    player.x += (dx / dist) * player.speed * dt;
                    player.y += (dy / dist) * player.speed * dt;
                }
            }
            
            // Проверяем, не вышел ли игрок за пределы безопасной зоны
            const playerDistFromCenter = Math.sqrt(
                Math.pow(player.x - this.arena.centerX, 2) + 
                Math.pow(player.y - this.arena.centerY, 2)
            );
            
            if (playerDistFromCenter > this.safeZoneRadius - player.radius) {
                this.callbacks.eliminatePlayer(player.id);
            }
        });
        
        // Обновляем пули
        this.bullets = this.bullets.filter(bullet => {
            // Движение пули
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            
            // Проверка столкновений с игроками
            this.players.forEach(player => {
                if (!player.alive) return;
                
                const dx = bullet.x - player.x;
                const dy = bullet.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < bullet.radius + player.radius) {
                    this.callbacks.eliminatePlayer(player.id);
                }
            });
            
            // Удаляем пулю, если она вышла за пределы арены
            const distFromCenter = Math.sqrt(
                Math.pow(bullet.x - this.arena.centerX, 2) + 
                Math.pow(bullet.y - this.arena.centerY, 2)
            );
            
            return distFromCenter < this.arena.radius + 50;
        });
        
        // Случайно создаем новые пули
        if (Math.random() < 0.1) {
            this.spawnBullets(1);
        }
    },
    
    spawnBullets(count) {
        for (let i = 0; i < count; i++) {
            // Создаем пулю из внешней области
            const angle = Math.random() * Math.PI * 2;
            const startX = this.arena.centerX + Math.cos(angle) * this.arena.radius;
            const startY = this.arena.centerY + Math.sin(angle) * this.arena.radius;
            
            // Направляем пулю к центру
            const dx = this.arena.centerX - startX;
            const dy = this.arena.centerY - startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const speed = 150 + Math.random() * 100;
            
            this.bullets.push({
                x: startX,
                y: startY,
                vx: (dx / dist) * speed,
                vy: (dy / dist) * speed,
                radius: 5,
                color: '#ff00aa'
            });
        }
    },
    
    draw(ctx) {
        // Очищаем холст
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Рисуем арену
        ctx.beginPath();
        ctx.arc(this.arena.centerX, this.arena.centerY, this.arena.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff00aa';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Рисуем безопасную зону
        ctx.beginPath();
        ctx.arc(this.arena.centerX, this.arena.centerY, this.safeZoneRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Рисуем пули
        this.bullets.forEach(bullet => {
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            ctx.fillStyle = bullet.color;
            ctx.fill();
            
            // Эффект свечения
            ctx.shadowColor = bullet.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        
        // Рисуем игроков
        this.players.forEach(player => {
            if (!player.alive) return;
            
            // Тело игрока
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.fill();
            
            // Обводка игрока
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Индикатор направления движения
            ctx.beginPath();
            ctx.arc(
                player.x + Math.cos(player.angle) * player.radius * 1.5,
                player.y + Math.sin(player.angle) * player.radius * 1.5,
                3, 0, Math.PI * 2
            );
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        });
    },
    
    onEscalation() {
        // При эскалации увеличиваем количество и скорость пуль
        this.shrinkSpeed *= 1.5;
        
        // Добавляем больше пуль
        this.spawnBullets(20);
    },
    
    destroy() {
        this.players = [];
        this.bullets = [];
        this.arena = null;
        this.callbacks = {};
    }
};
