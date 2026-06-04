// Общие утилиты отрисовки (Canvas helpers)

class Renderer {
    static drawCircle(ctx, x, y, radius, color) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    static drawRectangle(ctx, x, y, width, height, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
    }
    
    static drawPolygon(ctx, centerX, centerY, radius, sides, color, rotation = 0) {
        ctx.beginPath();
        
        for (let i = 0; i < sides; i++) {
            const angle = rotation + (i * 2 * Math.PI / sides);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    static drawText(ctx, text, x, y, fontSize = 16, color = '#ffffff', textAlign = 'left') {
        ctx.font = `${fontSize}px Roboto, Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = textAlign;
        ctx.fillText(text, x, y);
    }
    
    static drawCenteredText(ctx, text, x, y, fontSize = 16, color = '#ffffff') {
        ctx.font = `${fontSize}px Roboto, Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
    }
    
    static drawLine(ctx, x1, y1, x2, y2, color = '#ffffff', lineWidth = 1) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
    
    static drawGradientCircle(ctx, x, y, radius, innerColor, outerColor) {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, innerColor);
        gradient.addColorStop(1, outerColor);
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }
    
    static drawDashedLine(ctx, x1, y1, x2, y2, color = '#ffffff', lineWidth = 1, dashLength = 10) {
        ctx.beginPath();
        ctx.setLineDash([dashLength, dashLength]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    static drawParticleField(ctx, particles, size = 2) {
        particles.forEach(particle => {
            ctx.fillStyle = particle.color;
            ctx.globalAlpha = particle.alpha || 1;
            ctx.fillRect(particle.x, particle.y, size, size);
        });
        ctx.globalAlpha = 1;
    }
    
    static drawProgressBar(ctx, x, y, width, height, progress, bgColor = '#333', fillColor = '#00ffcc') {
        // Фон прогресс-бара
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, height);
        
        // Заполнение прогресс-бара
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, width * progress, height);
        
        // Рамка
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }
    
    static drawHealthBar(ctx, x, y, width, height, healthPercent, maxHealth = 100) {
        const barWidth = width;
        const barHeight = height;
        
        // Фон здоровья
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Полоса здоровья
        const healthWidth = (healthPercent / maxHealth) * barWidth;
        ctx.fillStyle = healthPercent > 50 ? '#00ff00' : healthPercent > 25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(x, y, healthWidth, barHeight);
        
        // Рамка
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
    
    static drawNeonGlow(ctx, x, y, width, height, color, intensity = 10) {
        ctx.shadowColor = color;
        ctx.shadowBlur = intensity;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        ctx.shadowBlur = 0;
    }
    
    static drawPulseEffect(ctx, centerX, centerY, maxRadius, duration = 1000) {
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = (elapsed % duration) / duration;
            const currentRadius = progress * maxRadius;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 204, ${1 - progress})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (elapsed < duration) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    static clearCanvas(ctx, canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    static resizeCanvas(canvas, width, height) {
        canvas.width = width;
        canvas.height = height;
    }
    
    static getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    
    static interpolateColor(color1, color2, factor) {
        const r1 = parseInt(color1.substring(1, 3), 16);
        const g1 = parseInt(color1.substring(3, 5), 16);
        const b1 = parseInt(color1.substring(5, 7), 16);
        
        const r2 = parseInt(color2.substring(1, 3), 16);
        const g2 = parseInt(color2.substring(3, 5), 16);
        const b2 = parseInt(color2.substring(5, 7), 16);
        
        const r = Math.round(r1 + factor * (r2 - r1));
        const g = Math.round(g1 + factor * (g2 - g1));
        const b = Math.round(b1 + factor * (b2 - b1));
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    static drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
}

// Глобальная функция для удобства
window.Renderer = Renderer;
