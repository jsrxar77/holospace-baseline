# 4see: brief del flujo

## Objetivo final

Que un vendedor sepa, para cada producto, **a qué precio conviene venderlo** frente a sus competidores, **sin bajar de su margen mínimo** y **sin que holospace. invente un dato**. El sistema propone; el dueño decide y aplica.

Lo que lo hace vendible: en pocos minutos, el vendedor ve dónde pierde plata (precio por debajo del piso), dónde le conviene subir (rivales más caros o sin stock), y qué precio exacto proponer.

## Quién lo usa

Dueño o encargado de una tienda online que vende muchos productos y compite con otras tiendas por los mismos. No es analista: necesita entender cada pantalla sin manual.

## El flujo, paso a paso

El flujo tiene cuatro pasos y cada uno desbloquea el siguiente. La pantalla **Productos** muestra el mapa y el estado de cada paso.

### 1. Catálogo

**Para qué:** tener los productos que vendés, una sola vez.

**Qué pide o suma:**
- Título del producto (obligatorio).
- Código (SKU) (obligatorio, único dentro de tu cuenta).
- Tu precio (obligatorio, salvo que venga de tu tienda conectada o de tu link de producto). Si no hay ninguna fuente, la carga se rechaza: no se inventa un precio.
- Tienda y link propio (opcionales). Si los cargás, el precio se lee de ahí.

**Qué aporta:** es la base de todo. Sin productos no hay nada que comparar.

**Por qué está primero:** todo lo demás se pega a un producto del catálogo. Así no se carga el mismo producto en varios lugares.

**Cómo se desbloquea el paso 2:** con al menos un producto cargado.

### 2. Análisis

**Para qué:** elegir qué productos seguís de cerca y de quién.

**Qué pide o suma:**
- Marcar **Analizar** en cada producto que querés seguir. El plan define cuántos entran (Simple 5, Business 13, Enterprise 55).
- Por cada rival del producto: el link de su página de producto (obligatorio), un nombre (opcional).
- Por cada rival, holospace lee solo: su precio y su stock. Si no puede leerlo, lo dice y no inventa un valor.

**Qué aporta:** la comparación real con la competencia. Cada rival es una fuente de precio; el sistema compara tu precio contra todos.

**Por qué va antes de costos:** solo tiene sentido cargar costos de lo que comparás. Y las sugerencias necesitan al menos un rival leído.

**Límite por producto:** Simple 3, Business 8, Enterprise 21 rivales por producto.

**Cómo se desbloquea el paso 3:** con al menos un producto en análisis.

### 3. Costos

**Para qué:** saber cuánto te cuesta vender cada producto, para que ningún precio sugerido te deje en pérdida.

**Qué pide o suma:**
- Costo del producto (obligatorio, mayor a cero).
- Costos operativos: envío, comisiones, empaque (opcional, cero por defecto).
- Margen mínimo en porcentaje (opcional).
- Precio tope (opcional): el precio más alto que aceptás.

**Qué aporta:** el **piso de margen**, que se calcula solo: costo × (1 + margen %) + costos operativos. Ese piso es el precio mínimo que el sistema nunca propone.

**Por qué va en este lugar:** el piso es la línea de seguridad. Sin costo no hay piso, y sin piso no hay sugerencia confiable.

**Cómo se desbloquea el paso 4:** con un producto en análisis, un rival leído y los costos cargados.

### 4. Sugerencias

**Para qué:** decidir precios.

**Qué muestra:**
- Por producto: precio actual, precio sugerido, piso de margen y la regla que se aplicó.
- Si el precio sugerido se frenó en el piso ("frenado por tu piso de margen").
- Un estado por propuesta: para decidir, aplicada, descartada.

**Qué hacés:** aplicar o descartar cada propuesta. Nada se aplica sin tu decisión.

**Regla por defecto:** si no definís reglas propias, te acercamos 1% por debajo del rival más barato con stock, sin bajar de tu piso ni superar tu tope. **Reglas de precio (opcionales):** si querés otra estrategia (por ejemplo, igualar a un rival puntual), la definís ahí y tiene prioridad sobre la regla por defecto.

**Cómo se actualiza:** con **Revisar precios ahora**. Hoy no hay una lectura automática programada; es un pendiente conocido.

## Por qué este orden tiene sentido

1. Catálogo: sin productos no hay qué analizar.
2. Análisis: sin rivales no hay comparación.
3. Costos: sin costo no hay piso, y sin piso no se puede sugerir un precio seguro.
4. Sugerencias: solo cuando hay comparación y piso, la propuesta es confiable.

El orden de 2 y 3 se puede invertir después de tener un producto en análisis. Lo que nunca se puede invertir es que las sugerencias vayan antes de los datos que las sostienen.

## Reglas que no se rompen

- Ningún precio, costo o stock se inventa. Si falta, queda vacío y se dice.
- Un producto se carga una vez, en el catálogo.
- Un rival solo se suma a un producto que está en análisis.
- Ninguna propuesta se aplica sin decisión del dueño.
- Los límites del plan se controlan en el servidor, no solo en pantalla.

## Qué no es (por ahora)

- No es un repricer automático: no cambia precios sin aprobación.
- No es un scraper general: lee la página del rival que el usuario pega, y si no puede leerla, lo informa.
- No tiene lectura programada: la competencia se relee a mano.
