# Estrategia de Arquitectura UX/UI y Sistema de Diseño Responsive — HoloSpace SaaS

> **Documento de Diseño y Arquitectura Visual:** Estándares de interfaz, distribución espacial (Header, Workspace, Footer), adaptabilidad multidispositivo (Desktop, Tablet, Mobile) y jerarquía de componentes para el Baseline SaaS de HoloSpace.

---

## 1. Diagnóstico de la Situación Actual

1. **Saturación en una Sola Fila (Header Amontonado):**
   * Actualmente conviven en una misma barra horizontal: Logo `HoloSpace`, Badge de contexto, 5 pestañas de navegación, selector de temas con texto, botón "Conectar Celular", badge con texto largo de usuario (`SUPERADMIN: superadmin@holospace.app`) y botón "Cerrar Sesión".
   * Esto provoca colapso visual, textos apretados y desbordes horizontales en resoluciones estándar (1366px, laptops de 13" y tablets).

2. **Falta de Responsividad Multidispositivo:**
   * En anchos menores a 1200px, los elementos se solapan o quedan inaccesibles sin un mecanismo de colapso progresivo (Menú Hamburguesa / Drawer lateral / Dropdown de Usuario).

3. **Inexistencia de Footer de Estado Operativo:**
   * Las plataformas industriales y SaaS B2B requieren una barra de estado inferior (*Status Bar / Footer*) que informe en tiempo real el estado de conexión con PostgreSQL 16, la organización activa, latencia y versión del sistema, liberando espacio en el encabezado superior.

---

## 2. Arquitectura de las 3 Zonas del Layout Maestro (App Shell)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. HEADER / APP BAR (64px)                                                              │
│ [Zona A: Logo & Context]     [Zona B: Navegación Central]    [Zona C & D: Tools & User]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ 2. WORKSPACE / ESPACIO DE TRABAJO DINÁMICO                                             │
│    - Layouts Grid/Flexbox fluidos adaptables (Kanban, Tablas, Tarjetas de Tenants)     │
│    - Padding inteligente: 32px (Desktop) / 20px (Tablet) / 16px (Mobile)               │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. FOOTER / STATUS BAR (36px)                                                          │
│ [DB: PostgreSQL 16 RLS Conectado]    [Tenant: Poke Argentina]    [v1.2.0 Enterprise]  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Desglose Detallado del Header (App Bar)

El encabezado superior se organiza en **3 áreas funcionales limpias**:

### Zona A: Identidad de Marca y Contexto Operativo (Izquierda)
* **Logo de Plataforma:** `HoloSpace` con tipografía bold y contraste nativo del tema.
* **Badge de Contexto:** Etiqueta sobria y monocromática que indica el contexto activo (`CORE`, `TENANTS`, `SCANBAN`, `SCANFLOW`). En vista cliente, indica el nombre/slug de la empresa (`DRINKLOVERS`, `POKE`).

### Zona B: Navegación Principal (Centro)
* **Desktop (≥ 1024px):** Píldoras de navegación (*Tabs*) limpias con espaciado balanceado (12px padding), sin emojis, con micro-transición suave en hover y activo destacado (`var(--emerald)` o color primario del tema).
* **Tablet / Mobile (< 1024px):** Las pestañas se agrupan automáticamente dentro de un **Menú Hamburguesa lateral (Drawer accesible)** que se desliza desde la izquierda, permitiendo navegar cómodamente con el pulgar en teléfonos y tablets.

### Zona C & D: Herramientas, Conexión y Menú de Usuario (Derecha)
Para evitar saturar la barra con textos largos de emails y roles:
1. **Botón de Conexión Móvil (Quick Action):** Botón compacto con texto limpio `Escanear QR` o `Conectar Móvil` para abrir el modal de vinculación Expo Go.
2. **Selector de Tema Compacto:** Selector estilizado con el tema activo de la sesión.
3. **Píldora de Perfil con Menú Desplegable (User Menu Dropdown):**
   * En lugar de imprimir todo el texto largo `SUPERADMIN: superadmin@holospace.app` en la barra, se muestra un avatar compacto con rol (`SUPERADMIN` o iniciales del usuario).
   * Al hacer clic, se despliega un popover estilizado con:
     * Nombre y Email completo.
     * Organización perteneciente.
     * Rol asignado (`SUPERADMIN`, `ADMIN`, `OPERATOR`).
     * Enlace a documentación / ayuda.
     * Botón de `Cerrar Sesión`.

---

## 4. Estructura del Workspace (Espacio de Trabajo)

* **Contenedor Principal:** `max-width: 1600px` centrado o fluido con márgenes automáticos, asegurando que los monitores ultrapanorámicos no estiren el contenido de forma desproporcionada.
* **Grid de Columnas Kanban y Explorador de Tablas:**
  * **Desktop:** 4 columnas paralelas (Backlog, Listo, En Proceso, Completado).
  * **Tablet (768px - 1023px):** 2 columnas por fila con scroll suave.
  * **Mobile (< 768px):** Pestañas tipo *Segmented Control* para alternar entre columnas (`Backlog (2)`, `Listo (1)`, etc.) o vista vertical apilada.

---

## 5. Estructura del Footer Operativo (Status Bar)

Un footer delgado y discreto de 36px en la parte inferior con tipografía monoespaciada (`JetBrains Mono`, 12px) que aporta valor en entornos logísticos:
* **Extremo Izquierdo:** Indicador de estado del motor de datos (`PostgreSQL 16 RLS • Online`).
* **Centro:** Organización activa (`Organización: Drink Lovers Argentina`).
* **Extremo Derecho:** Versión del sistema (`HoloSpace SaaS v1.2.0`) y atajo a `Documentación`.

---

## 6. Estrategia de Breakpoints Responsive

| Dispositivo | Ancho (Viewport) | Header | Navegación | Workspace |
|---|---|---|---|---|
| **Desktop Grande** | `≥ 1280px` | 3 Zonas Horizontales | Pestañas visibles en barra | 4 Columnas Kanban / Grid amplio |
| **Laptop / Desktop Compacto** | `1024px - 1279px` | 3 Zonas Horizontales (espacio ajustado) | Pestañas con padding compacto | 4 Columnas auto-ajustables |
| **Tablet** | `768px - 1023px` | Header Colapsable | Menú Hamburguesa lateral | 2 Columnas Kanban / Tablas con scroll horizontal |
| **Mobile** | `< 768px` | Header Slim (Logo + Menú + Perfil) | Drawer Lateral Completo | Vista 1 Columna o Tabs de estado |

---

## 7. Próximos Pasos para la Implementación

Una vez aprobada esta estrategia, el plan técnico ejecutará:
1. **Refactorización CSS / Modular Tokens:** Estilos para el nuevo App Shell, Drawer lateral móvil y Menú Desplegable de Usuario en `public/index.html` y `modules/core/public/index.html`.
2. **Componente de Menú Hamburguesa & User Dropdown:** Lógica en JavaScript nativo vanilla sin dependencias externas en `public/app.js`.
3. **Incorporación del Footer Status Bar:** Componente persistente en la base del layout.
4. **Verificación visual y funcional en Docker.**
