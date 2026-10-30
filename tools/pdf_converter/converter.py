"""Extracción determinista de tablas académicas; no infiere datos ausentes."""

from __future__ import annotations

from io import BytesIO
from bisect import bisect_right
import re
import unicodedata
from typing import Any

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 50
MAX_COURSES = 2000


class ConversionError(ValueError):
    """El archivo no puede convertirse con el formato soportado."""


def normalized(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return re.sub(r"[^a-z0-9]+", " ", text.encode("ascii", "ignore").decode().lower()).strip()


HEADERS = {
    "code": {"codigo", "cod", "codigo asignatura", "codigo de asignatura", "codigo materia", "code", "course code"},
    "name": {"nombre", "asignatura", "materia", "nombre asignatura", "nombre de asignatura", "nombre de la asignatura", "nombre de la materia", "course", "course name", "subject"},
    "credits": {"creditos", "credito", "cr", "cred", "credits", "credit"},
    "semester": {"semestre", "nivel", "periodo", "ciclo", "semester", "term"},
    "prerequisites": {"prerrequisito", "prerrequisitos", "pre requisito", "pre requisitos", "pre requisitos academicos", "requisito", "requisitos", "prerequisites", "prerequisite"},
}
ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}


def header_map(row: list[Any]) -> dict[str, int] | None:
    result = {}
    for index, cell in enumerate(row):
        label = normalized(cell)
        for field, aliases in HEADERS.items():
            if label in aliases:
                result[field] = index
    return result if {"code", "name", "credits"} <= result.keys() else None


def number(value: str, integer: bool = False) -> int | float | None:
    value = value.strip().replace(",", ".")
    if integer and value.lower() in ROMAN:
        return ROMAN[value.lower()]
    if not re.fullmatch(r"\d+(?:\.\d+)?", value):
        return None
    parsed = float(value)
    if parsed <= 0 or (integer and not parsed.is_integer()):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def semester_heading(text: str) -> int | None:
    match = re.fullmatch(r"\s*(?:semestre|nivel|ciclo|periodo|semester)\s*[:\-]?\s*(\d+|[ivx]+)\s*", normalized(text))
    if not match:
        return None
    return int(number(match.group(1), integer=True) or 0) or None


def course_code(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).upper()


def parse_prerequisites(value: str) -> list[str]:
    if normalized(value) in {"", "ninguno", "ninguna", "sin requisitos", "sin prerrequisitos", "no tiene", "no aplica", "n a", "na", "none"} or value.strip() in {"-", "—", "–"}:
        return []
    # Solo separadores explícitos: no se intenta interpretar requisitos lógicos.
    return [course_code(part) for part in re.split(r"[,;\n]+", value) if part.strip()]


def parse_rows(
    rows: list[list[Any]], warnings: list[str], *, context: int | None = None,
    previous_headers: dict[str, int] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int] | None, int | None]:
    courses = []
    headers = previous_headers
    for row in rows:
        if not row or not any(str(cell or "").strip() for cell in row):
            continue
        new_headers = header_map(row)
        if new_headers:
            headers = new_headers
            continue
        nonempty = [str(cell).strip() for cell in row if cell and str(cell).strip()]
        heading = semester_heading(" ".join(nonempty))
        if heading:
            context = heading
            continue
        if not headers:
            continue

        def cell(field: str) -> str:
            index = headers.get(field)
            return str(row[index] or "").strip() if index is not None and index < len(row) else ""

        code = course_code(cell("code"))
        if normalized(code).startswith(("total", "subtotal")):
            continue
        if not code and not cell("name"):
            continue
        if not code or not cell("name"):
            warnings.append(f"Fila incompleta conservada para revisión: {code or cell('name') or '(sin código)' }.")
        credits = number(cell("credits"))
        semester = number(cell("semester"), integer=True) if "semester" in headers else context
        if credits is None:
            warnings.append(f"{code}: créditos ausentes o ambiguos; corrige el valor null en el JSON.")
        if semester is None:
            warnings.append(f"{code}: semestre no identificado; corrige el valor null en el JSON.")
        if "prerequisites" not in headers:
            warnings.append("No se identificó una columna de prerrequisitos. Las listas vacías deben verificarse y completarse antes de importar.")
        courses.append({"id": code, "code": code, "name": " ".join(cell("name").split()), "credits": credits, "semester": semester, "prerequisites": parse_prerequisites(cell("prerequisites"))})
        if len(courses) > MAX_COURSES:
            raise ConversionError(f"La malla supera el límite de {MAX_COURSES} materias.")
    return courses, headers, context


def text_rows(text: str) -> list[list[str]]:
    """Tablas sin bordes: columnas separadas por tabulaciones, | o varios espacios."""
    return [re.split(r"\s*\|\s*|\t+| {2,}", line.strip()) for line in text.splitlines() if line.strip()]


def positioned_rows(words: list[dict[str, Any]]) -> list[list[str]]:
    """Reconstruye columnas usando la posición de los encabezados del PDF."""
    lines: list[list[dict[str, Any]]] = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not lines or abs(lines[-1][0]["top"] - word["top"]) > 3:
            lines.append([word])
        else:
            lines[-1].append(word)
    output = []
    anchors: list[tuple[float, str]] = []
    for line in lines:
        line.sort(key=lambda word: word["x0"])
        candidate = []
        index = 0
        while index < len(line):
            matched = False
            for size in range(min(5, len(line) - index), 0, -1):
                # No unir encabezados de columnas distintas (p. ej. Código | Asignatura).
                if any(line[j+1]["x0"] - line[j]["x1"] > 12 for j in range(index, index+size-1)):
                    continue
                phrase = " ".join(w["text"] for w in line[index:index+size])
                if any(normalized(phrase) in aliases for aliases in HEADERS.values()):
                    candidate.append((line[index]["x0"], phrase))
                    index += size
                    matched = True
                    break
            if not matched:
                index += 1
        if header_map([phrase for _, phrase in candidate]):
            anchors = candidate
            output.append([phrase for _, phrase in anchors])
            continue
        if not anchors:
            output.append([" ".join(w["text"] for w in line)])
            continue
        boundaries = [x - 2 for x, _ in anchors[1:]]
        row = [""] * len(anchors)
        for word in line:
            column = bisect_right(boundaries, word["x0"])
            row[column] = (row[column] + " " + word["text"]).strip()
        output.append(row)
    return output


def convert_pdf(data: bytes, *, curriculum_id: str, name: str, institution: str) -> dict[str, Any]:
    if not all(isinstance(v, str) and v.strip() for v in [curriculum_id, name, institution]):
        raise ConversionError("Completa el identificador, nombre de la carrera e institución.")
    if any(len(v) > 200 for v in [curriculum_id, name, institution]):
        raise ConversionError("Los datos de la malla no pueden superar 200 caracteres por campo.")
    if len(data) > MAX_BYTES:
        raise ConversionError("El PDF no puede superar 10 MB.")
    if not data.startswith(b"%PDF-"):
        raise ConversionError("El archivo recibido no es un PDF válido.")
    # Importación diferida: las reglas del parser pueden probarse sin dependencias.
    try:
        import pdfplumber
    except ImportError as exc:
        raise RuntimeError("Falta pdfplumber. Instala tools/pdf_converter/requirements.txt.") from exc

    warnings: list[str] = []
    courses: list[dict[str, Any]] = []
    headers = None
    context = None
    extracts = []
    relations = []
    evidence = []
    ocr_pages = 0
    try:
        with pdfplumber.open(BytesIO(data)) as document:
            pages = len(document.pages)
            if pages > MAX_PAGES:
                raise ConversionError(f"El PDF no puede superar {MAX_PAGES} páginas.")
            for index, page in enumerate(document.pages, start=1):
                text = page.extract_text(layout=True) or ""
                extracts.append(text[:4000])
                page_courses = []
                for table in page.find_tables():
                    # Algunas mallas indican el semestre en un título sobre cada tabla.
                    if table.bbox[1] > 0:
                        above = page.crop((0, 0, page.width, table.bbox[1])).extract_text() or ""
                        for line in above.splitlines():
                            context = semester_heading(line) or context
                    parsed, headers, context = parse_rows(table.extract(), warnings, context=context, previous_headers=headers)
                    page_courses.extend(parsed)
                    if not parsed:
                        warnings.append(f"Página {index}: una tabla no produjo materias reconocibles; compárala con el PDF original.")
                if not page_courses and (page.images or len(page.rects)+len(page.curves)>10):
                    if ocr_pages >= 5:
                        raise ConversionError("La conversión OCR admite hasta 5 páginas por archivo. Divide el PDF para continuar.")
                    from .graphical import ocr_page
                    ocr_pages += 1
                    graph_courses, page_relations, page_evidence, words = ocr_page(data,index-1,warnings)
                    page_courses.extend(graph_courses)
                    relations.extend(page_relations)
                    evidence.extend(page_evidence)
                    if not graph_courses and words:
                        parsed, headers, context = parse_rows(positioned_rows(words),warnings,context=context,previous_headers=headers)
                        page_courses.extend(parsed)
                        extracts.append("OCR: "+" ".join(w['text'] for w in words)[:4000])
                        warnings.append(f"Página {index}: texto reconocido mediante OCR; revisa los datos contra el original.")
                    else:
                        extracts.append("OCR: "+"\n".join(item['text'] for item in page_evidence)[:8000])
                if not page_courses:
                    positioned = positioned_rows(page.extract_words(x_tolerance=2, y_tolerance=3))
                    rows = positioned if any(header_map(row) for row in positioned) else text_rows(text)
                    parsed, headers, context = parse_rows(rows, warnings, context=context, previous_headers=headers)
                    page_courses.extend(parsed)
                if text.strip() and not page_courses:
                    warnings.append(f"Página {index}: no se reconocieron materias. Revisa si faltan datos de esta página.")
                courses.extend(page_courses)
                if len(courses) > MAX_COURSES:
                    raise ConversionError(f"La malla supera {MAX_COURSES} materias.")
    except ConversionError:
        raise
    except RuntimeError:
        raise
    except Exception as exc:
        raise ConversionError("No se pudo leer el PDF. Comprueba que no esté dañado ni protegido con contraseña.") from exc

    if not courses:
        raise ConversionError("No se reconocieron materias en tablas ni en recuadros gráficos. Comprueba la resolución, los encabezados y las etiquetas del documento.")
    warnings.insert(0, "Revisa todas las materias, créditos, semestres y prerrequisitos contra el PDF original antes de usar esta malla.")
    curriculum = {"id": curriculum_id.strip(), "name": name.strip(), "institution": institution.strip(), "courses": courses}
    if any(course.get('hours') is not None for course in courses): curriculum['hoursBasis']='source'
    return {"curriculum": curriculum, "warnings": list(dict.fromkeys(warnings)), "pageCount": pages, "textPreview": "\n\n".join(extracts)[:12000], "relations": relations, "evidence": evidence, "usedOcr": ocr_pages>0}
