// Variables globales
let currentUser = null;
let users = JSON.parse(localStorage.getItem('users')) || [];
let notificationsEnabled = JSON.parse(localStorage.getItem('notificationsEnabled')) || false;

// ID del interval para recordatorios periódicos (para poder limpiarlo)
let periodicReminderIntervalId = null;
// Intervalo por defecto en minutos para recordatorios periódicos
const DEFAULT_PERIODIC_MINUTES = 5;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    requestNotificationPermission();
    // scheduleNotifications solo agenda notificaciones diarias si notificationsEnabled === true
    scheduleNotifications();
    // Si las notificaciones están activas al cargar, inicia recordatorios periódicos
    if (notificationsEnabled) {
        startPeriodicReminders(DEFAULT_PERIODIC_MINUTES);
    }
});

// Función para verificar sesión
function checkSession() {
    const session = JSON.parse(localStorage.getItem('currentSession'));
    if (session && session.email) {
        currentUser = users.find(u => u.email === session.email);
        if (currentUser) {
            showScreen('homeScreen');
            updateDashboard();
        }
    }
}

// Registro de usuario
function register() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const age = document.getElementById('registerAge').value;
    const password = document.getElementById('registerPassword').value;

    if (!name || !email || !age || !password) {
        showToast('Por favor completa todos los campos');
        return;
    }

    if (users.find(u => u.email === email)) {
        showToast('Este correo ya está registrado');
        return;
    }

    const newUser = {
        name,
        email,
        age: parseInt(age),
        password,
        workouts: [],
        meditations: [],
        moods: [],
        journals: [],
        streak: 0,
        lastActivity: null
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    showToast('¡Registro exitoso! Ahora puedes iniciar sesión');
    showLogin();
}

// Inicio de sesión
function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Por favor ingresa tu correo y contraseña');
        return;
    }

    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        currentUser = user;
        localStorage.setItem('currentSession', JSON.stringify({ email }));
        showScreen('homeScreen');
        updateDashboard();
        showToast(`¡Bienvenido, ${user.name}!`);
        
        // Notificación de bienvenida
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Bienvenido de vuelta', {
                body: `¡Hola ${user.name}! Es genial verte de nuevo.`,
                icon: '🏠'
            });
        }
    } else {
        showToast('Correo o contraseña incorrectos');
    }
}

// Cerrar sesión
function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        localStorage.removeItem('currentSession');
        currentUser = null;
        showScreen('loginScreen');
        showToast('Sesión cerrada');
    }
}

// Mostrar formulario de registro
function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Mostrar formulario de login
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

// Cambiar entre pantallas
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    // Actualizar navegación activa
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (screenId !== 'loginScreen') {
        updateDashboard();
    }
}

// Actualizar dashboard
function updateDashboard() {
    if (!currentUser) return;

    // Actualizar nombre en home
    document.getElementById('welcomeMessage').textContent = `Hola, ${currentUser.name}`;

    // Actualizar perfil
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileAge').textContent = currentUser.age;

    // Calcular estadísticas
    const workoutCount = currentUser.workouts.length;
    const meditationCount = currentUser.meditations.length;
    const journalCount = currentUser.journals.length;
    
    const totalMinutes = 
        currentUser.workouts.reduce((sum, w) => sum + (w.duration || 0), 0) +
        currentUser.meditations.reduce((sum, m) => sum + (m.duration || 0), 0);

    // Actualizar contadores
    document.getElementById('workoutCount').textContent = workoutCount;
    document.getElementById('meditationCount').textContent = meditationCount;
    document.getElementById('journalCount').textContent = journalCount;
    document.getElementById('totalMinutes').textContent = totalMinutes;

    // Calcular resumen semanal (últimos 7 días)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyExercise = currentUser.workouts
        .filter(w => new Date(w.date) > weekAgo)
        .reduce((sum, w) => sum + (w.duration || 0), 0);

    const weeklyMeditation = currentUser.meditations
        .filter(m => new Date(m.date) > weekAgo)
        .reduce((sum, m) => sum + (m.duration || 0), 0);

    document.getElementById('weeklyExercise').textContent = `${weeklyExercise} min`;
    document.getElementById('weeklyMeditation').textContent = `${weeklyMeditation} min`;

    // Actualizar racha
    updateStreak();
    document.getElementById('streakCount').textContent = currentUser.streak;
    document.getElementById('currentStreak').textContent = `${currentUser.streak} días`;

    // Actualizar historial de ánimo
    updateMoodHistory();

    // Actualizar entradas de diario
    updateJournalEntries();

    // Guardar cambios
    saveUsers();
}

// Actualizar racha
function updateStreak() {
    if (!currentUser.lastActivity) {
        currentUser.streak = 0;
        return;
    }

    const lastDate = new Date(currentUser.lastActivity);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Mismo día, mantener racha
    } else if (diffDays === 1) {
        // Día consecutivo, incrementar racha
        currentUser.streak++;
    } else {
        // Se rompió la racha
        currentUser.streak = 1;
    }

    currentUser.lastActivity = new Date().toISOString();
}

// Iniciar ejercicio
function startExercise(name, duration, reps, sets) {
    if (confirm(`¿Comenzar ${name}?`)) {
        const workout = {
            name,
            duration,
            reps,
            sets,
            date: new Date().toISOString()
        };

        currentUser.workouts.push(workout);
        updateStreak();
        saveUsers();
        updateDashboard();
        
        showToast(`¡Excelente! ${name} completado`);
        
        // Notificación
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('¡Entrenamiento completado!', {
                body: `Has completado ${name}. ¡Sigue así!`,
                icon: '🏋️'
            });
        }
    }
}

// Iniciar meditación
function startMeditation(name, duration, type) {
    if (confirm(`¿Comenzar ${name}?`)) {
        const meditation = {
            name,
            duration,
            type,
            date: new Date().toISOString()
        };

        currentUser.meditations.push(meditation);
        updateStreak();
        saveUsers();
        updateDashboard();
        
        showToast(`Meditación ${name} completada`);
        
        // Notificación
        if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Meditación completada', {
                body: `Has completado ${name}. Tu mente lo agradece.`,
                icon: '🧘'
            });
        }
    }
}

// Mostrar modal de mood tracker
function showMoodTracker() {
    document.getElementById('moodModal').classList.add('active');
}

// Guardar mood
function saveMood(mood, emoji) {
    const moodEntry = {
        mood,
        emoji,
        date: new Date().toISOString()
    };

    currentUser.moods.push(moodEntry);
    updateStreak();
    saveUsers();
    updateDashboard();
    closeModal('moodModal');
    
    showToast('Estado de ánimo registrado');
    
    // Notificación
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Ánimo registrado', {
            body: `Has registrado: ${mood}`,
            icon: emoji
        });
    }
}

// Actualizar historial de ánimo
function updateMoodHistory() {
    const container = document.getElementById('moodHistory');
    
    if (!currentUser || currentUser.moods.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay registros de ánimo</p>';
        return;
    }

    const recentMoods = currentUser.moods.slice(-10).reverse();
    
    container.innerHTML = recentMoods.map(mood => {
        const date = new Date(mood.date);
        return `
            <div class="mood-entry">
                <div class="mood-entry-header">
                    <div>
                        <span class="mood-emoji">${mood.emoji}</span>
                        <span class="mood-label">${mood.mood}</span>
                    </div>
                    <span class="mood-date">${formatDate(date)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Mostrar modal de journal
function showJournal() {
    document.getElementById('journalModal').classList.add('active');
    document.getElementById('journalText').value = '';
}

// Guardar journal
function saveJournal() {
    const text = document.getElementById('journalText').value.trim();
    
    if (!text) {
        showToast('Por favor escribe algo en tu diario');
        return;
    }

    const journalEntry = {
        text,
        date: new Date().toISOString()
    };

    currentUser.journals.push(journalEntry);
    updateStreak();
    saveUsers();
    updateDashboard();
    closeModal('journalModal');
    
    showToast('Entrada de diario guardada');
    
    // Notificación
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Diario actualizado', {
            body: 'Has agregado una nueva entrada a tu diario.',
            icon: '📝'
        });
    }
}

// Actualizar entradas de diario
function updateJournalEntries() {
    const container = document.getElementById('journalEntries');
    
    if (!currentUser || currentUser.journals.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay entradas de diario</p>';
        return;
    }

    const recentJournals = currentUser.journals.slice(-10).reverse();
    
    container.innerHTML = recentJournals.map(journal => {
        const date = new Date(journal.date);
        return `
            <div class="journal-entry">
                <div class="journal-date">${formatDate(date)}</div>
                <p class="journal-text">${journal.text}</p>
            </div>
        `;
    }).join('');
}

// Cerrar modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Formatear fecha
function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} h`;
    if (days < 7) return `Hace ${days} días`;
    
    return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

// Mostrar toast
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) {
        // Si no existe el toast en el DOM, crea uno temporal
        const temp = document.createElement('div');
        temp.textContent = message;
        temp.style.position = 'fixed';
        temp.style.top = '20px';
        temp.style.left = '50%';
        temp.style.transform = 'translateX(-50%)';
        temp.style.background = '#4ade80';
        temp.style.color = '#000';
        temp.style.padding = '12px 18px';
        temp.style.borderRadius = '12px';
        temp.style.zIndex = 9999;
        document.body.appendChild(temp);
        setTimeout(() => temp.remove(), 3000);
        return;
    }
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Guardar usuarios
function saveUsers() {
    const userIndex = users.findIndex(u => u.email === currentUser.email);
    if (userIndex !== -1) {
        users[userIndex] = currentUser;
        localStorage.setItem('users', JSON.stringify(users));
    }
}

// Solicitar permiso para notificaciones
function requestNotificationPermission() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                localStorage.setItem('notificationsEnabled', JSON.stringify(true));
                showToast('Notificaciones activadas');
                // Si activamos permiso, iniciamos recordatorios periódicos
                startPeriodicReminders(DEFAULT_PERIODIC_MINUTES);
            } else if (permission === 'denied') {
                notificationsEnabled = false;
                localStorage.setItem('notificationsEnabled', JSON.stringify(false));
                showToast('Notificaciones bloqueadas en el navegador');
            }
        });
    } else if (Notification.permission === 'granted') {
        // Ya había sido concedido; respetar el valor almacenado en notificationsEnabled
        if (notificationsEnabled) startPeriodicReminders(DEFAULT_PERIODIC_MINUTES);
    }
}

// Toggle notificaciones
function toggleNotifications() {
    if (!('Notification' in window)) {
        showToast('Tu navegador no soporta notificaciones');
        return;
    }

    if (Notification.permission === 'granted') {
        notificationsEnabled = !notificationsEnabled;
        localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
        showToast(notificationsEnabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas');

        if (notificationsEnabled) {
            // Iniciar recordatorios periódicos y programar notificaciones diarias
            startPeriodicReminders(DEFAULT_PERIODIC_MINUTES);
            scheduleNotifications();
        } else {
            // Parar recordatorios periódicos
            stopPeriodicReminders();
        }
    } else if (Notification.permission === 'default') {
        // Pedir permiso y al conceder, activamos
        requestNotificationPermission();
    } else {
        showToast('Debes permitir notificaciones en la configuración del navegador');
    }
}
// Programar notificaciones diarias (mantengo tu lógica original)
function scheduleNotifications() {
    if (!notificationsEnabled || !('Notification' in window)) return;


    // Notificación de ejercicio matutino (9:00 AM)
    scheduleNotification('¡Buenos días!', 'Es hora de tu ejercicio matutino 🏋️', 9, 0);

    // Notificación de meditación (12:00 PM)
    scheduleNotification('Momento de calma', 'Tómate un momento para meditar 🧘', 12, 0);

    // Notificación de diario nocturno (9:00 PM)
    scheduleNotification('Reflexiona sobre tu día', 'Escribe en tu diario antes de dormir 📝', 21, 0);
}

// Programar una notificación específica
function scheduleNotification(title, body, hour, minute) {
    if (!notificationsEnabled || Notification.permission !== 'granted') return;

    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilNotification = scheduledTime - now;

    setTimeout(() => {
        if (notificationsEnabled && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '🔔',
                badge: '🔔'
            });
        }
        
        // Reprogramar para el día siguiente (si siguen activadas)
        scheduleNotification(title, body, hour, minute);
    }, timeUntilNotification);
}

// -- NUEVAS FUNCIONES: RECORDATORIOS PERIÓDICOS (cada X minutos) --

// Inicia recordatorios periódicos cada 'minutes' minutos (no crea varios intervals)
function startPeriodicReminders(minutes = DEFAULT_PERIODIC_MINUTES) {
    // Si ya existe un interval, no crear otro
    if (periodicReminderIntervalId) return;

    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Enviar un recordatorio inmediato (opcional — ayuda a probar)
    sendRandomReminder();

    // Programar repetición
    periodicReminderIntervalId = setInterval(() => {
        if (notificationsEnabled && Notification.permission === 'granted') {
            sendRandomReminder();
        }
    }, minutes * 60 * 1000);
}

// Detiene recordatorios periódicos
function stopPeriodicReminders() {
    if (periodicReminderIntervalId) {
        clearInterval(periodicReminderIntervalId);
        periodicReminderIntervalId = null;
    }
}

// Enviar recordatorio aleatorio (mensajes tipo medita / mueve / hidrata)
function sendRandomReminder() {
    const messages = [
        { title: "Momento de Meditar 🧘", msg: "Respira profundo 2 minutos para relajarte." },
        { title: "Hora de Moverse 🏋️", msg: "Haz un estiramiento rápido de 1–2 minutos." },
        { title: "Hidrátate 💧", msg: "Toma un vaso de agua ahora." },
        { title: "Chequeo Rápido 😊", msg: "¿Cómo te sientes? Registra tu ánimo en la app." },
        { title: "Descanso Mental 😌", msg: "Cierra los ojos y descansa 60 segundos." }
    ];

    const random = messages[Math.floor(Math.random() * messages.length)];

    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(random.title, {
            body: random.msg,
            icon: '🔔'
        });
    }
}

// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Datos de ejemplo para testing
function createSampleData() {
    if (!currentUser) return;
    
    // Agregar algunos entrenamientos de ejemplo
    for (let i = 0; i < 5; i++) {
        currentUser.workouts.push({
            name: 'Push-ups',
            duration: 3,
            date: new Date(Date.now() - i * 86400000).toISOString()
        });
    }

    // Agregar algunas meditaciones de ejemplo
    for (let i = 0; i < 3; i++) {
        currentUser.meditations.push({
            name: 'Morning Mindfulness',
            duration: 10,
            date: new Date(Date.now() - i * 86400000).toISOString()
        });
    }

    // Agregar algunos moods de ejemplo
    const moods = [
        { mood: 'Feliz', emoji: '😊' },
        { mood: 'Muy feliz', emoji: '😄' },
        { mood: 'Normal', emoji: '😐' }
    ];

    for (let i = 0; i < 3; i++) {
        const randomMood = moods[Math.floor(Math.random() * moods.length)];
        currentUser.moods.push({
            ...randomMood,
            date: new Date(Date.now() - i * 86400000).toISOString()
        });
    }

    // Agregar algunas entradas de diario
    currentUser.journals.push({
        text: 'Hoy fue un gran día. Completé mi rutina de ejercicios y me siento lleno de energía.',
        date: new Date().toISOString()
    });

    currentUser.streak = 5;
    currentUser.lastActivity = new Date().toISOString();

    saveUsers();
    updateDashboard();
    showToast('Datos de ejemplo agregados');
}

// Función para debugging (puede ser llamada desde la consola)
window.createSampleData = createSampleData;
