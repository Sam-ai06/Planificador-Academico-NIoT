# Planificador Académico Inteligente · NIoT

Frontend del hackathon: React, TypeScript, Vite, React Router y Tailwind CSS. Funciona con datos de demostración y conserva el trabajo en `localStorage` (`niot-academic-v1`). Incluye un servicio local Python para convertir PDFs; no incluye backend académico ni claves de IA.

## Ejecutar

Requiere Node.js 24.18 o posterior y npm. Las pruebas usan el soporte nativo para TypeScript.

```sh
npm install
npm run dev
```

En PowerShell, si la política bloquea `npm.ps1`, utiliza `npm.cmd`.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Módulos y rutas

| Ruta | Comportamiento |
| --- | --- |
| `/` | Resumen, avance por créditos, materias aprobadas, en curso y habilitadas. |
| `/curriculum` | Materias por semestre, estados, detalles en diálogo y exploración de prerrequisitos y materias desbloqueadas. |
| `/profile` | Progreso por materia, máximo de carga, bloques semanales e intereses, con guardado local. |
| `/planner` | Selección y eliminación de materias en varios semestres, generación determinista, créditos, advertencias y alternativas. |
| `/scenarios` | Comparación de dos alternativas, materias y créditos por semestre, duración, materias sin planificar y desbloqueadas, plan principal y edición. |
| `/replanning` | Simula reprobación, menor carga, disponibilidad, intereses o falta de oferta; compara planes y cambios, confirma o descarta. |
| `/assistant` | Chat con contexto opcional, ejemplos, estados de carga/error y explicaciones marcadas como demostración. |
| `/export` | Resumen, fecha, parámetros, JSON, impresión/PDF del navegador e interfaz para compartir. |
| `/curriculums` | Conversión PDF a JSON editable, importación JSON, validación, vista previa y selección de mallas. |

Cambiar de malla reinicia el perfil, el plan y los escenarios del espacio de trabajo; la interfaz lo informa. Las mallas importadas se conservan. Exporta tus planes antes de cambiar.

## Conversor de mallas PDF a JSON

El conversor utiliza [pdfplumber](https://github.com/jsvine/pdfplumber) en un servicio Python local. Los archivos se procesan en memoria y no se guardan en el servidor. Esta función es real y no depende del modo mock ni de Gemma.

Requiere Python 3.10 o posterior. Preparación inicial en Windows:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tools/pdf_converter/requirements.txt
```

En Linux/macOS utiliza `python3 -m venv .venv` y `.venv/bin/python -m pip install -r tools/pdf_converter/requirements.txt`. También puedes crear el entorno con `uv venv`. Si tu Python está en otra ubicación, configura `PDF_PYTHON` con la ruta del intérprete. El script npm detecta el entorno virtual según el sistema operativo.

Inicia el conversor en una terminal y Vite en otra:

```sh
# Terminal 1: servicio Python, puerto 8001
npm run pdf:serve

# Terminal 2: frontend
npm run dev
```

Ve a **Gestionar mallas → Convertir malla PDF a JSON**, introduce ID, carrera e institución y selecciona el PDF. El resultado muestra advertencias, texto extraído y un editor JSON. Revisa y corrige los datos; después puedes descargar el JSON o marcar la revisión y enviarlo a la vista previa. La importación reutiliza las validaciones de estructura, duplicados, referencias y ciclos.

Formatos soportados:

- PDFs con texto seleccionable y tablas con o sin bordes; tablas escaneadas y mallas gráficas con recuadros mediante OCR local.
- Encabezados de código, asignatura/nombre y créditos; semestre en columna o en un título como `Semestre II`.
- Alias de encabezados en español e inglés, créditos decimales y prerrequisitos separados por comas o punto y coma.
- Hasta 10 MB, 50 páginas y 2000 materias; máximo 5 páginas que requieran OCR. El tiempo de espera es de 4 minutos.

No se inventan créditos: cuando una malla gráfica expresa horas se utiliza `credits: null`, `hours` y, si es legible, `hoursBreakdown` con docencia, prácticas y trabajo autónomo. Las horas se conservan en la unidad original, sin multiplicarlas por semanas ni convertirlas a créditos. El frontend adapta avance, tarjetas, planificación, comparación y exportación a esa unidad. Si conviven materias con unidades distintas, el resumen cuenta materias para evitar sumar horas con créditos.

Las etiquetas `NIVEL 100 - I` a `NIVEL 400 - II` o `Semestre VI` se leen con OCR para identificar semestres. Una actividad sin etiqueta conserva `semester: null` y `semesterUnspecified: true`; no se le asigna un período arbitrario. Las actividades sin código legible reciben un ID técnico `SIN-CODIGO-P…` y `sourceCodeMissing: true`, que no representa un código oficial.

Se reconocen flechas y conectores continuos/discontinuos para proponer prerrequisitos y correquisitos según la simbología de esta clase de diagramas. Los conectores aislados o directos se incorporan como propuestas; los cruces, ramificaciones y orígenes inciertos se muestran para selección manual. Hay un visor del PDF original, evidencia OCR por materia y edición de todas las relaciones. Para importar o descargar una conversión OCR hay que resolver o descartar las flechas ambiguas y confirmar la revisión. El detector puede omitir flechas: siempre compara todas las relaciones con el original. Los trazados y simbologías de otras instituciones pueden requerir adaptación; no se garantiza interpretar cualquier diagrama.

`corequisites` referencia IDs, igual que `prerequisites`, y se valida por separado. Los correquisitos pueden aprobarse antes o cursarse juntos. El generador y la selección manual agregan el grupo de correquisitos cuando cabe en el límite de carga y todos sus prerrequisitos están cumplidos. Si el grupo no cabe, se informa para que el estudiante ajuste su máximo. Los ciclos de correquisitos mutuos son válidos; los ciclos de prerrequisitos se rechazan.

El OCR se ejecuta con RapidOCR/ONNX Runtime y OpenCV. Los modelos vienen con el paquete instalado y el PDF se procesa localmente, sin servicios de IA externos. Actualiza las dependencias de `.venv` con el mismo archivo de requisitos y reinicia `npm run pdf:serve` después de actualizar Python.

También puedes usar la línea de comandos:

```powershell
.\.venv\Scripts\python.exe -m tools.pdf_converter "malla.pdf" --id mi-carrera --name "Mi carrera" --institution "Mi universidad" --output "malla.json"
```

El CLI escribe la malla en el archivo indicado e informa advertencias en stderr; el JSON debe revisarse y validarse antes de utilizarlo.

Pruebas del conversor:

```sh
npm run pdf:test
```

Archivos: `tools/pdf_converter/` contiene extractor, servidor, CLI y pruebas; `scripts/pdf-tool.mjs` inicia Python; `src/features/administration/components/PdfCurriculumConverter.tsx` contiene el formulario/editor y `services/pdfConverter.ts` el cliente HTTP.

API local disponible:

- `POST /api/curriculums/convert-pdf?id=...&name=...&institution=...`: cuerpo PDF binario con `Content-Type: application/pdf`. Devuelve `{ curriculum, warnings, pageCount, textPreview }`.
- `GET /api/curriculums/converter-health`: comprueba el servicio y las bibliotecas instaladas; incluye `ocr` y `graphical`.

La respuesta de conversión también incluye `usedOcr`, `relations` (orígenes propuestos o candidatos pendientes) y `evidence` (texto, confianza, página y recuadro normalizado). La confianza OCR orienta la revisión y no equivale a una garantía de exactitud académica.

Vite reenvía estas dos rutas a `http://127.0.0.1:8001`. Reinicia `npm run dev` después de actualizar la configuración. Para producción, configura el mismo enrutamiento en el servidor que publique el frontend; el servidor HTTP de Python incluido está destinado al desarrollo local. `vite preview` no inicia ni sustituye el servicio Python.

## Archivos creados o modificados

- `src/app/`: aplicación, rutas y proveedor del estado compartido.
- `src/components/`: navegación, disposición, diálogo y componentes comunes.
- `src/features/`: los ocho módulos y el dashboard.
- `src/features/planner/services/planning.ts`: elegibilidad, generación, advertencias y métricas independientes de React.
- `src/features/administration/validation.ts`: estructura, duplicados, referencias y ciclos.
- `src/features/assistant/services/assistant.ts`: explicaciones simuladas.
- `src/services/`: transporte HTTP, proveedor mock/API y validación del estado persistido.
- `src/types/`: contratos y constantes compartidas.
- `src/data/mockCurriculum.json`: malla ilustrativa de 18 materias y seis semestres sugeridos.
- `src/index.css`: estilos responsive, estados académicos, foco visible e impresión.
- `tests/`: reglas críticas y renderizado de las nueve vistas con el proveedor real.

Se sustituyeron la pantalla de bienvenida de Vite y sus entradas JSX por `src/main.tsx` y `src/app/App.tsx`. Se modificaron `index.html`, `vite.config.js`, `eslint.config.js`, `package.json` y el lockfile; se añadieron `tsconfig.json`, `src/vite-env.d.ts` y `.env.example`.

## Reglas académicas

1. Solo las materias aprobadas habilitan inicialmente sus dependientes. Las materias en curso o reprobadas siguen pendientes de completar.
2. Se supone que las materias planificadas se aprueban; habilitan sus dependientes en el semestre siguiente, nunca en el mismo.
3. Se respeta el máximo de materias y se evitan materias repetidas o ya aprobadas.
4. El generador ordena por intereses, semestre sugerido y código: mismos datos y restricciones producen el mismo plan.
5. Quitar un prerrequisito o cambiar el perfil puede invalidar un plan existente. Se muestran advertencias y no se guardan alternativas inválidas. Los escenarios guardan sus parámetros originales.
6. La replanificación no altera el plan ni el perfil hasta confirmar. El evento simulado se conserva en la exportación.
7. No se inventan horarios, cupos u oferta. La duración se estima en semestres, supone aprobar las materias y no equivale a una fecha de graduación.

## Formato de las mallas

```json
{
  "id": "mi-carrera",
  "name": "Nombre de la carrera",
  "institution": "Mi universidad",
  "courses": [
    {
      "id": "mat1",
      "code": "MAT101",
      "name": "Matemática I",
      "credits": 4,
      "semester": 1,
      "prerequisites": [],
      "area": "Ciencia de datos"
    }
  ]
}
```

`area` y `corequisites` son opcionales. Los prerrequisitos/correquisitos referencian `id`; los créditos son positivos o `null` cuando se declaran `hours` positivas. Los semestres son enteros positivos o `null` acompañado de `semesterUnspecified: true`. Se rechazan duplicados, referencias inexistentes y ciclos de prerrequisitos. No se sobreescribe una malla con el mismo ID.

## Backend posterior

El modo predeterminado es `mock`. Para usar el transporte HTTP preparado, configura `VITE_DATA_SOURCE=api` en `.env.local` y reinicia Vite. `src/services/academicService.ts` ofrece el mismo contrato para ambos proveedores. No hay llamadas a Gemma desde el navegador.

| Endpoint preparado | Solicitud | Respuesta |
| --- | --- | --- |
| `POST /api/plans/generate` | `{ curriculum: Curriculum, profile: StudentProfile, unavailable?: { courseId, semester } }` | `PlannedSemester[]` |
| `POST /api/assistant/explain` | `{ question: string, context?: { curriculum, profile, plan } }` | `{ message: string }` |

El backend deberá aplicar las reglas deterministas y llamar a Gemma solo para explicar recomendaciones. Si se desarrolla en otro puerto, configura un proxy `/api` en Vite o sirve ambos bajo el mismo origen.

Para sustituir también el almacenamiento local se proponen `GET /api/curriculums`, `POST /api/curriculums`, `GET/PUT /api/profile`, `GET/POST /api/scenarios`, `PUT /api/scenarios/:id` y `POST /api/plans/:id/share`. Estas rutas todavía no se invocan ni existe un servicio real para compartir.

## Dependencias añadidas

- `react-router-dom`: navegación entre las nueve rutas.
- `tailwindcss`, `@tailwindcss/vite`: integración de Tailwind con Vite.
- `typescript`, `typescript-eslint`: tipos estrictos y lint TS/TSX.
- `@types/node`: tipos para las pruebas de Node.
- `pdfplumber` (Python): extracción de texto y tablas de las mallas PDF; sus dependencias se instalan dentro de `.venv`.
- `rapidocr-onnxruntime`, `opencv-python` (Python): OCR local, detección de recuadros, celdas y conectores. ONNX Runtime, NumPy y el resto se instalan como dependencias en `.venv`.

No se añadieron bibliotecas de estado, formularios, gráficos, IA o pruebas. Se reutiliza React y se usan controles nativos y el ejecutor de pruebas de Node.

## Validación y limitaciones

Se ejecutaron TypeScript, lint, pruebas y compilación. Las pruebas cubren prerrequisitos, duplicados, referencias, ciclos, generación determinista, carga, estados de materias, oferta simulada, advertencias, métricas, ausencia de mutación y renderizado de todas las vistas.

La malla, las explicaciones y la generación son locales. No hay autenticación, sincronización, mallas universitarias oficiales, horarios de materias, cupos, calendario real, Gemma ni servicio para compartir. La impresión depende del navegador. Borrar el almacenamiento del navegador elimina los datos; exporta copias. El alojamiento debe reenviar las rutas de la SPA a `index.html`.

La verificación automática incluye el renderizado, pero no interacción en un navegador: este entorno no expone herramientas de control de navegador. Queda pendiente una revisión visual e interactiva en escritorio y móvil.
