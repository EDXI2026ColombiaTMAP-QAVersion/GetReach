# Reach Automate

Herramienta web ligera para analizar una lista de URLs y obtener una estimación de tráfico mensual por dominio. El proyecto está pensado para uso interno y para presentaciones rápidas, porque todo vive en un solo archivo HTML y no necesita backend propio.

## Resumen ejecutivo

La aplicación permite:

1. Pegar una lista de enlaces, uno por línea.
2. Detectar el dominio de cada URL.
3. Consultar métricas de tráfico mensual desde fuentes públicas.
4. Mostrar una tabla con los resultados.
5. Copiar el resultado completo o solo los valores mensuales al portapapeles.

## Qué problema resuelve

Cuando se trabaja con muchas URLs, revisar una por una es lento y poco práctico. Esta herramienta automatiza la lectura, agrupa por dominio para evitar duplicados y devuelve una aproximación rápida del volumen mensual de visitas.

## Cómo funciona

El flujo principal ocurre en el navegador:

1. El usuario pega URLs en el cuadro de texto.
2. La app valida qué líneas parecen ser URLs.
3. Cada URL se normaliza para extraer su dominio.
4. Se eliminan dominios repetidos antes de consultar métricas.
5. La app intenta obtener datos desde HypeStat.
6. Si falla el acceso directo, usa proxies alternativos.
7. Con los valores encontrados, calcula un promedio entre las fuentes disponibles.
8. Finalmente muestra una tabla y habilita los botones de copia.

## Explicación del código

Todo el comportamiento vive en `index.html`, dividido en tres capas:

1. HTML: estructura de la pantalla.
2. CSS: estilos visuales.
3. JavaScript: toda la lógica de negocio.

### 1. Estructura HTML

La interfaz tiene cuatro partes principales:

1. El `textarea` para pegar URLs.
2. Los botones de acción.
3. El mensaje de estado.
4. El contenedor donde se renderiza la tabla de resultados.

La app usa un formulario con `id="uploadForm"` para capturar el clic en `Get Reach` y ejecutar todo el proceso desde un solo `submit`.

### 2. Estilos CSS

El CSS define el aspecto visual de la app:

1. Un fondo oscuro con gradientes radiales.
2. Una tarjeta central con borde y sombra.
3. Botones redondeados.
4. Una tabla con fondo semitransparente.

La tarjeta principal se centra dentro del `body`, y el contenedor de resultados usa `overflow: auto` para que la tabla pueda desplazarse sin romper el diseño.

### 3. Lógica JavaScript

La parte importante ocurre dentro del `<script>`.

#### Referencias al DOM

Primero se capturan los elementos de la interfaz:

1. `form`
2. `linksInput`
3. `statusEl`
4. `warningEl`
5. `submitBtn`
6. `copyBtn`
7. `copyMonthlyBtn`
8. `resultsEl`

Esto permite actualizar la pantalla en cada paso del proceso.

#### Normalización de URLs

La función `normalizeUrl()` revisa cada línea pegada por el usuario.

- Si la cadena ya empieza con `http://` o `https://`, la deja igual.
- Si no, agrega `https://` al inicio.

Eso hace que entradas como `example.com` sigan siendo válidas.

#### Validación básica

La función `isLikelyUrl()` intenta construir un objeto `URL`.

- Si falla, la línea no se considera URL.
- Si funciona y el hostname contiene un punto, se acepta.

Con esto se filtran líneas vacías o textos que no corresponden a sitios web.

#### Extracción del dominio

La función `extractDomain()` toma la URL y obtiene el hostname.

- Quita `www.`.
- Lo pasa a minúsculas.

Así, varias variantes del mismo sitio se agrupan bajo el mismo dominio.

#### Búsqueda de métricas

La función `fetchMetricsForDomain()` es la que consulta los datos externos.

Para cada dominio:

1. Construye la URL de HypeStat.
2. Intenta acceder directamente.
3. Si falla, usa servicios espejo/proxy.
4. Lee el contenido de la respuesta como texto.
5. Busca valores cercanos a la etiqueta `Monthly Visits`.

Si encuentra datos útiles, devuelve dos métricas:

1. `hypestatMonthlyVisits`
2. `similarwebMonthlyVisits`

#### Parseo de texto

La extracción se hace con expresiones regulares.

- `parseMetricNearLabel()` busca texto cercano a una etiqueta específica.
- `parseHypestatMonthlyVisits()` reutiliza esa lógica para HypeStat.
- `parseSimilarWebMonthlyVisits()` hace lo mismo para la variante SimilarWeb.

Esto permite sacar números aunque la página no tenga una estructura HTML ideal.

#### Conversión numérica

La función `parseNumericValue()` convierte valores como:

- `12.5K` a `12500`
- `2M` a `2000000`

Después, `formatMonthlyValue()` redondea el número final para mostrarlo de forma simple.

#### Control de concurrencia

La función `mapLimit()` ejecuta varias consultas, pero con un límite.

- El límite actual es 2.
- Eso evita mandar demasiadas solicitudes al mismo tiempo.

Es una forma simple de mantener la app estable y responsiva.

#### Render de resultados

Cuando termina el análisis:

1. Se arma una lista con las filas finales.
2. Se crea una tabla en memoria con `makeTable()`.
3. Se inserta dentro de `resultsEl`.
4. Se activan los botones de copia.

#### Copia al portapapeles

Hay dos salidas posibles:

1. `makeCopyText()` genera una versión tabulada con URL y valor.
2. `makeMonthlyOnlyText()` genera solo la columna de números.

Luego se usa `navigator.clipboard.writeText()` para copiar el contenido.

## Flujo completo de ejecución

Cuando el usuario presiona `Get Reach`, pasa esto:

1. Se detiene el envío normal del formulario con `event.preventDefault()`.
2. Se limpia el estado visual.
3. Se separan las líneas pegadas por el usuario.
4. Se filtran las URLs válidas.
5. Se extraen y deduplican dominios.
6. Se consultan fuentes externas por dominio.
7. Se calcula el promedio de tráfico mensual.
8. Se renderiza la tabla final.
9. Se habilitan los botones de copia.

## Qué puedes decir en la presentación

Si quieres explicarlo de forma clara y técnica, puedes usar este orden:

1. “La app está hecha en un solo HTML, sin framework.”
2. “Primero toma las URLs y las normaliza.”
3. “Luego extrae el dominio para evitar duplicados.”
4. “Después consulta HypeStat y usa proxies si hace falta.”
5. “Con los datos obtenidos, convierte texto a números.”
6. “Finalmente calcula el promedio y lo muestra en pantalla.”

## Fuentes de datos

La lógica de consulta intenta estas rutas en orden:

1. `https://hypestat.com/info/<dominio>`
2. `https://api.allorigins.win/raw?url=<url>`
3. `https://r.jina.ai/http://hypestat.com/info/<dominio>`

Si alguna respuesta contiene valores de "Monthly Visits", la app los usa. Cuando existen datos de más de una fuente, convierte los valores a número y calcula un promedio.

## Interfaz

La pantalla incluye:

1. Un área para pegar URLs.
2. Un botón principal para ejecutar el análisis.
3. Un botón para copiar la tabla completa.
4. Un botón para copiar solo los valores mensuales.
5. Un panel de resultados con formato de tabla.
6. Mensajes de estado para seguir el progreso.

## Lógica importante

### Normalización de URLs

Si una entrada no empieza con `http://` o `https://`, la app agrega `https://` automáticamente. Esto ayuda a procesar entradas como `example.com` o `www.example.com`.

### Detección de dominios

La app extrae el hostname de cada URL y elimina `www.` para que varias variantes del mismo sitio cuenten como un solo dominio.

### Control de duplicados

Antes de consultar fuentes externas, la aplicación crea una lista única de dominios. Eso reduce llamadas innecesarias y mejora el tiempo de respuesta.

### Límite de concurrencia

Las consultas se ejecutan con un máximo de dos dominios al mismo tiempo. Esto evita saturar el navegador y hace el proceso más estable.

### Copia al portapapeles

Después del análisis, se puede copiar:

1. La tabla completa en formato tabulado.
2. Solo la columna de valores mensuales.

## Estructura del proyecto

El proyecto es intencionalmente pequeño:

1. `index.html`  
   Contiene la interfaz, los estilos y toda la lógica de negocio en JavaScript.
2. `README.md`  
   Documentación del proyecto.
3. `vercel.json`  
   Configuración de despliegue para Vercel.

## Despliegue

La configuración de `vercel.json` redirige todas las rutas hacia `index.html`, lo que permite usar la app como una SPA estática.

## Cómo presentarlo en 20 minutos

Si vas a hacer una demo, esta secuencia funciona bien:

1. Contexto del problema: por qué analizar URLs manualmente es lento.
2. Objetivo de la herramienta: automatizar la extracción de métricas.
3. Vista general de la interfaz: campo de entrada, botones y tabla.
4. Flujo técnico: normalización, extracción de dominios y deduplicación.
5. Consulta de datos: HypeStat y mecanismos de respaldo.
6. Cálculo del resultado: conversión a números y promedio.
7. Experiencia de uso: copiar resultados completos o solo valores.
8. Cierre: ventajas, límites y posibles mejoras.

### Guion sugerido

- Minutos 0-3: problema y objetivo.
- Minutos 3-6: demo visual de la interfaz.
- Minutos 6-10: explicar la lógica de procesamiento.
- Minutos 10-14: fuentes de datos y manejo de fallos.
- Minutos 14-17: exportación y copia al portapapeles.
- Minutos 17-20: conclusiones y próximos pasos.

## Posibles mejoras

1. Exportar los resultados a CSV o Excel.
2. Guardar historial de búsquedas.
3. Agregar más fuentes de métricas.
4. Mejorar el manejo de errores cuando una fuente externa no responde.
5. Mostrar más de 20 filas en la vista previa.

## Notas técnicas

- La app no usa framework.
- No requiere backend propio.
- Toda la lógica se ejecuta en el navegador.
- El diseño está hecho con CSS embebido en el mismo archivo.
