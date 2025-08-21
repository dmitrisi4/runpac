# План реализации функции "Пауза" для GPS-трекинга

## Обзор функции
Добавление возможности приостанавливать GPS-трекинг во время пробежки без завершения сессии, с последующим возобновлением трекинга.

## Текущее состояние
- **Start Run**: начинает трекинг
- **Stop Run**: завершает трекинг и сохраняет данные
- **Simulate Run**: демонстрационный режим

## Новая функциональность

### Состояния трекинга
1. **Stopped** (остановлен) - начальное состояние
2. **Running** (активен) - GPS-трекинг включен
3. **Paused** (на паузе) - трекинг приостановлен, но сессия не завершена

### UI изменения

#### Кнопки управления
- **Start Run** → **Pause** (когда активен)
- **Pause** → **Resume** (когда на паузе)
- **Stop Run** (всегда доступна во время активной сессии)

#### Визуальные индикаторы
- Изменение цвета кнопок в зависимости от состояния
- Отображение времени паузы
- Индикатор текущего состояния трекинга

## Техническая реализация

### 1. Новые состояния (State Management)

```javascript
// Добавить новые состояния
const [isPaused, setIsPaused] = useState<boolean>(false);
const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
const [totalPauseTime, setTotalPauseTime] = useState<number>(0);
const [trackingState, setTrackingState] = useState<'stopped' | 'running' | 'paused'>('stopped');
```

### 2. Функции управления

#### handlePauseTracking()
```javascript
const handlePauseTracking = () => {
  if (watchId.current) {
    navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }
  setIsPaused(true);
  setPauseStartTime(Date.now());
  setTrackingState('paused');
  console.log('GPS tracking paused');
};
```

#### handleResumeTracking()
```javascript
const handleResumeTracking = () => {
  if (pauseStartTime) {
    const pauseDuration = Date.now() - pauseStartTime;
    setTotalPauseTime(prev => prev + pauseDuration);
    setPauseStartTime(null);
  }
  
  setIsPaused(false);
  setTrackingState('running');
  
  // Возобновить GPS-трекинг
  startGPSTracking();
  console.log('GPS tracking resumed');
};
```

#### Модификация handleStopTracking()
```javascript
const handleStopTracking = () => {
  // Учесть время паузы при расчете общего времени
  let finalPauseTime = totalPauseTime;
  if (isPaused && pauseStartTime) {
    finalPauseTime += Date.now() - pauseStartTime;
  }
  
  const actualDuration = Math.floor((Date.now() - startTime - finalPauseTime) / 1000);
  
  // Сброс состояний паузы
  setIsPaused(false);
  setPauseStartTime(null);
  setTotalPauseTime(0);
  setTrackingState('stopped');
  
  // Остальная логика сохранения...
};
```

### 3. UI компоненты

#### Динамические кнопки
```javascript
const renderControlButtons = () => {
  switch (trackingState) {
    case 'stopped':
      return (
        <>
          <button onClick={handleStartTracking}>Start Run</button>
          <button onClick={handleSimulateRun}>Simulate Run</button>
        </>
      );
    
    case 'running':
      return (
        <>
          <button onClick={handlePauseTracking}>Pause</button>
          <button onClick={handleStopTracking}>Stop Run</button>
        </>
      );
    
    case 'paused':
      return (
        <>
          <button onClick={handleResumeTracking}>Resume</button>
          <button onClick={handleStopTracking}>Stop Run</button>
        </>
      );
  }
};
```

#### Индикатор состояния
```javascript
const StatusIndicator = () => {
  const getStatusText = () => {
    switch (trackingState) {
      case 'running': return 'Трекинг активен';
      case 'paused': return 'Трекинг на паузе';
      default: return 'Трекинг остановлен';
    }
  };
  
  return (
    <div className={`status-indicator ${trackingState}`}>
      {getStatusText()}
    </div>
  );
};
```

### 4. Отображение времени

#### Компонент таймера
```javascript
const RunTimer = () => {
  const [displayTime, setDisplayTime] = useState(0);
  
  useEffect(() => {
    if (trackingState === 'running' && startTime) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime - totalPauseTime;
        setDisplayTime(Math.floor(elapsed / 1000));
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [trackingState, startTime, totalPauseTime]);
  
  return (
    <div className="run-timer">
      Время: {formatDuration(displayTime)}
      {isPaused && <span className="pause-indicator"> (ПАУЗА)</span>}
    </div>
  );
};
```

## Этапы реализации

### Этап 1: Базовая функциональность (Высокий приоритет)
1. Добавить состояния паузы в компонент
2. Реализовать функции pause/resume
3. Модифицировать логику кнопок
4. Обновить расчет времени с учетом пауз

### Этап 2: UI улучшения (Средний приоритет)
1. Добавить индикатор состояния трекинга
2. Реализовать таймер в реальном времени
3. Добавить визуальные эффекты для состояний
4. Улучшить стилизацию кнопок

### Этап 3: Дополнительные функции (Низкий приоритет)
1. Звуковые уведомления при паузе/возобновлении
2. Автопауза при потере GPS-сигнала
3. Статистика времени пауз в истории
4. Настройки автопаузы

## Технические детали

### Обработка GPS при паузе
- Полная остановка `watchPosition` для экономии батареи
- Сохранение последней позиции для корректного возобновления
- Фильтрация первых точек после возобновления (возможные скачки)

### Сохранение данных
```javascript
interface SavedRun {
  id: string;
  date: string;
  path: LatLngTuple[];
  distance: number;
  duration: number; // активное время без пауз
  totalTime: number; // общее время включая паузы
  pauseCount: number; // количество пауз
  pauseDuration: number; // общее время пауз
  capturedAreas: LatLngTuple[][];
}
```

### CSS стили
```css
.status-indicator {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  text-align: center;
}

.status-indicator.running {
  background-color: #4CAF50;
  color: white;
}

.status-indicator.paused {
  background-color: #FF9800;
  color: white;
}

.pause-indicator {
  color: #FF9800;
  font-weight: bold;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}
```

## Тестирование

### Сценарии тестирования
1. **Базовый цикл**: Start → Pause → Resume → Stop
2. **Множественные паузы**: Start → Pause → Resume → Pause → Resume → Stop
3. **Длительная пауза**: проверка корректности расчета времени
4. **Пауза без движения**: проверка GPS-фильтрации после возобновления
5. **Потеря GPS**: поведение при потере сигнала во время паузы

### Метрики для проверки
- Корректность расчета активного времени
- Точность общего времени пробежки
- Сохранение пути без разрывов
- Производительность и расход батареи

## Возможные проблемы и решения

### Проблема: Разрывы в GPS-треке
**Решение**: Добавить маркеры пауз в массив пути или использовать отдельные сегменты

### Проблема: Неточность времени
**Решение**: Использовать высокоточные timestamp'ы и валидацию данных

### Проблема: Потеря состояния при перезагрузке
**Решение**: Сохранять состояние паузы в localStorage

### Проблема: Батарея разряжается на паузе
**Решение**: Полная остановка GPS-трекинга, использование wake lock API

## Заключение
Функция паузы значительно улучшит пользовательский опыт, позволяя делать остановки во время пробежки без потери данных. Реализация разбита на этапы для постепенного внедрения и тестирования.