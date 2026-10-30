import type { Curriculum, PlannedSemester, StudentProfile } from '../types/academic'
import { generatePlan } from '../features/planner/services/planning'
import { mockAssistant, type AssistantContext } from '../features/assistant/services/assistant'
import { apiRequest } from './api'
export interface PlanningRequest {
  curriculum:Curriculum
  profile:StudentProfile
  unavailable?:{courseId:string;semester:number}
}
export interface AcademicService {
  generate(request:PlanningRequest):Promise<PlannedSemester[]>
  explain(question:string,context?:AssistantContext):Promise<string>
}
const mockService:AcademicService={
  async generate({curriculum,profile,unavailable}){return generatePlan(curriculum,profile,unavailable)},
  explain:(question,context)=>mockAssistant.reply(question,context),
}
const httpService:AcademicService={
  generate:request=>apiRequest<PlannedSemester[]>('/plans/generate',{method:'POST',body:JSON.stringify(request)}),
  async explain(question,context){const result=await apiRequest<{message:string}>('/assistant/explain',{method:'POST',body:JSON.stringify({question,context})});return result.message},
}
export const isDemo=import.meta.env.VITE_DATA_SOURCE!=='api'
export const academicService:AcademicService=isDemo?mockService:httpService
