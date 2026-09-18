---
name: holospace-theme-system
description: >
  Guia tecnica para el consumo y aplicacion del motor centralizado de temas (HW-DS) en HoloSpace Baseline.
  Usar al disenar, estilizar o refactorizar interfaces Web o componentes moviles.
---

# Skill: Sistema Centralizado de Temas (HW-DS) — HoloSpace Baseline

> Esta habilidad define como los modulos Web y la aplicacion movil consumen de forma universal los tokens de diseno del Core (`/api/theme`) manteniendo consistencia estetica estricta y sobria sin emojis.

---

## 1. Regla de Oro: Single Source of Truth

1. **Definicion Unica en `/modules/themes/themes.json`**:
   Queda terminantemente prohibido hardcodear paletas de color, radios de borde o temas propios en subcarpetas de modulos individuales (`modules/kanban`, `modules/scanner`, etc.).
2. **Los 7 Temas Oficiales (Dark y Light)**:
   - `omarchy_tiling` (Omarchy Tiling - Predeterminado, bordes marcados, estetica Window Manager)
   - `omarchy_tiling_light` (Omarchy Light)
   - `omarchy_aetheria` (Omarchy Aetherial)
   - `soft_minimal_pastel` (Soft Pastel)
   - `soft_minimal_pastel_light` (Soft Pastel Light)
   - `dark_glassmorphism` (Dark Glass)
   - `cyberpunk_glassmorphism` (Cyberpunk Glass)

---

## 2. Consumo en Frontend Web

Todo nuevo modulo Web debe inyectar el script de carga de tema en su `index.html` o inicializador:

```javascript
// Obtener variables de tema desde el Core
async function applyCurrentTheme() {
  const token = localStorage.getItem('hs_token');
  const res = await fetch('/api/theme', {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (res.ok) {
    const data = await res.json();
    const root = document.documentElement;
    // Aplicar tokens CSS al root
    Object.entries(data.theme.tokens).forEach(([key, val]) => {
      root.style.setProperty(`--${key}`, val);
    });
  }
}
```

### Tokens CSS Principales:
* `var(--bg-main)`: Fondo general de la aplicacion
* `var(--card-bg)`: Fondo de contenedores y tarjetas
* `var(--border-color)`: Color de borde sobrio
* `var(--text-main)`: Color principal de texto
* `var(--text-muted)`: Texto secundario/descriptivo
* `var(--accent-color)` o `var(--emerald)`: Color de acento primario
* `var(--danger-color)`: Alertas y errores

---

## 3. Fondos Dinamicos vs Vistas Autenticadas

* **Animaciones de estrellas/asteroides**: Exclusivas del Landing Page (`/`) y de la pantalla de Login.
* **Vistas de Trabajo**: Los modulos autenticados (`/tenant`, `/core`, `/kanban`, `/scanner` y nuevos modulos) deben usar **fondos solidos o gradientes estaticos sobrios** para optimizar el rendimiento y la legibilidad operativa.

---

## 4. Prohibicion Estricta de Hardcodes en UI (Cero Estilos Inline)

1. **Barras y Navegacion Dinamica**:
   - Queda prohibido escribir `style="background-color: #0F131A;"` o similares en elementos `<nav>`, `header` o barras de pestanas.
   - Las barras de navegacion (`.header-nav-line`) y botones de pestanas (`.nav-tab`) deben usar siempre `background-color: var(--card-bg)` o `var(--bg-main)`, con bordes `var(--card-border)`.
2. **Pestanas y Botones Activos (`.active`)**:
   - Cada tema define su token de acento (`var(--emerald)` o `var(--cobalt)`).
   - Queda prohibido forzar reglas globales con `#00d4ff` o colores estaticos que rompan la armonia visual de temas claros u oscuros.
