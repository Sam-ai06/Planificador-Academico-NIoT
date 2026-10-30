from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from tools.pdf_converter.converter import ConversionError, convert_pdf, parse_rows, text_rows
from tools.pdf_converter.__main__ import ConverterHandler
from tools.pdf_converter.tests.pdf_fixture import make_pdf

METADATA = {"curriculum_id": "test", "name": "Carrera", "institution": "Universidad"}


class ParserTests(unittest.TestCase):
    def test_spanish_headers_decimals_and_references(self):
        courses, _, _ = parse_rows([
            ["Código", "Nombre de la asignatura", "Créditos", "Semestre", "Prerrequisitos"],
            ["MAT 101", "Matemática\nI", "3,5", "II", "INF101; MAT100"],
        ], [])
        self.assertEqual(courses[0], {"id": "MAT101", "code": "MAT101", "name": "Matemática I", "credits": 3.5, "semester": 2, "prerequisites": ["INF101", "MAT100"]})

    def test_semester_headings_and_missing_prerequisites_are_explicit(self):
        warnings = []
        courses, _, _ = parse_rows([["Semestre III"], ["Code", "Course name", "Credits"], ["A101", "Algorithms", "4"]], warnings)
        self.assertEqual(courses[0]["semester"], 3)
        self.assertTrue(any("prerrequisitos" in w for w in warnings))

    def test_missing_values_are_not_invented(self):
        warnings = []
        courses, _, _ = parse_rows([["Código", "Asignatura", "Créditos"], ["A1", "Algo", "no disponible"]], warnings)
        self.assertIsNone(courses[0]["credits"])
        self.assertIsNone(courses[0]["semester"])
        self.assertTrue(any("null" in w for w in warnings))

    def test_repeated_headers_totals_and_page_continuation(self):
        first, headers, context = parse_rows([["Código", "Materia", "Créditos", "Nivel"], ["A1", "A", "3", "1"], ["Total", "", "3", ""]], [])
        second, _, _ = parse_rows([["B1", "B", "4", "2"]], [], previous_headers=headers, context=context)
        self.assertEqual([c["code"] for c in first + second], ["A1", "B1"])

    def test_duplicate_rows_are_preserved_for_frontend_validation(self):
        rows = [["Code", "Course", "Credits", "Semester"], ["A1", "A", "3", "1"], ["A1", "A", "3", "1"]]
        self.assertEqual(len(parse_rows(rows, [])[0]), 2)

    def test_text_columns(self):
        courses, _, _ = parse_rows(text_rows("Code  Course  Credits  Semester\nA1  Algorithms  4  1"), [])
        self.assertEqual(courses[0]["code"], "A1")


class PdfTests(unittest.TestCase):
    def test_real_pdf_table(self):
        result = convert_pdf(make_pdf(), **METADATA)
        self.assertEqual(result["pageCount"], 1)
        self.assertEqual(len(result["curriculum"]["courses"]), 2)
        self.assertEqual(result["curriculum"]["courses"][1]["prerequisites"], ["MAT101"])
        self.assertTrue(result["warnings"])

    def test_real_pdf_without_grid(self):
        result = convert_pdf(make_pdf(grid=False), **METADATA)
        self.assertEqual(len(result["curriculum"]["courses"]), 2)

    def test_semester_title_above_table(self):
        rows = [["Codigo", "Asignatura", "Creditos"], ["MAT101", "Matematica", "4"]]
        result = convert_pdf(make_pdf(rows, title="SEMESTRE II"), **METADATA)
        self.assertEqual(result["curriculum"]["courses"][0]["semester"], 2)

    def test_invalid_scanned_empty_and_incomplete_metadata(self):
        for data in [b"not a pdf", b"%PDF-invalid", make_pdf([])]:
            with self.subTest(data=data[:15]), self.assertRaises(ConversionError):
                convert_pdf(data, **METADATA)
        with self.assertRaises(ConversionError):
            convert_pdf(make_pdf(), curriculum_id="", name="Carrera", institution="U")

    def test_cli_writes_importable_json(self):
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "malla.pdf", Path(directory) / "malla.json"
            source.write_bytes(make_pdf())
            result = subprocess.run([sys.executable, "-m", "tools.pdf_converter", str(source), "-o", str(output), "--id", "test", "--name", "Carrera", "--institution", "U"], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len(json.loads(output.read_text(encoding="utf-8"))["courses"]), 2)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), ConverterHandler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def test_upload_converts_pdf(self):
        request = Request(self.base + "/api/curriculums/convert-pdf?id=test&name=Carrera&institution=U", data=make_pdf(), headers={"Content-Type": "application/pdf"})
        with urlopen(request, timeout=10) as response:
            body = json.load(response)
            self.assertEqual(response.status, 200)
            self.assertEqual(body["curriculum"]["courses"][0]["code"], "MAT101")

    def test_wrong_content_type_and_invalid_pdf_are_rejected(self):
        for content_type, expected in [("text/plain", 415), ("application/pdf", 422)]:
            request = Request(self.base + "/api/curriculums/convert-pdf?id=test&name=N&institution=U", data=b"invalid", headers={"Content-Type": content_type})
            with self.subTest(content_type=content_type), self.assertRaises(HTTPError) as caught:
                urlopen(request, timeout=10)
            self.assertEqual(caught.exception.code, expected)
            self.assertIn("error", json.loads(caught.exception.read()))
            caught.exception.close()


if __name__ == "__main__":
    unittest.main()
