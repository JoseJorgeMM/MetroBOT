# Especificación de Diseño: Navegación Peatonal en Tiempo Real (Estilo Google Maps)

**Fecha:** 2026-07-27  
**Estado:** Aprobado por el usuario  
**Tecnología:** React + TypeScript + MapLibre GL + Web APIs (Geolocation, Speech, Wake Lock, Device Orientation)

---

## 1. Objetivos y Alcance
El objetivo es transformar la experiencia de navegación de caminata actual (que es estática y en 2D) en un sistema dinámico, en tiempo real y en 3D que emule a Google Maps cuando se ejecuta en navegadores móviles (iOS/Android), sin consumir APIs de pago ni requerir tarjetas de crédito.

### Enfoque:
* **Exclusivamente Peatonal:** El guiado activo en tiempo real (giro a giro) se ejecutará únicamente en los tramos de caminata (caminar de origen a estación, transbordos, y caminata de estación a destino).
* **Tránsito Simulado/Pausado:** Durante los tramos de transporte (Metro, Buses), la navegación se pausará en la estación de abordaje y esperará la interacción del usuario ("Siguiente tramo") para reanudar el guiado a pie al bajarse.

---

## 2. Arquitectura de Visualización (MapLibre GL Vectorial 3D)

Reemplazaremos `react-leaflet` por **MapLibre GL** y **react-map-gl/maplibre** para habilitar WebGL y rendimiento nativo en móviles.

### 2.1 Dependencias a Instalar
```json
{
  "dependencies": {
    "maplibre-gl": "^4.5.0",
    "react-map-gl": "^8.1.0"
  }
}
```

### 2.2 Estilo de Mapa Vectorial Gratuito
Utilizaremos las teselas y estilos vectoriales de **CartoDB Voyager GL**, que son completamente libres y gratuitas (licencia OpenStreetMap):
* **Style URL:** `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`

### 2.3 Controlador de Cámara y Vista de Navegación (3D)
Cuando `isNavigating` sea verdadero y se disponga de la posición del usuario:
* **Pitch (Inclinación):** Se forzará la cámara del mapa a `60` grados para dar el efecto de perspectiva 3D desde atrás.
* **Bearing (Rotación):** Se alineará el ángulo del mapa con el rumbo del usuario (`userHeading`), permitiendo que el mapa gire automáticamente según la orientación del teléfono.
* **Seguimiento Automático:** El centro del mapa se mantendrá fijo en `userPosition`.
* **Recentrado Táctil:** Si el usuario realiza un gesto manual de arrastre (*pan*), el seguimiento se pausará temporalmente y se mostrará un botón de **"Recentrar"**. Al presionarlo, se restablecerá el seguimiento automático y la inclinación 3D.

---

## 3. Integración de Sensores y Web APIs en Móviles

### 3.1 Filtro de Ruido para la Brújula (Smoothing)
Para evitar vibraciones rápidas del mapa por micro-movimientos de la mano, implementaremos un filtro de **Media Móvil Exponencial (EMA)** para el rumbo del dispositivo:
$$\theta_{suave} = \alpha \cdot \theta_{nuevo} + (1 - \alpha) \cdot \theta_{anterior}$$
* *Configuración:* $\alpha = 0.1$ para una transición de rotación fluida pero responsiva.

### 3.2 Permisos de Movimiento en iOS (Apple Safari)
En iPhones, Safari requiere que el acceso al giroscopio y brújula sea aprobado mediante un gesto del usuario. Al hacer clic en "Empezar navegación", ejecutaremos:
```typescript
if (
  typeof DeviceOrientationEvent !== 'undefined' &&
  typeof (DeviceOrientationEvent as any).requestPermission === 'function'
) {
  try {
    const permission = await (DeviceOrientationEvent as any).requestPermission();
    if (permission === 'granted') {
      // Registrar evento deviceorientation
    }
  } catch (e) {
    console.error("Error solicitando permisos de orientación", e);
  }
}
```

### 3.3 Prevención de Bloqueo de Pantalla (Wake Lock API)
Para evitar que el teléfono se suspenda o apague la pantalla durante la caminata:
* Activaremos `navigator.wakeLock.request('screen')` al iniciar la navegación.
* Liberaremos el bloqueo automáticamente al finalizar la navegación o en caso de error.

### 3.4 Ajuste al Camino (Snapping)
Para compensar el ruido del GPS móvil, el avatar del usuario y la lógica de guiado se ajustarán (*snap*) al segmento de ruta a pie más cercano mediante cálculos geométricos, evitando falsos recalculados de ruta si el GPS fluctúa menos de 15 metros.

---

## 4. Diseño del HUD e Interfaz de Navegación

### 4.1 Banner Superior de Navegación
* Fondo de alto contraste (`bg-emerald-900` para modo oscuro y `bg-emerald-700` para modo claro).
* Icono de maniobra en formato gigante (flechas direccionales de giro).
* Distancia de aproximación al giro con tipografía destacada (ej: `En 50 metros`).
* Instrucción textual clara y directa (ej: `Gira a la izquierda por Carrera 50`).

### 4.2 Barra de Estado Inferior Colapsable
* Altura fija compacta de `72px` en dispositivos móviles para maximizar el área visible del mapa.
* Muestra el **Tiempo Restante** (en verde destacado), la **Distancia Restante** y la **Hora de Llegada Estimada (ETA)**.
* Botón de cancelación rápida (icono `X` con fondo rojo de alta visibilidad).
* Botón de silencio/sonido de voz para el guiado por TTS.

---

## 5. Criterios de Aceptación y Pruebas
1. **Rendimiento 3D:** El mapa debe responder fluidamente a los gestos táctiles y rotar sin demoras en dispositivos móviles reales.
2. **Guiado de Voz Ininterrumpido:** La voz (TTS) debe sonar al momento de iniciar la navegación y anunciar giros críticos a distancias clave.
3. **Persistencia en Pantalla:** El celular no debe bloquearse o apagar la pantalla mientras la navegación esté en curso.
4. **Cero Costos:** Toda la visualización de mapas y enrutamiento debe operar sin consumir tokens de plataformas pagas como Google Maps o Mapbox.
