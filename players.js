// Логика управления командой (сбор, цвета, имена)

// Массив случайных русских имен (минимум 100)
const RUSSIAN_NAMES = [
    "Алексей", "Мария", "Дмитрий", "Анна", "Сергей", "Елена", "Андрей", "Ольга", "Михаил", "Наталья",
    "Владимир", "Ирина", "Александр", "Татьяна", "Константин", "Юлия", "Иван", "Светлана", "Роман", "Ксения",
    "Павел", "Екатерина", "Николай", "Алина", "Артём", "Виктория", "Григорий", "Марина", "Степан", "Дарья",
    "Борис", "Анастасия", "Фёдор", "Полина", "Максим", "Валерия", "Евгений", "Яна", "Илья", "Вероника",
    "Арсений", "Алиса", "Даниил", "Милана", "Кирилл", "Кристина", "Леонид", "Агата", "Виталий", "Алёна",
    "Ярослав", "Зоя", "Руслан", "Ева", "Тимофей", "Мирослава", "Марк", "Амелия", "Денис", "Мадина",
    "Анатолий", "Лилия", "Олег", "Эвелина", "Георгий", "Милена", "Василий", "София", "Родион", "Арина",
    "Яков", "Василиса", "Адам", "Вера", "Эдуард", "Лада", "Филипп", "Луиза", "Богдан", "Регина",
    "Артемий", "Мэри", "Лев", "Камилла", "Семён", "Марта", "Елисей", "Марианна", "Миша", "Айша",
    "Димитрий", "Ариадна", "Глеб", "Алия", "Рустам", "Сабина", "Амир", "Аида", "Тимур", "Настасья",
    "Алан", "Мила", "Рамиль", "Айрат", "Дарим", "Айлин", "Арсен", "Айла", "Айдар", "Айгуль",
    "ДартКекс", "xXProGamerXx", "МистерКот", "СуперЗвезда", "МегаМозг", "Босс", "Король", "Принцесса",
    "Рыцарь", "Маг", "Воин", "Паладин", "Чародей", "Танк", "ДПС", "Хил", "Лучник", "Бард",
    "Ниндзя", "Шаман", "Жрец", "Монах", "Друид", "Охотник", "Разбойник", "Чернокнижник", "Паладин",
    "Механик", "Программист", "Дизайнер", "Архитектор", "Писатель", "Художник", "Музыкант", "Актёр",
    "Учитель", "Врач", "Инженер", "Физик", "Математик", "Биолог", "Химик", "Астроном", "Географ",
    "Историк", "Психолог", "Социолог", "Философ", "Филолог", "Лингвист", "Экономист", "Юрист", "Политик"
];

// Генерация 20 уникальных контрастных цветов
function generateUniqueColors(count = 20) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        // Равномерное распределение тона (HSL)
        const hue = (i * 360) / count;
        // Насыщенность и светлота для контрастности
        const saturation = 70 + Math.random() * 30; // 70-100%
        const lightness = 40 + Math.random() * 20;  // 40-60%
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
}

// Генерация случайных игроков
function generateRandomPlayers(count) {
    const players = [];
    const uniqueColors = generateUniqueColors(count);
    
    for (let i = 0; i < count; i++) {
        const randomName = RUSSIAN_NAMES[Math.floor(Math.random() * RUSSIAN_NAMES.length)];
        const playerName = `${randomName}${i > 0 ? i : ''}`; // Добавляем число к имени если не первый
        
        players.push({
            id: i,
            name: playerName,
            color: uniqueColors[i % uniqueColors.length],
            alive: true,
            eliminated: false,
            rank: null
        });
    }
    
    return players;
}

// Управление игроками
class PlayerManager {
    constructor() {
        this.players = [];
        this.originalPlayers = [];
    }
    
    setPlayers(players) {
        this.players = [...players];
        this.originalPlayers = [...players];
    }
    
    getAlivePlayers() {
        return this.players.filter(player => player.alive);
    }
    
    eliminatePlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            this.players[playerIndex].alive = false;
            this.players[playerIndex].eliminated = true;
            this.players[playerIndex].rank = this.getRemainingCount() + 1;
            return this.players[playerIndex];
        }
        return null;
    }
    
    getRemainingCount() {
        return this.getAlivePlayers().length;
    }
    
    hasWinner() {
        return this.getRemainingCount() === 1;
    }
    
    getWinner() {
        if (this.hasWinner()) {
            return this.getAlivePlayers()[0];
        }
        return null;
    }
    
    reset() {
        this.players = [...this.originalPlayers];
        this.players.forEach(player => {
            player.alive = true;
            player.eliminated = false;
            player.rank = null;
        });
    }
}

// Глобальная переменная для доступа к менеджеру игроков
window.PlayerManager = PlayerManager;
