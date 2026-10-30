export interface PdfConversionResult {
  usedOcr?: boolean
  relations?: PdfRelation[]
  evidence?: {courseId:string;page:number;box:number[];text:string;semesterLabel:string;hoursText:string;confidence:number}[]
  curriculum: unknown
  warnings: string[]
  pageCount: number
  textPreview: string
}
export interface PdfRelation {
  source?:string
  target:string
  type:'prerequisite'|'corequisite'
  candidates:string[]
  status:'detected'|'unresolved'
  evidence:string
}
export async function convertCurriculumPdf(file:File, metadata:{id:string;name:string;institution:string}, signal?:AbortSignal):Promise<PdfConversionResult> {
  if(!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecciona un archivo .pdf.')
  if(file.size===0 || file.size>10*1024*1024) throw new Error('El PDF debe contener datos y no superar 10 MB.')
  const query=new URLSearchParams(metadata)
  let response:Response
  try {
    response=await fetch(`/api/curriculums/convert-pdf?${query}`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:file,signal})
  } catch(e) {
    if(signal?.aborted) throw new Error('La conversión se canceló o superó el tiempo de espera. Intenta con un PDF más pequeño.',{cause:e})
    throw new Error('No se pudo conectar al conversor Python. Comprueba que esté iniciado en el puerto 8001.',{cause:e})
  }
  const result:unknown=await response.json().catch(()=>null)
  if(!response.ok){
    const message=result && typeof result==='object' && 'error' in result && typeof result.error==='string' ? result.error : 'No se pudo convertir el PDF. Comprueba que el servicio Python esté iniciado en el puerto 8001.'
    throw new Error(message)
  }
  if(!result || typeof result!=='object' || !('curriculum' in result) || !('warnings' in result) || !Array.isArray(result.warnings) || !result.warnings.every(w=>typeof w==='string') || !('pageCount' in result) || typeof result.pageCount!=='number' || !('textPreview' in result) || typeof result.textPreview!=='string') throw new Error('El conversor devolvió una respuesta inesperada.')
  return result as PdfConversionResult
}
