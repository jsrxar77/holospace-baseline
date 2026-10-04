---
name: holospace-architect
description: Arquitecto de Software especialista en aplicaciones modulares HoloSpace Baseline. Usar para diseñar módulos, auditar arquitectura, refactorizar o validar el cumplimiento de /docs.
---

# Skill: Arquitecto de Software HoloSpace Baseline

> Esta habilidad define los procedimientos y listas de chequeo que debe ejecutar el agente para cualquier diseño o implementación en HoloSpace Baseline.

---

## Flujo de Trabajo Obligatorio para el Agente

### 1. Fase de Lectura de Contexto (/docs)
Antes de responder o realizar cambios estructurales, consultar los documentos canónicos en `/docs/` según corresponda:
- `docs/README.md` (Guía de inicio y Docker)
- `docs/ARCHITECTURE.md` (Arquitectura técnica, PostgreSQL RLS, Docker y temas)
- `docs/MODULES.md` (Especificación oficial de módulos y guía de creación)
- `docs/FEATURES.md` (Permisos RBAC, planes SaaS y facturación)
- `docs/CONTENT.md` (Diseño, copy y sprites)
- `docs/ROADMAP.md` (Trazabilidad y estados de desarrollo)
- `docs/DEBT.md` (Deuda tecnica priorizada)

### 2. Workflow de Impacto Integral 360° (Obligatorio en Cada Tarea)
Ante cada requerimiento o cambio, ejecutar el ciclo de verificación en los 4 pilares:
1. **Código:** Aplicar cambios aditivos sin romper funcionalidades previas ni estilos existentes (ej. temas y bordes Omarchy 4px).
2. **Tests:** Ejecutar la suite automatizada (`docker compose exec app node tests/run-all-tests.js`) asegurando 0 errores.
3. **Documentación:** Actualizar `README.md` y los archivos correspondientes en `/docs/` eliminando discrepancias o redundancias.
4. **Roadmap & Auditoría:** Actualizar `docs/ROADMAP.md` marcando casillas `[x]` y registrar acciones en `platform_audit_logs`.

### 3. Checklist de Validación Arquitectónica
Verificar que todo nuevo cambio o propuesta cumpla con:
- [ ] **Aislamiento Estricto Multi-Tenant (Regla de Oro - Cero Data Leakage)**: Ningún usuario u operario puede visualizar, listar o modificar datos de otra organización (`tenant_id`). Todas las consultas SQL filtran obligatoriamente por `tenant_id` y por rol (`RBAC`).
- [ ] **Control de Acceso y Mensajes 403**: Si un usuario intenta acceder a una ruta o módulo no autorizado (`/tenant`, `/core`), el sistema muestra explícitamente la pantalla y logs de "Acceso Restringido (403)" con su rol y organización.
- [ ] **Estructura en `modules/`**: El código pertenece a su módulo correspondiente.
- [ ] **Rutas `/api/<modulo>/`**: Los nuevos endpoints siguen la convención de enrutamiento prefijado.
- [ ] **RBAC Server-side**: Se valida el rol del usuario (`SUPERADMIN`, `ADMIN`, `OPERATOR`).
- [ ] **Tema dinámico**: Los elementos UI usan las variables CSS globales (`var(--card-bg)`, `var(--emerald)`, etc.).
- [ ] **Cero Emojis / Emoticones**: La interfaz, textos, logs, base de datos y documentación siguen un diseño sobrio sin ningún tipo de emoji.
- [ ] **100% Dockerizado**: El stack en `docker-compose.yml` debe ser la referencia principal y única.
- [ ] **Documentación y README sincronizados**: Sin instrucciones contradictorias.

## Un solo modelo por entidad (regla obligatoria)
Origen: 2026-10-03, Competencia tenia su propia lista de productos, separada del catalogo, y la sugerencia de precios leia una tercera tabla. Resultado: el usuario cargaba lo mismo en varios lugares y el calculo no veia lo que cargaba. Antes de cerrar:
1. Cada entidad tiene una sola tabla de referencia. Si una pantalla necesita un dato de otra entidad, se referencia por id, no se copia.
2. Se verifica de punta a punta: lo que guarda la pantalla lo lee el calculo o el worker. Ejemplo real: los costos se guardaban en una tabla de reglas que nadie leia, y la sugerencia nunca se calculaba.
3. Los menus siguen el flujo del usuario, no la estructura de la base. Lo que no suma al flujo se saca del menu y del codigo.

## Cierre de tarea (checklist antes de decir 'listo')
1. git status limpio; cada cambio logico en su commit con trailer Co-Authored-By.
2. Push solo si fue pedido o esta en el plan aprobado; despues, verificar en produccion.
3. 'Publicado' solo si se verifico lo que ve el usuario (pantalla o respuesta real). Si no, decir que falta y quien lo puede hacer.
4. Cerrar con 3 lineas: que cambio, que esta en produccion, que queda pendiente.

## Datos y fuentes (regla obligatoria)
Origen: 2026-10-04, el alta de producto pedia a mano nombre, codigo y precio aunque se pegara un link que el sistema ya sabia leer, y caia en silencio a un precio escrito si el link fallaba. Antes de cerrar un alta o una carga:
1. Lo que el sistema puede obtener solo no se pide; se muestra lo leido antes de guardar.
2. Si la fuente falla se informa el motivo y se ofrece cargar a mano; nunca se guarda a medias ni se cae en silencio a otra fuente.
3. Todo pedido saliente a una direccion escrita por un usuario pasa por url_guard.
4. Se recorre en un navegador aislado con sesion de prueba, no solo con pruebas.

## Textos de producto
Toda pantalla, modal, mensaje o error visible sigue la skill `holospace-copy` (contrato titulo + bajada, glosario, voz rioplatense) y `docs/CONTENT.md` 0.2. Antes de dar un cambio por terminado: `node tests/test-copy.js` (dentro de Docker: `docker compose exec app node tests/test-copy.js`).

## Regla de oro: ver el conjunto, no solo la parte pedida
Origen: 2026-10-03, dos bugs enviados a produccion el mismo dia por resolver la parte pedida sin mirar lo que la rodea (detalle en `docs/DEBT.md`, postmortem S-027). De aca en mas, antes de dar por terminada una funcionalidad o un arreglo:

1. **Componentes visuales compartidos.** Si lo que se crea o se toca es un patron que ya existe en otro lugar (selector, boton, insignia, tarjeta, modal) — landing, app, Scanner — buscar su version actual ahi antes de escribir el propio. Sin un pedido explicito de rediseñarlo, se usa el mismo diseño (mismo marcado o el mismo componente compartido en `modules/themes/holo.css`); nunca uno nuevo "parecido". Si una inconsistencia real no se puede resolver en la misma tarea, se avisa antes de entregar, no se entrega en silencio. Ejemplo real: el selector de tema era un `<select>` en la app y un boton icono+palabra en la landing; se unifico en `.hs-theme-toggle`, un solo componente para los dos.
2. **Mapa de superficie antes de cerrar.** Al tocar una funcion, un endpoint o el formato de una respuesta, listar *todos* los lugares que lo llaman (`grep` del nombre de la funcion/endpoint en `public/`, `modules/` y el Scanner) y confirmar que cada uno sigue funcionando con el cambio — no solo el que se uso para probar. Ejemplo real: se agrego `warning` y datos de diagnostico a la respuesta de revisar un rival, pero el boton "Revisar ahora" (que ya existia antes del cambio) nunca se actualizo para mostrarlos: quedaba en silencio.
3. **Datos externos, nunca solo con un ejemplo armado a mano.** Todo parser o extractor que lea HTML, PDF o una respuesta de un tercero se prueba contra al menos una muestra real (una pagina real descargada, no solo un fixture inventado) antes de darse por terminado, ademas de los casos sinteticos. Esa muestra real queda como archivo de prueba permanente (`tests/fixtures/`) para que la regresion no pueda volver en silencio. Ejemplo real: el extractor de precios leia bien contra JSON-LD armado a mano, pero una tienda real anida el producto dentro de `WebPage > mainEntity` junto con productos "relacionados"; sin una muestra real, ese caso no se habia visto nunca.
4. **Verificar contra el entorno real despues de desplegar.** Que algo funcione en Docker local y pase los tests no alcanza: despues de un push a produccion hay que confirmar contra el dominio publico, no solo contra `localhost`. Si algo se ve raro en el sitio real, primero se mira el estado de los contenedores y los logs de infraestructura (`docker compose ps`, `docker logs`) antes de asumir que el codigo nuevo esta mal. Ejemplo real: un error "X is not defined" en produccion no era un bug del archivo nuevo -- era nginx cayendose en cada despliegue por no resolver el contenedor `app` a tiempo (ver DEBT S-029); revisar el entorno antes que el codigo evito corregir algo que ya andaba bien.
