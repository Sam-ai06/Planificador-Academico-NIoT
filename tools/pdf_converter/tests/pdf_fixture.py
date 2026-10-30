"""PDF mínimo generado sin bibliotecas adicionales para probar extracción real."""


def make_pdf(rows: list[list[str]] | None = None, *, grid: bool = True, title: str = "") -> bytes:
    rows = rows if rows is not None else [
        ["Codigo", "Asignatura", "Creditos", "Semestre", "Prerrequisitos"],
        ["MAT101", "Matematica I", "4", "1", "Ninguno"],
        ["MAT201", "Matematica II", "4", "2", "MAT101"],
    ]
    xs = [35, 110, 300, 360, 420, 575]
    top = 740
    operations = []

    def text(x: int, y: int, value: str):
        escaped = value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        operations.append(f"BT /F1 9 Tf 1 0 0 1 {x} {y} Tm ({escaped}) Tj ET")

    if title:
        text(35, 765, title)
    for i, row in enumerate(rows):
        for j, value in enumerate(row):
            text(xs[j] + 5, top - 16 - i * 28, value)
    if grid and rows:
        for i in range(len(rows) + 1):
            y = top - i * 28
            operations.append(f"35 {y} m 575 {y} l S")
        for x in xs[:len(rows[0])] + [xs[len(rows[0])]]:
            operations.append(f"{x} {top} m {x} {top-len(rows)*28} l S")
    stream = "\n".join(operations).encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
    ]
    content = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(content)
    content += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
    content += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    return content + f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
