# Sistema de Temas y Diseño Centralizado (HoloSpace HW-DS Engine)

> **Ubicación Canónica de Definiciones:** `/modules/themes/`  
> **Archivo Único de la Verdad (Single Source of Truth):** `/modules/themes/themes.json`  
> **API de Suministro:** `GET /api/theme` / `POST /api/theme`  
> **Consumidores:** Servidor Backend (`server.js`), Web App (`public/app.js`), Mobile App (`modules/scanner/src/store/useThemeStore.ts`).

---

## 1. Metodología de Temas: Single Source of Truth

Para evitar dispersión de código, inconsistencias visuales y duplicidad en el mantenimiento:

1. **Cero Hardcoding en Módulos:** Queda terminantemente prohibido definir archivos de temas o colores duplicados dentro de las carpetas individuales de cada módulo (`modules/core`, `modules/kanban`, `modules/scanner`, etc.).
2. **Definición Declarativa Central:** Todos los temas y sus tokens residen en un único archivo JSON: `modules/themes/themes.json`.
3. **Módulo Exportador Node.js:** `modules/themes/index.js` exporta el diccionario `THEMES` y las funciones de consulta (`getTheme`, `listThemes`) para el backend.
4. **Distribución en Tiempo Real (API REST):**
   - El endpoint `GET /api/theme` entrega en tiempo real los tokens del tema según la jerarquía:
     - **Preferencia de Usuario:** Guardada en la columna `users.theme_preference`.
     - **Preferencia de Tenant:** Guardada en la tabla `app_settings (active_theme)`.
     - **Fallback de Plataforma:** `omarchy_tiling`.

---

## 2. Catálogo Oficial de los 5 Temas de Plataforma

| Clave (`key`) | Nombre Oficial | Tipografía | Radio Borde | Fondo Principal | Acento Principal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`omarchy_tiling`** | **Omarchy Tiling WM (Dracula)** *(Predeterminado)* | `JetBrains Mono` / `Press Start 2P` | `4px` (Tiling estricto) | `#121317` | Verde Menta (`#50FA7B`) |
| **`omarchy_aetheria`** | **Omarchy Aetheria** | `JetBrains Mono` / `Press Start 2P` | `4px` (Tiling estricto) | `#0E091D` (OLED) | Teal (`#14B9B5`) / Violeta (`#7C3AED`) |
| **`soft_minimal_pastel`** | **Soft Minimal Pastel** | `Plus Jakarta Sans` | `16px` / `20px` (Píldoras) | `#1E1E2E` (Catppuccin) | Menta (`#A6E3A1`) / Lavanda (`#89B4FA`) |
| **`dark_glassmorphism`** | **Dark Glassmorphism** | `Outfit` | `24px` (Glass) | `#0B0E14` (Cristal oscuro) | Esmeralda (`#00E676`) / Cobalto (`#3B82F6`) |
| **`cyberpunk_glassmorphism`**| **Cyberpunk Glassmorphism** | `Press Start 2P` | `8px` (Synthwave) | `#05050A` (Neon) | Cian (`#00FFCC`) / Magenta (`#FF007F`) |

---

## 3. Mapa de Tokens Estándar por Tema

Cada objeto de tema en `modules/themes/themes.json` implementa la siguiente estructura de tokens obligatoria:

```json
{
  "key": "omarchy_tiling",
  "name": "Omarchy Tiling WM (Dracula)",
  "background": "#121317",
  "cardBg": "#1A1B22",
  "cardBorder": "#2E303E",
  "emerald": "#50FA7B",
  "cobalt": "#BD93F9",
  "amber": "#F1FA8C",
  "red": "#FF5555",
  "textMain": "#F8F8F2",
  "textMuted": "#6272A4",
  "fontFamily": "JetBrains Mono",
  "fontMono": "JetBrains Mono",
  "borderRadius": 4,
  "radiusCard": 4,
  "radiusBtn": 4,
  "radiusBadge": 2,
  "borderWidth": 1,
  "backdropBlur": "none",
  "boxShadow": "none"
}
```

---

## 4. Regla de Aislamiento de Fondos Dinámicos

* ✨ **Fondo Dinámico Espacial (Estrellas a 60s, grilla y asteroides):** Confinado exclusivamente a **Landing Page (`/landing`)** y **Pantalla de Login (`/login`)**.
* 🛑 **Módulos Internos Autenticados (`/tenant`, `/core`, `/kanban`, `/scanner`):** Fondo estático sólido limpio sin animaciones para garantizar máximo rendimiento, legibilidad y ahorro de batería.
