"""OCR local y lectura conservadora de diagramas. Conserva evidencia para revisión."""
from __future__ import annotations

from functools import lru_cache
from threading import Lock
import re
import unicodedata
from typing import Any

_LOCK = Lock()
MAX_RENDER_PIXELS = 12_000_000


@lru_cache(maxsize=1)
def ocr_engine():
    try:
        from rapidocr_onnxruntime import RapidOCR
        return RapidOCR()
    except ImportError as exc:
        raise RuntimeError("Faltan las dependencias OCR. Ejecuta pip install -r tools/pdf_converter/requirements.txt en .venv.") from exc


def overlap(a, b):
    x, y, w, h = a
    X, Y, W, H = b
    intersection = max(0, min(x+w, X+W)-max(x, X)) * max(0, min(y+h, Y+H)-max(y, Y))
    return intersection / (w*h + W*H - intersection)


def detect_boxes(image):
    import cv2
    import numpy as np
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    black = cv2.inRange(gray, 0, 190)
    colored = cv2.inRange(cv2.cvtColor(image, cv2.COLOR_BGR2HSV), np.array([0, 35, 0]), np.array([179, 255, 245]))
    candidates = []
    for mask in [black, colored]:
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if .045*width < w < .18*width and .025*height < h < .075*height and 1.4 < w/h < 3.3:
                candidates.append((x, y, w, h))
    if not candidates:
        return []
    median_width = float(np.median([b[2] for b in candidates]))
    boxes = []
    for box in sorted(candidates, key=lambda b: b[2]*b[3]):
        if box[2] < .8*median_width or any(overlap(box, existing) > .65 for existing in boxes):
            continue
        boxes.append(box)
    # Filas físicas: su número no se considera un semestre sin una etiqueta legible.
    return sorted(boxes, key=lambda b: (round(b[1]/max(10, b[3]*.4)), b[0]))


def read_text(engine, crop):
    import cv2
    import numpy as np
    if not crop.size:
        return []
    if np.median(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)) < 110:
        crop = 255-crop
    result, _ = engine(crop)
    return result or []


def normalize_ocr(text):
    return unicodedata.normalize("NFKC", text).strip()


def read_hours(engine, image, box):
    x, y, w, h = box
    band = max(15, round(h*.33))
    crops = [image[max(0, y-band):max(1, y-3), x:x+w//2], image[max(0, y-band):max(1, y-3), x+w-round(w*.18):x+w+3]]
    if any(not crop.size for crop in crops):
        return None, None, ""
    readings, _ = engine.text_recognizer(crops)
    parts_text, total_text = [normalize_ocr(r[0]) for r in readings]
    match = re.search(r"(\d+)\s*/\s*(\d+)\s*/\s*(\d+)", parts_text)
    breakdown = dict(zip(["teaching", "practice", "autonomous"], map(int, match.groups()))) if match else None
    total_match = re.fullmatch(r"[_\s]*(\d+)", total_text)
    total = int(total_match.group(1)) if total_match else None
    if breakdown:
        calculated = sum(breakdown.values())
        if total is not None and total != calculated:
            return None, breakdown, f"HD/HP/HTA={parts_text}; HT={total_text}; los valores no coinciden"
        total = calculated
    return total if total and total > 0 else None, breakdown, f"HD/HP/HTA={parts_text}; HT={total_text}"


def semester_from_label(text):
    match = re.search(r"NIVEL\s*(\d{3})\s*[-–]?\s*(II|I|1|2)\b", normalize_ocr(text).upper())
    if match and int(match.group(1)) % 100 == 0:
        return (int(match.group(1))//100-1)*2 + (2 if match.group(2) in {"II", "2"} else 1)
    match = re.search(r"(?:SEMESTRE|SEMESTER|CICLO)\s*[-:]?\s*(\d+|VIII|VII|VI|IV|III|II|IX|V|I|X)\b", normalize_ocr(text).upper())
    if not match:
        return None
    value = match.group(1)
    return int(value) if value.isdigit() else {"I":1,"II":2,"III":3,"IV":4,"V":5,"VI":6,"VII":7,"VIII":8,"IX":9,"X":10}[value]


def arrow_relations(image, records):
    """Extrae conectores aislados. Los cruces quedan como candidatos, nunca como hechos."""
    import cv2
    import numpy as np
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    dark = cv2.inRange(gray, 0, 140)
    lines = cv2.inRange(gray, 0, 220)
    for record in records:
        x,y,w,h = record["box"]
        for mask in [dark, lines]:
            cv2.rectangle(mask, (x-2,y-2), (x+w+2,y+h+2), 0, -1)
    scale = float(np.median([r["box"][3] for r in records])) / 105
    kernel = max(4, round(4*scale))
    eroded = cv2.erode(dark, np.ones((kernel,kernel),np.uint8))
    contours,_ = cv2.findContours(eroded,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    connected = cv2.bitwise_or(cv2.morphologyEx(lines,cv2.MORPH_CLOSE,np.ones((1,max(3,round(17*scale))),np.uint8)),cv2.morphologyEx(lines,cv2.MORPH_CLOSE,np.ones((max(3,round(7*scale)),1),np.uint8)))
    _, labels = cv2.connectedComponents(connected)
    relations = []
    for contour in contours:
        x,y,w,h = cv2.boundingRect(contour)
        if not (3*scale <= w <= 25*scale and 3*scale <= h <= 25*scale and cv2.contourArea(contour)>=5*scale):
            continue
        cx,cy = x+w//2,y+h//2
        for target in records:
            X,Y,W,H = target["box"]
            top = Y-26*scale < y+h < Y+3 and X+10 < cx < X+W-10
            left = X-26*scale < x+w < X+3 and Y+10 < cy < Y+H-10
            right = X+W-3 < x < X+W+26*scale and Y+10 < cy < Y+H-10
            if not (top or left or right):
                continue
            label = labels[cy,cx]
            if not label:
                continue
            # Los conectores laterales solo se clasifican si se observan trazos discontinuos.
            dashed = False
            if left or right:
                direction = -1 if left else 1
                samples = []
                for distance in range(round(25*scale),round(65*scale)):
                    sx=cx+direction*distance
                    if 0<=sx<lines.shape[1]: samples.append(bool(lines[max(0,cy-2):cy+3,sx].any()))
                runs = sum(samples[i] != samples[i-1] for i in range(1,len(samples)))
                dashed = runs >= 3
            relation_type = "corequisite" if dashed else "prerequisite"
            candidates = []
            direct = []
            for source in records:
                if source is target:
                    continue
                term, target_term = source["course"]["semester"], target["course"]["semester"]
                if term is not None and target_term is not None and (term > target_term if dashed else term >= target_term):
                    continue
                A,B,C,D=source["box"]
                if top and A+8<cx<A+C-8 and B+D+8<cy:
                    strip=lines[B+D+5:cy-3,max(0,cx-2):cx+3]
                    occupancy=float(np.mean(np.any(strip,axis=1))) if strip.size else 0
                    if occupancy>.88: direct.append((cy-(B+D),source["course"]["id"]))
                elif left and B+8<cy<B+D-8 and A+C+8<cx:
                    strip=lines[max(0,cy-2):cy+3,A+C+5:cx-3]
                    occupancy=float(np.mean(np.any(strip,axis=0))) if strip.size else 0
                    if occupancy>(.25 if dashed else .88): direct.append((cx-(A+C),source["course"]["id"]))
                elif right and B+8<cy<B+D-8 and cx+8<A:
                    strip=lines[max(0,cy-2):cy+3,cx+3:A-5]
                    occupancy=float(np.mean(np.any(strip,axis=0))) if strip.size else 0
                    if occupancy>(.25 if dashed else .88): direct.append((A-cx,source["course"]["id"]))
                gap=max(3,round(3*scale))
                ports=[labels[B+D+gap:B+D+gap+8,A:A+C],labels[B:B+D,A+C+gap:A+C+gap+9],labels[B:B+D,max(0,A-gap-9):max(0,A-gap)]]
                if any(np.any(port==label) for port in ports):
                    candidates.append(source["course"]["id"])
            if direct:
                candidates=[min(direct)[1]]
            if not candidates:
                relations.append({"target":target["course"]["id"],"type":relation_type,"candidates":[],"status":"unresolved","evidence":"Flecha detectada, origen sin identificar."})
            elif len(candidates)==1:
                field="corequisites" if dashed else "prerequisites"
                if candidates[0] not in target["course"][field]: target["course"][field].append(candidates[0])
                relations.append({"source":candidates[0],"target":target["course"]["id"],"type":relation_type,"candidates":candidates,"status":"detected","evidence":"Conector aislado; revisar contra el original."})
            else:
                relations.append({"target":target["course"]["id"],"type":relation_type,"candidates":candidates,"status":"unresolved","evidence":"El conector cruza o comparte líneas. Selecciona su origen manualmente."})
            break
    return relations


def extract_graph(image, page_number, warnings):
    boxes=detect_boxes(image)
    if len(boxes)<3:
        return [],[],[]
    engine=ocr_engine()
    records=[]
    evidence=[]
    row_labels={}
    for index, box in enumerate(boxes):
        x,y,w,h=box
        raw=read_text(engine,image[y+3:y+h-3,x+3:x+w-3])
        texts=[normalize_ocr(r[1]) for r in raw]
        joined=" ".join(texts)
        code_match=re.search(r"\b[A-Z]{3,8}\s*\d{3,6}\b",joined.upper())
        # Sin un código reconocible se exige contenido de una actividad, no leyendas.
        if not code_match and not any(word in joined.upper() for word in ["ITINERARIO","PRACTICA","PRÁCTICA","COMPLEMENTARIA"]):
            continue
        code=re.sub(r"\s+","",code_match.group()) if code_match else f"SIN-CODIGO-P{page_number}-{index+1}"
        name=" ".join(t for t in texts if not (code_match and re.fullmatch(r"[A-Z]{3,8}\s*\d{3,6}",t.upper())) and t not in {"B","P","I"})
        if code_match and not name.strip():
            continue
        key=round(y/(h*.6))
        if key not in row_labels:
            left=image[max(0,y-12):y+h+12,0:max(1,min(b[0] for b in boxes)-30)]
            labels=read_text(engine,left)
            label=" ".join(r[1] for r in labels)
            row_labels[key]=(semester_from_label(label),label)
        semester,label=row_labels[key]
        hours,breakdown,hours_evidence=read_hours(engine,image,box)
        course={"id":code,"code":code,"name":name or joined,"credits":None,"hours":hours,"semester":semester,"prerequisites":[],"corequisites":[]}
        if breakdown: course["hoursBreakdown"]=breakdown
        if semester is None:
            course["semesterUnspecified"]=True
            warnings.append(f"{code}: semestre no identificado. Se conserva sin semestre sugerido; revísalo.")
        if not code_match:
            course["sourceCodeMissing"]=True
            warnings.append(f"{code}: identificador técnico generado para una actividad sin código legible; no es un código oficial.")
        if hours is None: warnings.append(f"{code}: no se pudieron leer las horas; completa hours o credits antes de importar.")
        record={"box":box,"course":course}
        records.append(record)
        evidence.append({"courseId":code,"page":page_number,"box":[round(v/image.shape[1 if i%2==0 else 0],5) for i,v in enumerate([x,y,w,h])],"text":joined,"semesterLabel":label,"hoursText":hours_evidence,"confidence":round(min((float(r[2]) for r in raw),default=0),3)})
    if len(records)<3:
        return [],[],[]
    relations=arrow_relations(image,records)
    warnings.extend(["Se usó OCR local. Revisa códigos, nombres, semestres y relaciones; la lectura automática puede contener errores.","La carga se conserva como horas declaradas en el documento. No se calcularon créditos ni equivalencias a horas semestrales.","Los conectores ambiguos no se agregaron a los prerrequisitos: revisa la sección de relaciones y completa los que falten."])
    return [r["course"] for r in records],relations,evidence


def scanned_table_words(image, engine):
    """Lee celdas de una tabla rasterizada sin perder dígitos de baja confianza."""
    import cv2
    import numpy as np
    gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    mask=cv2.inRange(gray,0,180)
    horizontal=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((1,max(25,image.shape[1]//30)),np.uint8))
    vertical=cv2.morphologyEx(mask,cv2.MORPH_OPEN,np.ones((max(25,image.shape[0]//30),1),np.uint8))
    intersections=cv2.bitwise_and(horizontal,vertical)
    n,_,_,centers=cv2.connectedComponentsWithStats(intersections)
    if n<7:return []
    def clustered(values):
        groups=[]
        for value in sorted(values):
            if not groups or value-groups[-1][-1]>6:groups.append([value])
            else:groups[-1].append(value)
        return [round(sum(g)/len(g)) for g in groups]
    xs=clustered([p[0] for p in centers[1:]])
    ys=clustered([p[1] for p in centers[1:]])
    if not 3<=len(xs)<=20 or not 3<=len(ys)<=150:return []
    cells=[]
    for y,Y in zip(ys,ys[1:]):
        for x,X in zip(xs,xs[1:]):
            crop=image[y+5:Y-5,x+5:X-5]
            if not crop.size:continue
            ink=cv2.inRange(cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY),0,190)
            points=cv2.findNonZero(ink)
            if points is None:continue
            a,b,w,h=cv2.boundingRect(points)
            crop=cv2.copyMakeBorder(crop[b:b+h,a:a+w],7,7,7,7,cv2.BORDER_CONSTANT,value=(255,255,255))
            cells.append((x,y,X,Y,crop))
    if not cells:return []
    readings,_=engine.text_recognizer([c[4] for c in cells])
    words=[]
    for (x,y,X,Y,_),reading in zip(cells,readings):
        text=normalize_ocr(reading[0]);offset=0
        for token in text.split():
            start=x+8+(X-x-16)*offset/max(1,len(text))
            words.append({'text':token,'x0':start,'x1':start+(X-x-16)*len(token)/max(1,len(text)),'top':y+8})
            offset+=len(token)+1
    return words


def ocr_page(pdf_data:bytes,page_index:int,warnings:list[str]):
    import cv2
    import numpy as np
    import pypdfium2 as pdfium
    with _LOCK:
        document=pdfium.PdfDocument(pdf_data)
        try:
            page=document[page_index]
            scale=min(4,(MAX_RENDER_PIXELS/(page.get_width()*page.get_height()))**.5)
            bitmap=page.render(scale=scale)
            image=cv2.cvtColor(np.array(bitmap.to_pil().convert('RGB')),cv2.COLOR_RGB2BGR)
            graph_warnings=[]
            courses,relations,evidence=extract_graph(image,page_index+1,graph_warnings)
            if courses:
                warnings.extend(graph_warnings)
                return courses,relations,evidence,[]
            # Escaneo de una tabla: OCR por mosaicos para conservar letras pequeñas.
            engine=ocr_engine()
            table_words=scanned_table_words(image,engine)
            if table_words:
                from .converter import header_map, positioned_rows
                if any(header_map(row) for row in positioned_rows(table_words)):
                    return [],[],[],table_words
            words=[]
            for y in range(0,image.shape[0],880):
                for x in range(0,image.shape[1],880):
                    for points,text,confidence in read_text(engine,image[y:y+960,x:x+960]):
                        if float(confidence)<.45: continue
                        left=min(p[0] for p in points)+x
                        top=min(p[1] for p in points)+y
                        width=max(p[0] for p in points)-min(p[0] for p in points)
                        offset=0
                        for token in text.split():
                            start=left+width*offset/max(1,len(text))
                            end=start+width*len(token)/max(1,len(text))
                            if not any(w['text']==token and abs(w['x0']-start)<5 and abs(w['top']-top)<5 for w in words):words.append({'text':token,'x0':start,'x1':end,'top':top})
                            offset+=len(token)+1
            return [],[],[],words
        finally:
            document.close()
