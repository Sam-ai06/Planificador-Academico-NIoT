import unittest
import cv2
import numpy as np
from io import BytesIO
import pypdfium2 as pdfium
from tools.pdf_converter.tests.pdf_fixture import make_pdf
from tools.pdf_converter.converter import convert_pdf
from tools.pdf_converter.graphical import arrow_relations, detect_boxes, semester_from_label


def diagram(dashed=False):
    image=np.full((800,1000,3),255,dtype=np.uint8)
    # Dimensiones relativas compatibles con los recuadros del extractor.
    boxes=[(250,100,150,60),(500,100 if dashed else 260,150,60)]
    for x,y,w,h in boxes:cv2.rectangle(image,(x,y),(x+w,y+h),(0,0,0),2)
    records=[{'box':b,'course':{'id':str(i),'semester':1 if i==0 or dashed else 2,'prerequisites':[],'corequisites':[]}} for i,b in enumerate(boxes)]
    if dashed:
        for x in range(402,489,12):cv2.line(image,(x,130),(min(x+6,489),130),(0,0,0),2)
        cv2.fillConvexPoly(image,np.array([[487,124],[497,130],[487,136]]),(0,0,0))
    else:
        # Ruta simple en L que une el fondo del origen y el borde superior del destino.
        cv2.line(image,(325,162),(325,210),(70,70,70),2)
        cv2.line(image,(325,210),(575,210),(70,70,70),2)
        cv2.line(image,(575,210),(575,248),(70,70,70),2)
        cv2.fillConvexPoly(image,np.array([[569,246],[581,246],[575,257]]),(0,0,0))
    return image,records


class GraphicalTests(unittest.TestCase):
    def test_scanned_table_uses_real_ocr(self):
        with pdfium.PdfDocument(make_pdf()) as document:
            image=document[0].render(scale=3).to_pil()
            stream=BytesIO();image.save(stream,format='PDF',resolution=216)
        result=convert_pdf(stream.getvalue(),curriculum_id='scan',name='Scan',institution='Demo')
        self.assertTrue(result['usedOcr'])
        self.assertEqual(len(result['curriculum']['courses']),2)
        self.assertEqual(result['curriculum']['courses'][1]['prerequisites'],['MAT101'])
    def test_semesters_are_read_from_labels_not_guessed(self):
        self.assertEqual(semester_from_label('NIVEL 100 - I'),1)
        self.assertEqual(semester_from_label('NIVEL 400 - II'),8)
        self.assertEqual(semester_from_label('Semestre VI'),6)
        self.assertIsNone(semester_from_label('Prácticas empresariales'))

    def test_boxes(self):
        image=np.full((1000,1600,3),255,dtype=np.uint8)
        for x in [300,600,900]:cv2.rectangle(image,(x,200),(x+200,260),(0,0,0),2)
        self.assertEqual(len(detect_boxes(image)),3)

    def test_solid_connector_is_prerequisite(self):
        image,records=diagram()
        relations=arrow_relations(image,records)
        self.assertTrue(any(r.get('source')=='0' and r['target']=='1' and r['type']=='prerequisite' for r in relations),relations)
        self.assertEqual(records[1]['course']['prerequisites'],['0'])

    def test_dashed_connector_is_corequisite(self):
        image,records=diagram(True)
        relations=arrow_relations(image,records)
        self.assertTrue(any(r.get('source')=='0' and r['target']=='1' and r['type']=='corequisite' for r in relations),relations)
        self.assertEqual(records[1]['course']['corequisites'],['0'])


if __name__=='__main__':unittest.main()
