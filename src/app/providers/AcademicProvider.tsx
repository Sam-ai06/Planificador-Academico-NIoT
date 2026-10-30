import { createContext, useContext, useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import mock from '../../data/mockCurriculum.json';
import type { AcademicState, Curriculum, StudentProfile } from '../../types/academic';
import { createScenario } from '../../features/planner/services/planning';
import { validStoredState } from '../../services/storage';
const KEY = 'niot-academic-v1';
const profile: StudentProfile = { name: 'Estudiante', statuses: {}, maxCourses: 4, availability: [], interests: [] };
function initial(): AcademicState {
    const c = mock as Curriculum;
    return { curriculums: [c], curriculumId: c.id, profile, plan: createScenario(c, profile, []), scenarios: [] };
}
function load(): AcademicState {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return initial();
        const state = JSON.parse(raw) as AcademicState;
        if (!validStoredState(state))
            return initial();
        return state;
    }
    catch {
        return initial();
    }
}
const Context = createContext<{
    state: AcademicState;
    setState: Dispatch<SetStateAction<AcademicState>>;
    curriculum: Curriculum;
    storageError: string;
} | null>(null);
export function AcademicProvider({ children }: {
    children: ReactNode;
}) {
    const [state, setState] = useState(load);
    const [storageError, setStorageError] = useState('');
    useEffect(() => { const timer = setTimeout(() => { try {
        localStorage.setItem(KEY, JSON.stringify(state));
        setStorageError('');
    }
    catch {
        setStorageError('No se pudieron guardar los datos en este navegador. Exporta tu plan para conservarlo.');
    } }, 0); return () => clearTimeout(timer); }, [state]);
    const curriculum = state.curriculums.find(c => c.id === state.curriculumId)!;
    return <Context.Provider value={{ state, setState, curriculum, storageError }}>{children}</Context.Provider>;
}
// Shared hook lives here to keep the state contract in one place.
// eslint-disable-next-line react-refresh/only-export-components
export function useAcademic() { const value = useContext(Context); if (!value)
    throw new Error('Falta AcademicProvider'); return value; }
// eslint-disable-next-line react-refresh/only-export-components
export function switchCurriculum(state: AcademicState, curriculum: Curriculum): AcademicState {
    const next = { ...profile, statuses: {}, availability: [], interests: [] };
    return { ...state, curriculumId: curriculum.id, profile: next, plan: createScenario(curriculum, next, []), scenarios: [] };
}
