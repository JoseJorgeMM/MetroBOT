# Diseño de Solución: Refinamiento de Geocodificación y Filtro de Outliers en Paradas

Este documento especifica el diseño técnico para solucionar los errores en la geocodificación de paradas de rutas integradas, las cuales causan que el enrutamiento sugiera caminatas incorrectas o paradas ubicadas en zonas lejanas (ej. paradas de Belén mapeadas en Bello).

## 1. Objetivos
- **Precisión Geográfica**: Garantizar que todas las paradas de la red de transporte integrado de Medellín tengan coordenadas reales alineadas con su ruta física.
- **Filtro de Falsos Positivos**: Detectar automáticamente si la API de geocodificación (Photon/Nominatim) devuelve una coordenada errónea (outlier) y descartarla en favor de la interpolación lineal.
- **Limpieza de Datos Históricos**: Identificar y eliminar del caché (`public/geocoding_cache.json`) las coordenadas erróneas actuales para evitar su reutilización.

## 2. Componentes de la Solución

### A. Normalizador de Direcciones e Intersecciones (`cleanQueryForGeocoding`)
Crearemos una función de limpieza de consultas que se integrará en los scripts de compilación (`compile_new_routes.cjs`, `compile_routes.cjs` y `compile_tpc_itagui.cjs`). Esta función procesará los nombres de paradas de la siguiente manera:

1. **Extracción de Nomenclatura**:
   - Si el nombre contiene paréntesis `(Dirección)`, se extrae el texto interno como la dirección principal.
2. **Determinación del Municipio**:
   - Escanea el texto buscando nombres de municipios del Valle de Aburrá (Medellín, Bello, Itagüí, Envigado, Sabaneta, Copacabana, Caldas, La Estrella, Barbosa, Girardota).
   - Guarda el municipio encontrado. Si no encuentra ninguno, asume `Medellín`.
3. **Expansión de Abreviaturas**:
   - Reemplaza `Kr`, `Cra`, `Cr` por `Carrera`.
   - Reemplaza `Cl`, `Cll` por `Calle`.
   - Reemplaza `Av` por `Avenida`.
   - Reemplaza `Diag` por `Diagonal`.
   - Reemplaza `Tv`, `Trans` por `Transversal`.
4. **Tratamiento de Direcciones vs Intersecciones**:
   - **Nomenclatura Domiciliaria (Con `#`)**: Si la dirección tiene `#` (ej. `Calle 51 # 42-33`), se expande la calle/carrera y **se mantiene el símbolo `#` intacto**.
   - **Intersección (Con `-` o `&` entre dos vías)**: Si tiene la estructura `Calle X - Carrera Y`, se convierte a `Calle X con Carrera Y` para las consultas.
5. **Generación del Query Final**:
   - Suffix final: `, [Municipio]`. (No se añadirá "Antioquia, Colombia" para evitar diluir los resultados de Photon).

### B. Algoritmo de Detección de Outliers (Durante la Compilación)
Al compilar cada ruta:
1. Cargamos las estaciones oficiales de SITVA desde `Estaciones_Sistema_Metro.csv`.
2. Para cada parada de la ruta:
   - Si la coordenada se geocodificó mediante la API:
     - Calculamos la distancia geodésica (Haversine) hasta la estación SITVA de conexión más cercana en esa ruta.
     - Si la distancia es **mayor a 3.5 km**, la coordenada se marca como un **outlier**.
     - La coordenada errónea se descarta (`hasCoords = false`), forzando a que sea calculada en el paso de interpolación lineal.
3. Se ejecuta la interpolación lineal habitual para rellenar las coordenadas de las paradas descartadas.

### C. Limpieza del Caché
Implementaremos un script de limpieza `clean_geocoding_cache.cjs` que:
1. Identifique los outliers de forma retroactiva.
2. Elimine esas claves de `public/geocoding_cache.json`.
3. Escriba el caché limpio de vuelta al disco.

## 3. Plan de Verificación
1. **Limpieza Inicial**: Ejecutar el script para eliminar las claves erróneas del caché.
2. **Re-compilación**: Ejecutar la compilación de rutas para geocodificar las paradas usando las consultas mejoradas.
3. **Validación de Outliers**: Ejecutar `analyze_outliers.cjs` y verificar que el porcentaje de outliers haya caído del 23.52% a prácticamente **0%**.
4. **Verificación de Enrutamiento**: Validar mediante tests automáticos o manuales que la ruta sugerida no contenga saltos geográficos erróneos.
