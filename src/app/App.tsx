import { RouterProvider } from 'react-router-dom';
import { AcademicProvider } from './providers/AcademicProvider';
import { router } from './router';
export default function App() { return <AcademicProvider><RouterProvider router={router}/></AcademicProvider>; }
