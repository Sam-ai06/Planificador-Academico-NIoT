"""CLI y servicio HTTP local del conversor. No almacena los PDFs recibidos."""

from __future__ import annotations

import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
from importlib.util import find_spec
from urllib.parse import parse_qs, urlsplit

from .converter import ConversionError, MAX_BYTES, convert_pdf


class ConverterHandler(BaseHTTPRequestHandler):
    server_version = "NIoT-PDF/1.0"

    def setup(self):
        super().setup()
        self.connection.settimeout(45)

    def send_json(self, status: int, body: dict):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if urlsplit(self.path).path == "/api/curriculums/converter-health":
            try:
                import pdfplumber
                self.send_json(200, {"status": "ok", "library": "pdfplumber", "version": pdfplumber.__version__, "ocr": find_spec("rapidocr_onnxruntime") is not None, "graphical": True})
            except ImportError:
                self.send_json(503, {"error": "Falta instalar pdfplumber."})
        else:
            self.send_json(404, {"error": "Ruta no encontrada."})

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path != "/api/curriculums/convert-pdf":
            self.send_json(404, {"error": "Ruta no encontrada."})
            return
        # El servicio local solo acepta PDFs, no peticiones de formularios externos.
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/pdf":
            self.send_json(415, {"error": "Envía el archivo con Content-Type: application/pdf."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BYTES:
            self.send_json(413, {"error": "El PDF debe contener datos y no superar 10 MB."})
            return
        params = parse_qs(url.query)
        try:
            data = self.rfile.read(length)
            if len(data) != length:
                raise ConversionError("La carga del PDF quedó incompleta.")
            result = convert_pdf(data, curriculum_id=params.get("id", [""])[0], name=params.get("name", [""])[0], institution=params.get("institution", [""])[0])
            self.send_json(200, result)
        except ConversionError as exc:
            self.send_json(422, {"error": str(exc)})
        except RuntimeError as exc:
            self.send_json(503, {"error": str(exc)})
        except (TimeoutError, ConnectionError):
            self.close_connection = True
        except Exception:
            self.send_json(500, {"error": "No se pudo completar la conversión del PDF."})


def main() -> int:
    parser = argparse.ArgumentParser(description="Convierte una malla PDF a JSON para NIoT.")
    parser.add_argument("input", nargs="?", type=Path)
    parser.add_argument("--output", "-o", type=Path)
    parser.add_argument("--id", default="")
    parser.add_argument("--name", default="")
    parser.add_argument("--institution", default="")
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    if args.serve:
        with ThreadingHTTPServer(("127.0.0.1", args.port), ConverterHandler) as server:
            print(f"Conversor PDF listo en http://127.0.0.1:{args.port}", flush=True)
            try:
                server.serve_forever()
            except KeyboardInterrupt:
                pass
        return 0
    if not args.input:
        parser.error("Indica un archivo PDF o utiliza --serve.")
    try:
        if args.input.stat().st_size > MAX_BYTES:
            raise ConversionError("El PDF no puede superar 10 MB.")
        result = convert_pdf(args.input.read_bytes(), curriculum_id=args.id, name=args.name, institution=args.institution)
        output = json.dumps(result["curriculum"], ensure_ascii=False, indent=2)
        if args.output:
            args.output.write_text(output + "\n", encoding="utf-8")
        else:
            print(output)
        for warning in result["warnings"]:
            print(f"Revisión: {warning}", file=sys.stderr)
        return 0
    except (ConversionError, RuntimeError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
