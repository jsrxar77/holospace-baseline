# Arquitectura del Sistema SaaS World-Class: PhoneWare Board & PhoneWare Scanner

**PhoneWare** es una plataforma logística SaaS empresarial de clase mundial, diseñada para gestionar, auditar y controlar en tiempo real el flujo de preparación y despacho de pedidos en depósitos y centros de distribución a través del procesamiento inteligente de comprobantes PDF y la verificación estricta por código de barras.

---

## 1. Visión General y Componentes Principales

The PhoneWare Ecosystem se compone de dos aplicaciones complementarias conectadas a una base de datos relacional centralizada:

1. **PhoneWare Board** (Panel Web Administrador):
   - **Tecnología**: HTML5, CSS3 vanilla (estética dark glassmorphism premium con diseño receptivo), JavaScript ES2024.
   - **Propósito**: Permite a los Administradores cargar comprobantes PDF, gestionar usuarios con RBAC, supervisar el tablero Kanban de 4 columnas, explorar pedidos mediante filtros inteligentes y validar comprobantes de forma ininterrumpida.

2. **PhoneWare Scanner** (App Móvil Operarios):
   - **Tecnología**: React Native con **Expo SDK 51+** y TypeScript.
   - **Propósito**: Permite a los operarios autenticarse mediante email, seleccionar órdenes validadas en estado `LISTO`, escanear códigos de barras EAN-13 con feedback multisensorial (háptico y sonoro) en tiempo real y generar estampas digitales de auditoría inmutables.

---

## 2. Base de Datos Relacional SQLite Persistente (`./data/phoneware.db`)

El sistema utiliza **SQLite3 (`better-sqlite3`)** como motor relacional de base de datos de alta performance y persistencia permanente en el servidor backend:

- **Ruta de la DB**: `./data/phoneware.db` (Modo WAL habilitado, `foreign_keys = ON`).
- **Almacenamiento de Blobs PDF**: Los comprobantes PDF subidos se persisten directamente como **Blobs en formato Base64** en la tabla `orders`, garantizando la integridad del documento original sin depender de archivos temporales.
- **Claves Primarias Subrogadas (*Surrogate Keys*)**: Todas las relaciones utilizan identificadores autoincrementales incorruptibles (`id INTEGER PRIMARY KEY AUTOINCREMENT`) y UUIDs únicos (`uuid TEXT UNIQUE NOT NULL`), eliminando cualquier riesgo de colisión de datos por duplicados en números de factura externos.

### Esquema DDL Relacional Normalizado

```sql
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL,
  orderNumber TEXT NOT NULL,
  clientName TEXT NOT NULL,
  issueDate TEXT NOT NULL,
  pdfFileName TEXT NOT NULL,
  pdfBlob TEXT NOT NULL,
  status TEXT NOT NULL,
  operatorEmail TEXT,
  totalItemsRequired INTEGER NOT NULL,
  totalItemsScanned INTEGER NOT NULL DEFAULT 0,
  auditStamp TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  unitPrice REAL DEFAULT 0.0,
  quantityRequired INTEGER NOT NULL,
  quantityScanned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  userEmail TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);
```

---

## 3. Sistema Centralizado de Registro y Diagnóstico de Errores

PhoneWare implementa una arquitectura de trazabilidad y logging centralizada para clientes Web, Móviles y Servidor Backend:

- **Logs de Consola Estructurados**: Captura excepciones en tiempo real mostrando marca de tiempo, ruta/contexto, email del usuario, datos adjuntos y stack trace.
- **Archivo de Persistencia de Errores**: `./data/errors.log`.
- **Endpoint de Transmisión Móvil**: `POST /api/log-client-error`.
- **Endpoint de Consulta DevOps**: `GET /api/error-logs`.

---

## 4. Motor de Extracción PDF por Coordenadas Y

La lectura de comprobantes PDF utiliza `pdfjs-dist` mediante un **Algoritmo de Extracción por Coordenadas Y (Vertical Level Bounds)**:
1. Identifica las coordenadas verticales ($Y$) de los encabezados de tabla.
2. Filtra exclusivamente las líneas pertenecientes al cuerpo de productos.
3. Recombina dígitos fragmentados de códigos EAN-13 y vincula descripciones, cantidades requeridas y precios unitarios reales.
4. **Cero Fallbacks Silenciosos**: Si un comprobante carece de texto seleccionable o líneas de ítems válidas, el sistema rechaza la carga mediante un mensaje de error HTTP 400 transparente.

---

## 5. Ciclo de Vida Kanban (4 Columnas)

```
[ PDF Subido ] ──► (1. BACKLOG) ──[ Aprobado por ADMIN ]──► (2. LISTO)
                                                                 │
[ Despachado OK ] ◄── (4. COMPLETADO) ◄──[ Asignado Operario ]──┘
                                             (3. EN PROCESO)
```

1. **BACKLOG (Gris)**: Estado inicial de comprobantes subidos pendientes de aprobación.
2. **LISTO (Verde)**: Estado alcanzado únicamente cuando un **ADMIN** aprueba el pedido. Visible en la app celular.
3. **EN PROCESO (DOING - Azul)**: Asignación exclusiva 1 a 1 por operario. Muestra acordeón desplegable y barra de progreso.
4. **COMPLETADO (DONE - Amarillo)**: Pedido auditado al 100% con estampa digital inmutable.

---

## 6. Herramientas DevOps & Automatización

- `./bin/devops-db-refresh.sh`: Realiza un reseteo en vivo de SQLite sin apagar el puerto 3001, poblando únicamente los usuarios autorizados (`admin@drinklovers.com.ar` y `jsrxar@gmail.com`).
- `./bin/devops-git-push-verify.sh`: Ejecuta la prueba de compilación TypeScript (`npx tsc --noEmit`), crea el commit y verifica la sincronización limpia con GitHub.
