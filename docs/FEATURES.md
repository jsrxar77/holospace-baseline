# Especificación de Funcionalidades e Historias de Usuario: Phone-Ware

Este documento detalla todas las características, especificaciones de experiencia de usuario (UX/UI para depósitos), reglas de negocio y criterios de aceptación (User Stories) para la aplicación móvil **Phone-Ware**.

---

## 1. Mapa de Funcionalidades (Feature Map)

```
Phone-Ware (Módulo de Depósito & Picking Audit)
│
├── F01: Recepción & Parsing de Comprobantes PDF
│   ├── Importación vía Selector de Archivos / Share Sheet / Drag & Drop
│   ├── Extracción de N° de Pedido, Cliente y Fecha
│   ├── Parseo de Tabla de Productos (Código EAN-13/SKU, Descripción, Cantidad)
│   └── Fallback OCR automático para comprobantes escaneados
│
├── F02: Resumen Táctil de Alta Visibilidad
│   ├── Pantalla Principal con Resumen del Pedido Activo
│   ├── Tarjetas de Ítems con estado visual (Pendiente, En Progreso, Completado)
│   ├── Contador Global de Progreso (Unidades Escaneadas / Unidades Totales)
│   └── Filtro rápido por estado (Todos, Pendientes, Verificados)
│
├── F03: Escáner de Código de Barras Integrado
│   ├── Visor de Cámara con Retícula Guiada y Flash/Linterna
│   ├── Integración nativa con Google ML Kit / html5-qrcode / ZXing
│   ├── Modos de Escaneo: Continuo (Batch Scanning) y Manual
│   └── Entrada Manual de Respaldo por Teclado Numérico
│
├── F04: Motor de Validación Estricta & Alertas Multisensoriales
│   ├── Validación instantánea contra el SKU del pedido
│   ├── Incremento automático de conteo al detectar coincidencia
│   ├── Alerta por Código Incorrecto (Fuera del Pedido)
│   ├── Alerta por Sobre-Escaneo (Exceso de cantidad requerida)
│   └── Retroalimentación por Sonido (Audio Pitch) y Vibración (Háptica)
│
├── F05: Cierre Estricto de Pedido & Reporte
│   ├── Bloqueo físico del botón "Cerrar Pedido" si el conteo != 100%
│   ├── Modal de confirmación final cuando todo está 100% verificado
│   ├── Generación de Resumen de Auditoría / Despacho
│   └── Historial Local de Pedidos Procesados
│
├── F06: Operatividad Offline & Resiliencia
│   ├── Persistencia automática en almacenamiento local (SQLite / IndexedDB)
│   └── Funcionamiento sin conectividad de red
│
└── F07: Gestión Multioferente de Depósito (Flujo de Carpetas & Auditoría Asignada)
    ├── Monitoreo de carpetas `./delivery/backlog/`, `./delivery/doing/` y `./delivery/done/`
    ├── Identificador Híbrido de Operario/Dispositivo (`{OPERARIO}-{DISPOSITIVO}`)
    ├── Asignación y renombrado al tomar pedido: `./delivery/doing/{numero-pedido}-{identificador}.pdf`
    ├── Liberación de pedido asignado: Devolución a `./delivery/backlog/{numero-pedido}.pdf`
    └── Archivado final en `./delivery/done/` con marca de agua y sello digital de auditoría

---

## 2. Guía de Diseño UI/UX para Entornos de Depósito (Stock & Warehouse UX)

La interfaz de usuario ha sido concebida bajo estándares exigentes de ergonomía laboral e industrial:

### A. Paleta de Colores de Alto Contraste (Theme: Dark High-Contrast)
- **Fondo Principal**: `#0F172A` (Slate 900 - Reduce fatiga visual en entornos oscuros).
- **Superficies / Tarjetas**: `#1E293B` (Slate 800) con bordes de 2px de alto contraste.
- **Estado Pendiente**: `#F59E0B` (Amarillo Ámbar - Alerta visual clara).
- **Estado Completado / Coincidencia**: `#22C55E` (Verde Neón - Alta visibilidad a distancia).
- **Estado Error / Fuera de Pedido**: `#EF4444` (Rojo Intenso - Detención inmediata).
- **Texto Principal**: `#FFFFFF` (Blanco puro) con tipografía Bold / Heavy.

### B. Tamaño y Ergonomía de Elementos Táctiles
- **Touch Targets Mínimos**: Botones de interacción principal con dimensiones mínimas de **64px × 64px**, utilizables sin necesidad de quitarse guantes de trabajo.
- **Contadores de Cantidad**: Texto de tamaño gigante (mínimo **28pt**) para permitir la lectura a 1 metro de distancia mientras se manipulan cajas o palets.

### C. Sistema de Señales Auditivas y Hápticas
1. **Beep de Coincidencia Exitosita**:
   - Audio: Tono agudo (1000 Hz, 120ms).
   - Vibración: 1 pulso háptico corto (50ms).
2. **Buzzer de Error / Código no Encontrado**:
   - Audio: Tono grave grave/sirena (250 Hz, 400ms).
   - Vibración: 2 pulsos hápticos largos e intensos (200ms cada uno).
3. **Beep de Cantidad Completa**:
   - Audio: Secuencia de dos tonos ascendentes (800 Hz -> 1200 Hz).

---

## 3. Historias de Usuario (User Stories) & Criterios de Aceptación

### US-01: Carga y Parsing de Pedido PDF
**Como** operario de depósito,  
**Quiero** seleccionar o compartir un archivo PDF con la orden de pedido,  
**Para** que la aplicación extraiga automáticamente el número de pedido, los productos y sus cantidades requeridas sin tener que ingresarlos manualmente.

**Criterios de Aceptación (Gherkin):**
- **Given** que estoy en la pantalla principal de la aplicación,
- **When** presiono el botón "Cargar Pedido PDF" y selecciono el archivo `34409313.pdf`,
- **Then** la app procesa el documento y muestra el encabezado `DETALLE DE VENTA 3010`,
- **And** genera automáticamente la lista con los 11 productos y sus cantidades requeridas (ej: `7794450008275` - Cant: 1, `7790517008165` - Cant: 24).

---

### US-02: Visualización del Resumen Táctil de Ítems
**Como** preparador de pedidos,  
**Quiero** ver un sumarizado muy claro y grande de cada ítem con su cantidad requerida y escaneada,  
**Para** saber exactamente qué productos debo buscar y cuántos me faltan por escanear.

**Criterios de Aceptación:**
- **Given** que un pedido ha sido cargado exitosamente,
- **When** navego a la vista de sumarizado,
- **Then** veo cada producto representado en una tarjeta grande con su Descripción, Código EAN-13, Cantidad Requerida y Cantidad Escaneada (iniciada en `0`),
- **And** veo una barra de progreso general en la parte superior que indica el porcentaje total de verificación (ej: `0 / 128 Unidades Escaneadas - 0%`).

---

### US-03: Escaneo de Código de Barras con Validación Instantánea
**Como** operario en el depósito,  
**Quiero** escanear los códigos de barras de los productos usando la cámara del teléfono o tablet,  
**Para** verificar si corresponden al pedido e incrementar automáticamente el conteo.

**Criterios de Aceptación:**
- **Given** que estoy en la pantalla de escaneo con un pedido activo,
- **When** apunto la cámara al código de barras `7794450008275`,
- **Then** la app identifica el código en menos de 300 milisegundos,
- **And** incrementa la cantidad escaneada de ese ítem en +1 (ej: `1 / 1`),
- **And** la tarjeta del producto cambia a color Verde con estado "COMPLETADO",
- **And** se emite un Beep agudo de confirmación y una vibración corta.

---

### US-04: Prevención de Errores por Producto Incorrecto o Exceso
**Como** auditor de control de calidad,  
**Quiero** que la aplicación me alerte de forma estridente si escaneo un producto equivocado o si intento escanear más unidades de las pedidas,  
**Para** evitar enviar mercadería incorrecta al cliente.

**Criterios de Aceptación:**
- **Scenario A (Producto equivocado):**
  - **Given** que escaneo un código de barras que NO está en el pedido (ej: `7790000000000`),
  - **Then** la app NO incrementa ningún contador,
  - **And** emite un sonido de error grave (sirena) y vibración intensa,
  - **And** muestra una alerta roja emergente en pantalla: `¡CÓDIGO NO PERTENECE AL PEDIDO!`.
- **Scenario B (Sobre-escaneo / Exceso):**
  - **Given** que un ítem ya tiene su cantidad completada (ej: `1 / 1`),
  - **When** intento escanear nuevamente el mismo código `7794450008275`,
  - **Then** la app bloquea el conteo adicional y muestra la alerta: `¡CANTIDAD YA COMPLETADA PARA ESTE ÍTEM!`.

---

### US-05: Regla Estricta de Bloqueo de Cierre de Pedido
**Como** responsable de logística,  
**Quiero** que el sistema impida cerrar un pedido si falta algún producto o cantidad por escanear,  
**Para** garantizar que ningún pedido incompleto salga del depósito.

**Criterios de Aceptación:**
- **Given** que el pedido tiene 100 unidades requeridas pero solo se han escaneado 99,
- **When** presiono el botón "Cerrar Pedido",
- **Then** la aplicación BLOQUEA la acción y deshabilita el cierre,
- **And** muestra un mensaje destacado en pantalla: `NO SE PUEDE CERRAR EL PEDIDO. FALTAN 1 UNIDADES POR VERIFICAR`,
- **And** resalta las tarjetas de los ítems pendientes en color amarillo.

---

### US-06: Cierre Exitoso y Despacho del Pedido Verificado
**Como** operario de depósito,  
**Quiero** cerrar el pedido cuando la verificación alcance el 100%,  
**Para** dar por concluido el despacho y guardar el registro de auditoría.

**Criterios de Aceptación:**
- **Given** que el 100% de los ítems y cantidades han sido escaneados y validados correctamente (`Total: 128 / 128`),
- **When** el estado cambia a "VERIFICADO AL 100%",
- **Then** el botón "Cerrar y Despachar Pedido" se habilita en color Verde destacado,
- **When** presiono el botón, la app muestra un modal de felicitaciones/éxito,
- **And** guarda el registro en el historial local con fecha, hora y detalle de escaneo,
- **And** deja la app lista para recibir un nuevo comprobante PDF.

---

### US-07: Asignación y Toma de Pedido en Depósito Multioferente
**Como** operario de depósito en un entorno con múltiples compañeros,  
**Quiero** seleccionar un pedido libre de la carpeta `./delivery/backlog/` y presionando "TOMAR PEDIDO",  
**Para** que el archivo se mueva a `./delivery/doing/{numero-pedido}-{identificador}.pdf` quedando asignado a mi dispositivo.

**Criterios de Aceptación:**
- **Given** que un comprobante PDF `34409313.pdf` se encuentra en la carpeta `./delivery/backlog/`,
- **When** el operario con el identificador `JAVIER-DEV82` selecciona el pedido y presiona "TOMAR PEDIDO",
- **Then** el archivo físico se renombra y mueve a `./delivery/doing/34409313-JAVIER-DEV82.pdf`,
- **And** el pedido cambia a estado `DOING` bloqueando la toma por parte de otros dispositivos.

---

### US-08: Liberación de Pedido en Trabajo (Doing -> Backlog)
**Como** operario de depósito,  
**Quiero** tener la opción de liberar un pedido que tengo asignado en `./delivery/doing/`,  
**Para** que otro compañero de depósito pueda continuarlo si debo atender otra urgencia.

**Criterios de Aceptación:**
- **Given** que tengo asignado el pedido `34409313-JAVIER-DEV82.pdf` en `./delivery/doing/`,
- **When** presiono el botón "LIBERAR PEDIDO",
- **Then** la app desasigna el pedido y mueve el archivo PDF de vuelta a `./delivery/backlog/34409313.pdf`,
- **And** el pedido vuelve a mostrarse libre para cualquier operario en la pantalla de inicio.

---

### US-09: Cierre con Marca de Agua e Identificador Auditado (Doing -> Done)
**Como** auditor de logística,  
**Quiero** que al finalizar la verificación el pedido se mueva a `./delivery/done/{numero-pedido}-{identificador}.pdf` con una marca de agua de auditoría,  
**Para** tener trazabilidad total e inalterable de quién realizó el despacho.

**Criterios de Aceptación:**
- **Given** que el pedido `34409313-JAVIER-DEV82.pdf` ha sido completado al 100% (o cerrado con PIN de supervisor),
- **When** presiono "CERRAR Y DESPACHAR PEDIDO",
- **Then** el archivo PDF se traslada a `./delivery/done/34409313-JAVIER-DEV82.pdf`,
- **And** se incrusta el sello digital / marca de agua conteniendo: `AUDITADO POR: JAVIER-DEV82 | FECHA: DD/MM/YYYY HH:mm | ESTADO: 100% OK`.

---

### US-10: Entorno de Trabajo Limpio y Exclusividad de Pedido Activo (Single Order Scope)
**Como** operario de depósito,  
**Quiero** ver únicamente mi pedido activo en pantalla sin interferencia ni contaminación visual de otros pedidos parseados en el sistema,  
**Para** enfocarme al 100% en la auditoría del comprobante que estoy procesando.

**Criterios de Aceptación:**
- **Given** que tengo un pedido asignado en `./delivery/doing/34512175-JAVIER-DEV82.pdf`,
- **When** navego por la aplicación,
- **Then** la app muestra EXCLUSIVAMENTE los productos y el estado de ese pedido activo,
- **And** NO muestra historial cruzado ni listas de productos de otros pedidos parseados,
- **And** en la pantalla principal muestra únicamente el acceso a mi pedido en proceso o la lista de comprobantes libres en `./delivery/backlog/` con bloqueo de toma hasta liberar el actual.


