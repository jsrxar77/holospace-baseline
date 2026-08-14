# 🎨 ESPECIFICACIÓN DEL SISTEMA DE DISEÑO HOLOWARE (HW-DS)

Este documento define la especificación técnica, tokens visuales, jerarquía de bordes, tipografías y comportamiento de fondo para cada uno de los **4 temas oficiales de la plataforma HoloWare Baseline**.

---

## 🏛️ 1. OMARCHY TILING WM (`omarchy_tiling`)
> **Inspiración:** Tiling Window Managers (Hyprland / i3wm / Catppuccin Mocha).  
> **Filosofía:** Geometría totalmente cuadrada, nítida y modular de alta densidad para usuarios avanzados.

### 📐 Tokens de Diseño:
* **Radios de Borde (Universal):** Strict **`4px`** en **TODOS** los elementos de la interfaz (tarjetas, botones, pestañas, modales, tablas, inputs, badges).
* **Ancho de Borde:** **`2px solid #313244`**.
* **Tipografía General:** **`JetBrains Mono`**, monospace (100% aislado).
* **Tipografía del Logo:** **`Press Start 2P`**, 8-bit retro pixelado (13px, letter-spacing 1px).
* **Fondo de Pantalla:** Plano sólido Catppuccin Crust/Base (`#1E1E2E`). Sin gradientes ni efectos de luz.
* **Superficies:** Mantle sólido (`#181825`). Sin transparencias ni desenfoques.

---

## 🌿 2. SOFT MINIMAL PASTEL (`soft_minimal_pastel`)
> **Inspiración:** Diseño editorial contemporáneo y superficies suaves tipo píldora.  
> **Filosofía:** Flat design plano, tonos pastel armónicos y bordes redondeados ergonómicos.

### 📐 Tokens de Diseño:
* **Radios de Tarjetas / Modales / Tablas:** **`12px`** plano.
* **Radios de Botones / Badges / Pestañas:** **`20px` (Superficies Píldora)**.
* **Ancho de Borde:** **`1px solid #313244`**.
* **Tipografía General:** **`Plus Jakarta Sans`**, sans-serif.
* **Tipografía del Logo:** **`Plus Jakarta Sans`** (Bold 800, 20px).
* **Fondo de Pantalla:** Plano sólido pastel suave (`#1E1E2E`). Sin gradientes ni transparencias.
* **Superficies:** Mantle plano sólido (`#181825`) con sombra suave (`0 4px 12px rgba(17, 17, 27, 0.3)`).

---

## 🌌 3. DARK GLASSMORPHISM (`dark_glassmorphism`)
> **Inspiración:** Interfaces futuristas traslúcidas de cristal pulido.  
> **Filosofía:** Formas orgánicas ultra redondeadas, transparencias cristalinas y luces ambientales.

### 📐 Tokens de Diseño:
* **Radios de Tarjetas / Modales / Tablas:** **`32px` Ultra Redondeado**.
* **Radios de Botones / Inputs:** **`20px`**.
* **Radios de Badges:** **`14px`**.
* **Ancho de Borde:** **`1px solid rgba(255, 255, 255, 0.12)`** con resplandor interno `inset 0 1px 0 rgba(255, 255, 255, 0.15)`.
* **Tipografía General:** **`Outfit`**, sans-serif.
* **Tipografía del Logo:** **`Outfit`** (Black 900, 20px).
* **Fondo de Pantalla:** **Vibrant Ambient Mesh Gradient** (Orbes radiales traslúcidas en movimiento de azul cobalt, verde esmeralda y violeta sobre `#06080D`).
* **Superficies:** Frosted glass traslúcido (`rgba(18, 24, 38, 0.45)`) con desenfoque de cristal `-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);`.

---

## ⚡ 4. CYBERPUNK GLASSMORPHISM (`cyberpunk_glassmorphism`)
> **Inspiración:** Estética Synthwave Neón futurista.  
> **Filosofía:** Cristal traslúcido neón con sombras fluorescentes de cian, violeta y magenta.

### 📐 Tokens de Diseño:
* **Radios de Tarjetas / Modales / Tablas:** **`32px` Ultra Redondeado**.
* **Radios de Botones / Inputs:** **`20px`**.
* **Radios de Badges:** **`14px`**.
* **Ancho de Borde:** **`1px solid rgba(168, 85, 247, 0.3)`** con sombra neón `box-shadow: 0 0 25px rgba(168, 85, 247, 0.25)`.
* **Tipografía General:** **`Outfit`**, sans-serif.
* **Tipografía del Logo:** **`Outfit`** (Black 900, 20px).
* **Fondo de Pantalla:** **Neon Ambient Mesh Gradient** (Orbes radiales neón de magenta `#FF007F`, cian `#00F0FF` y violeta `#A855F7` sobre `#05050A`).
* **Superficies:** Frosted glass violeta traslúcido (`rgba(22, 18, 42, 0.45)`) with desenfoque `-webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);`.
