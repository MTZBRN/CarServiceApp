import { createContext,useContext,useMemo,useRef,type ReactNode } from 'react';
type Guard=(leave:()=>void)=>void;
const Context=createContext<{register:(guard:Guard)=>()=>void;request:(leave:()=>void)=>void}|null>(null);
export function NavigationSafety({children}:{children:ReactNode}) {
 const guard=useRef<Guard|null>(null);
 const value=useMemo(()=>({register:(handler:Guard)=>{guard.current=handler;return ()=>{if(guard.current===handler)guard.current=null;};},request:(leave:()=>void)=>guard.current?guard.current(leave):leave()}),[]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useNavigationSafety(){const value=useContext(Context);if(!value)throw new Error('NavigationSafety missing');return value;}
