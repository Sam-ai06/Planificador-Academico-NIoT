export type CourseStatus = 'pending' | 'passed' | 'failed' | 'active';
export interface Course {
    id: string;
    code: string;
    name: string;
    credits: number | null;
    hours?: number;
    hoursBreakdown?: { teaching: number; practice: number; autonomous: number };
    semester: number | null;
    semesterUnspecified?: boolean;
    prerequisites: string[];
    corequisites?: string[];
    sourceCodeMissing?: boolean;
    area?: string;
}
export interface Curriculum {
    hoursBasis?: 'source';
    id: string;
    name: string;
    institution: string;
    courses: Course[];
}
export interface TimeSlot {
    day: string;
    start: string;
    end: string;
}
export interface StudentProfile {
    name: string;
    statuses: Record<string, CourseStatus>;
    maxCourses: number;
    availability: TimeSlot[];
    interests: string[];
}
export interface PlannedSemester {
    number: number;
    courseIds: string[];
}
export interface AcademicScenario {
    event?: AcademicEvent;
    id: string;
    name: string;
    semesters: PlannedSemester[];
    createdAt: string;
    parameters: StudentProfile;
    curriculumId: string;
}
export interface AcademicEvent {
    type: 'failed' | 'load' | 'availability' | 'interests' | 'unavailable';
    courseId?: string;
    semester?: number;
    maxCourses?: number;
    availability?: TimeSlot[];
    interests?: string[];
}
export interface AcademicState {
    curriculums: Curriculum[];
    curriculumId: string;
    profile: StudentProfile;
    plan: AcademicScenario;
    scenarios: AcademicScenario[];
}
