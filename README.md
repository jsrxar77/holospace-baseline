# 🌐 HoloWare Baseline

> **Plataforma Contenedora Multi-Módulo Enterprise para Gestión Operativa y Logística.**

HoloWare Baseline es una infraestructura modular que permite ejecutar múltiples aplicaciones de negocio (como **ScanBan** o **StockFlow**) compartiendo autenticación unificada, esquema relacional de usuarios en SQLite, motor de temas dinámicos y un panel de gestión para el **Super Administrador**.

---

## 🔑 Credenciales por Defecto (Entorno de Desarrollo)

| Rol | Email | Contraseña | Permisos |
|---|---|---|---|
| **SUPERADMIN** | `superadmin@holoware.com.ar` | `BrunaSeRelambe22!` | Acceso total: Gestión de módulos, auditoría de plataforma y usuarios. |
| **ADMIN** | `admin@drinklovers.com.ar` | `drinklovers2026!` | Gestión de módulos activos (Kanban, validación de PDFs, ABM usuarios). |
| **OPERATOR** | `jsrxar@gmail.com` | `Asadito21!` | Acceso operativo a escáner móvil (auditoría de stock EAN-13). |

---

## 🚀 Inicio Rápido

### Levantar Todo el Entorno (Backend Server + Panel Web + App Móvil Expo)

```bash
npm run dev
```

Un solo comando ejecuta en paralelo:
- **Servidor Backend + Panel Web Admin (`node --watch server.js`):** `http://localhost:3001`
- **App Móvil ScanBan Scanner (`npx expo start -c`):** Servidor Metro para Expo Go.

---

#### 📱 Conexión desde el Teléfono Móvil:
1. Abrir **Expo Go** en Android o iOS.
2. Escanear el código QR que aparece en la terminal (o hacer clic en **"Conectar Celular (QR)"** en el header del panel web).
3. Iniciar sesión con credenciales de operario (`jsrxar@gmail.com`).

*(Opcionalmente se pueden ejecutar por separado: `node server.js` para solo el backend, o `npx expo start -c` para solo el cliente móvil).*

---

## 📖 Guía de Uso del Sistema Web

### 1. Panel de Plataforma (`🏛️ Plataforma` — Solo SUPERADMIN)
- **Gestión de Módulos:** Enciende o apaga módulos (ScanBan, StockFlow) mediante switches interactivos en tiempo real.
- **Auditoría de Plataforma:** Historial inmutable de cambios de tema, accesos y estado de módulos.

### 2. Tablero Kanban de Logística (`ScanBan`)
- **Subir Factura PDF:** Arrastra un comprobante PDF a la zona de carga para registrar el pedido en `BACKLOG`.
- **Validar Pedido:** Presiona `✓ Pasar a Listo` en las tarjetas de Backlog o desde el visor de factura para habilitar la orden a los celulares operarios.
- **En Proceso:** Agrupado dinámicamente por operario asignado en acordeones interactivos colapsables.
- **Completado:** Historial de expediciones al 100% con estampa digital inmutable.

### 3. Selector de Tema Visual Global (Header)
- Selector dropdown con **7 temas** (`Original Dark`, `Catppuccin Mocha`, `Cyberpunk Neon`, `Nordic Frost`, `Dracula Pro`, `Modern Light`, `Monochrome`).
- **Persistente y Global:** El tema seleccionado se guarda en SQLite y se propaga automáticamente a todos los módulos web y móviles.

### 4. Explorador de Pedidos (`🔍 Pedidos`)
- Buscador universal instantáneo por pedido #, cliente, código EAN-13 o email de operario.
- Filtros por estado, pills interactivas multi-operario y ordenamiento por fecha, monto o ítems.

---

## ⚙️ Operaciones DevOps y Mantenimiento

### Reseteo en Vivo de Base de Datos (Sin apagar puerto 3001)

```bash
bash bin/devops-db-refresh.sh
```
O vía API: `POST /api/reset-db`

---

## 📂 Estructura del Proyecto

```
holoware-baseline/
├── docs/                          ← Documentación general y por módulo
│   ├── HOLOWARE_PLATFORM.md       ← Visión de plataforma contenedora
│   ├── ARCHITECTURE.md            ← Arquitectura técnica general
│   ├── MODULE_CREATION.md         ← Guía para desarrollar nuevos módulos
│   ├── ROADMAP.md                 ← Estado de desarrollo y roadmap
│   └── modules/                   ← Especificaciones por módulo (CORE, SCANBAN, STOCKFLOW)
│
├── modules/
│   ├── core/                      ← Módulo Core (Auth, Usuarios, SuperAdmin, Temas)
│   │   ├── public/
│   │   ├── routes/
│   │   └── theme/                 ← Definición de paletas de temas dinámicos
│   ├── scanban/                   ← Módulo ScanBan (src/, orders/)
│   └── stockflow/                 ← Plantilla 2º módulo
├── bin/                           ← Scripts DevOps
├── public/                        ← Entry point web estático (app.js + index.html)
├── data/
│   └── holoware.db                ← Base de datos SQLite única
├── server.js                      ← Servidor Node.js principal
├── .env                           ← Variables de entorno (HW_PORT=3001, HW_THEME=original)
└── README.md                      ← Este documento
```

---

## 📚 Documentación Detallada

- 📘 [Visión de la Plataforma](./docs/HOLOWARE_PLATFORM.md)
- 📐 [Arquitectura Técnica](./docs/ARCHITECTURE.md)
- 🛠️ [Guía para Crear un Nuevo Módulo](./docs/MODULE_CREATION.md)
- 🗺️ [Roadmap de la Plataforma](./docs/ROADMAP.md)
- 🏛️ [Especificación Módulo Core](./docs/modules/CORE.md)
- 📦 [Especificación Módulo ScanBan](./docs/modules/SCANBAN.md)
- 📦 [Especificación Módulo StockFlow](./docs/modules/STOCKFLOW.md)
