// Игра "Микробная Колония"

const GridColonyGame = {
    name: "Микробная Колония",
    description: "Участники контролируют микробы на сетке, захватывают территории и расширяют свои колонии",
    icon: "🧬",
    
    arena: null,
    microbes: [],
    grid: [],
    gridWidth: 0,
    gridHeight: 0,
    cellSize: 0,
    callbacks: {},
    
    init(canvas, players, callbacks) {
        this.arena = {
            width: canvas.width,
            height: canvas.height,
            centerX: canvas.width / 2,
            centerY: canvas.height / 2
        };
        
        // Создаем сетку
        this.cellSize = 20;
        this.gridWidth = Math.floor(canvas.width / this.cellSize);
        this.gridHeight = Math.floor(canvas.height / this.cellSize);
        
        this.grid = Array(this.gridHeight).fill().map(() => 
            Array(this.gridWidth).fill(null)
        );
        
        this.microbes = players.map((player, index) => {
            // Распределяем игроков по углам арены
            let x, y;
            switch(index % 4) {
                case 0: // верхний левый
                    x = Math.floor(this.gridWidth * 0.2);
                    y = Math.floor(this.gridHeight * 0.2);
                    break;
                case 1: // верхний правый
                    x = Math.floor(this.gridWidth * 0.8);
                    y = Math.floor(this.gridHeight * 0.2);
                    break;
                case 2: // нижний левый
                    x = Math.floor(this.gridWidth * 0.2);
                    y = Math.floor(this.gridHeight * 0.8);
                    break;
                default: // нижний правый
                    x = Math.floor(this.gridWidth * 0.8);
                    y = Math.floor(this.gridHeight * 0.8);
                    break;
            }
            
            // Заполняем начальную территорию
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const gridX = x + i;
                    const gridY = y + j;
                    if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
                        this.grid[gridY][gridX] = player.id;
                    }
                }
            }
            
            return {
                ...player,
                x: x,
                y: y,
                territory: 9, // начальная территория
                energy: 100,
                maxEnergy: 200,
                moveCooldown: 0
            };
        });
        
        this.callbacks = callbacks;
    },
    
    update(dt) {
        // Обновляем микроорганизмы
        this.microbes.forEach(microbe => {
            if (!microbe.alive) return;
            
            // Уменьшаем кулдаун движения
            if (microbe.moveCooldown > 0) {
                microbe.moveCooldown -= dt;
            }
            
            // Потребление энергии
            microbe.energy -= 5 * dt;
            
            // Случайное движение если кулдаун прошел
            if (microbe.moveCooldown <= 0) {
                this.moveMicrobe(microbe);
                microbe.moveCooldown = 0.5; // кулдаун на движение
            }
            
            // Проверяем, не умер ли микроорганизм от недостатка энергии
            if (microbe.energy <= 0) {
                this.callbacks.eliminatePlayer(microbe.id);
            }
        });
        
        // Обновляем территории
        this.updateTerritories();
    },
    
    moveMicrobe(microbe) {
        // Случайное направление движения (-1, 0 или 1 по X и Y)
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        
        // Проверяем границы
        const newX = Math.max(0, Math.min(this.gridWidth - 1, microbe.x + dx));
        const newY = Math.max(0, Math.min(this.gridHeight - 1, microbe.y + dy));
        
        // Проверяем, кто владеет этой клеткой
        const occupantId = this.grid[newY][newX];
        
        if (occupantId === null) {
            // Пустая клетка - захватываем
            this.grid[newY][newX] = microbe.id;
            microbe.territory++;
            microbe.energy += 5; // бонус за захват территории
        } else if (occupantId !== microbe.id) {
            // Чужая территория - конфликт!
            const occupant = this.microbes.find(m => m.id === occupantId);
            if (occupant) {
                // Более крупная колония побеждает
                if (microbe.territory > occupant.territory) {
                    this.grid[newY][newX] = microbe.id;
                    microbe.territory++;
                    occupant.territory--;
                    
                    // Если у противника не осталось территории
                    if (occupant.territory <= 0) {
                        this.callbacks.eliminatePlayer(occupant.id);
                    }
                } else if (occupant.territory > microbe.territory) {
                    microbe.territory--;
                    
                    // Если у нас не осталось территории
                    if (microbe.territory <= 0) {
                        this.callbacks.eliminatePlayer(microbe.id);
                    }
                }
            }
        }
        
        // Обновляем позицию микроорганизма
        microbe.x = newX;
        microbe.y = newY;
    },
    
    updateTerritories() {
        // Каждый микроорганизм может расширять свою территорию
        this.microbes.forEach(microbe => {
            if (!microbe.alive) return;
            
            // Случайно расширяем территорию
            if (Math.random() < 0.02 && microbe.energy > 50) { // 2% шанс и достаточно энергии
                // Ищем соседние пустые клетки
                const neighbors = [];
                
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        if (i === 0 && j === 0) continue;
                        
                        const x = microbe.x + i;
                        const y = microbe.y + j;
                        
                        if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                            if (this.grid[y][x] === null) {
                                neighbors.push({x, y});
                            }
                        }
                    }
                }
                
                // Захватываем случайную соседнюю пустую клетку
                if (neighbors.length > 0) {
                    const target = neighbors[Math.floor(Math.random() * neighbors.length)];
                    this.grid[target.y][target.x] = microbe.id;
                    microbe.territory++;
                    microbe.energy -= 10; // расход энергии на расширение
                }
            }
        });
    },
    
    draw(ctx) {
        // Очищаем холст
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Рисуем сетку
        ctx.strokeStyle = 'rgba(100, 100, 150, 0.2)';
        ctx.lineWidth = 0.5;
        
        for (let x = 0; x <= this.gridWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize, 0);
            ctx.lineTo(x * this.cellSize, ctx.canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= this.gridHeight; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.cellSize);
            ctx.lineTo(ctx.canvas.width, y * this.cellSize);
            ctx.stroke();
        }
        
        // Рисуем территории
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const ownerId = this.grid[y][x];
                if (ownerId !== null) {
                    const owner = this.microbes.find(m => m.id === ownerId);
                    if (owner && owner.alive) {
                        ctx.fillStyle = owner.color;
                        ctx.globalAlpha = 0.3;
                        ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                        ctx.globalAlpha = 1.0;
                    }
                }
            }
        }
        
        // Рисуем микроорганизмы
        this.microbes.forEach(microbe => {
            if (!microbe.alive) return;
            
            const pixelX = microbe.x * this.cellSize + this.cellSize / 2;
            const pixelY = microbe.y * this.cellSize + this.cellSize / 2;
            
            // Основной микроорганизм
            ctx.beginPath();
            ctx.arc(pixelX, pixelY, this.cellSize * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = microbe.color;
            ctx.fill();
            
            // Внутренняя структура
            ctx.beginPath();
            ctx.arc(pixelX, pixelY, this.cellSize * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
            
            // Обводка
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Индикатор энергии
            const energyPercent = microbe.energy / microbe.maxEnergy;
            ctx.fillStyle = energyPercent > 0.5 ? '#00ff00' : energyPercent > 0.25 ? '#ffff00' : '#ff0000';
            ctx.fillRect(
                pixelX - this.cellSize * 0.4, 
                pixelY - this.cellSize * 0.6, 
                this.cellSize * 0.8 * energyPercent, 
                4
            );
            
            // Индикатор территории
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(microbe.territory.toString(), pixelX, pixelY + 5);
        });
    },
    
    onEscalation() {
        // При эскалации увеличиваем скорость захвата территории и снижаем энергетические затраты
        this.microbes.forEach(microbe => {
            if (microbe.alive) {
                microbe.energy = Math.min(microbe.energy + 50, microbe.maxEnergy);
            }
        });
    },
    
    destroy() {
        this.microbes = [];
        this.grid = [];
        this.arena = null;
        this.callbacks = {};
    }
};
