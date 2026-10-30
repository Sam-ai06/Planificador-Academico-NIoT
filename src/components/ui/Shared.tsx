import { useEffect, useRef, type ReactNode } from 'react';
export function Notice({ children }: {
    children: ReactNode;
}) { return <div className="notice" role="status">{children}</div>; }
export function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const d = ref.current!; d.showModal(); return () => d.close(); }, []);
    return <dialog ref={ref} onCancel={onClose} aria-label={title}><div className="section-heading"><h2>{title}</h2><button onClick={onClose} aria-label="Cerrar">✕</button></div>{children}<button className="primary" onClick={onClose}>Cerrar</button></dialog>;
}
export function PageTitle({ eyebrow, title, description, action }: {
    eyebrow: string;
    title: string;
    description: string;
    action?: ReactNode;
}) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
