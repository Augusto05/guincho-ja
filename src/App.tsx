import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  MapPin, 
  Search, 
  Navigation, 
  Star, 
  Bell, 
  User, 
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Menu,
  Sun,
  Moon,
  ShieldCheck,
  CreditCard,
  Map as MapIcon,
  MessageSquare,
  Lock
} from 'lucide-react';
import { InteractiveMap } from './components/Map';
import { useTheme } from './components/ThemeContext';
import { MOCK_DRIVERS, MOCK_REQUESTS, MOCK_USER, MOCK_DESTINATIONS } from './services/mockData';
import { TowRequest, UserRole } from './types';
import { cn } from './lib/utils';

import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { useTowRequests } from './hooks/useTowRequests';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [role, setRole] = useState<UserRole>('customer');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const userId = user?.uid || 'anonymous';
  const { requests: firestoreRequests, createRequest, updateRequestStatus, updateRequestDriverLocation, deleteRequest, updateDriverLocation } = useTowRequests(role, userId);
  const [activeRequest, setActiveRequest] = useState<TowRequest | null>(null);
  
  // Initialize driver position from activeRequest if available, else random
  const [driverPos, setDriverPos] = useState({ 
    lat: -23.55052 + (Math.random() - 0.5) * 0.04, 
    lng: -46.633308 + (Math.random() - 0.5) * 0.04 
  });

  const [selectedDestination, setSelectedDestination] = useState(MOCK_DESTINATIONS[0]);
  const [view, setView] = useState<'map' | 'history'>('map');

  // Sync driverPos with activeRequest data for customer
  useEffect(() => {
    if (role === 'customer' && activeRequest?.driverLocation) {
      setDriverPos(activeRequest.driverLocation);
    }
  }, [activeRequest?.driverLocation, role]);

  // Combined requests
  const allRequests = firestoreRequests.length > 0 ? firestoreRequests : MOCK_REQUESTS;
  
  // My History
  const history = allRequests.filter(r => 
    (role === 'customer' ? r.customerId === userId : r.driverId === userId) && 
    (r.status === 'completed' || r.status === 'cancelled')
  );

  // Sync active request
  useEffect(() => {
    if (!user) {
      setActiveRequest(null);
      return;
    }
    const active = allRequests.find(r => 
      (role === 'customer' && (r.status === 'accepted' || r.status === 'in_progress' || r.status === 'pending')) ||
      (role === 'driver' && r.driverId === userId && (r.status === 'accepted' || r.status === 'in_progress'))
    );
    if (active) {
      setActiveRequest(active);
    } else {
      setActiveRequest(null);
    }
  }, [allRequests, role, user, userId]);

  // Simulate Driver Movement when accepted or in progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeRequest && (activeRequest.status === 'accepted' || activeRequest.status === 'in_progress') && role === 'driver') {
      // If accepted, move to origin. If in_progress, move to destination.
      const dest = activeRequest.status === 'accepted' ? activeRequest.origin : activeRequest.destination;
      
      interval = setInterval(() => {
        setDriverPos(prev => {
          const stepSize = 0.00015; 
          const latDiff = Math.abs(dest.lat - prev.lat);
          const lngDiff = Math.abs(dest.lng - prev.lng);
          
          if (latDiff < 0.0001 && lngDiff < 0.0001) {
            clearInterval(interval);
            return prev;
          }

          const newLat = prev.lat + (dest.lat > prev.lat ? stepSize : -stepSize);
          const newLng = prev.lng + (dest.lng > prev.lng ? stepSize : -stepSize);
          
          // Update Firestore so the user sees the movement
          updateRequestDriverLocation(activeRequest.id, newLat, newLng);
          updateDriverLocation(newLat, newLng);
          
          return { lat: newLat, lng: newLng };
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeRequest?.id, activeRequest?.status, role]);

  // Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            name: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email,
            role: 'customer',
            createdAt: serverTimestamp(),
            rating: 5.0
          });
          setRole('customer');
        } else {
          setRole(userSnap.data().role as UserRole);
        }
      }
      setUser(firebaseUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [isDriverOnline, setIsDriverOnline] = useState(true);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  
  const addNotification = (msg: string) => {
    setNotifications(prev => [msg, ...prev].slice(0, 5));
  };

  const currentPos = { lat: -23.55052, lng: -46.633308 };

  // Calculate simulated distance in KM
  const calculateDistance = (p1: {lat: number, lng: number}, p2: {lat: number, lng: number}) => {
    const R = 6371; 
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  const mapMarkers = role === 'customer' 
    ? [
        { id: 'user', position: currentPos, title: 'Você', type: 'user' as const },
        ...(activeRequest?.status === 'accepted' || activeRequest?.status === 'in_progress' ? [{
          id: 'active-driver',
          position: driverPos,
          title: 'Seu Guincho',
          type: 'active-driver' as const
        }] : (isDriverOnline ? MOCK_DRIVERS.map(d => ({ 
          id: d.id, 
          position: { lat: d.lat, lng: d.lng }, 
          title: 'Guincho Disponível', 
          type: 'driver' as const,
          price: 120 + Math.random() * 100
        })) : []))
      ]
    : [
        { id: 'driver-me', position: driverPos, title: isDriverOnline ? 'Você (Online)' : 'Você (Offline)', type: 'driver' as const },
        ...(isDriverOnline ? allRequests.filter(r => r.status === 'pending').map(r => ({
          id: r.id,
          position: { lat: r.origin.lat, lng: r.origin.lng },
          title: `Chamada de ${r.customerName.split(' ')[0]}`,
          type: 'user' as const,
          price: r.price
        })) : [])
      ];

  const handleRequestTow = async () => {
    if (!user) return handleLogin();
    const newReqData: Partial<TowRequest> = {
      customerId: user.uid,
      customerName: user.displayName || 'Cliente',
      status: 'pending',
      price: 185.00,
      origin: { lat: currentPos.lat, lng: currentPos.lng, address: 'Av. Paulista, 1000' },
      destination: { lat: selectedDestination.lat, lng: selectedDestination.lng, address: selectedDestination.address },
      vehicleDetails: 'Volkswagen Gol - GGG-9988',
    };
    
    await createRequest(newReqData);
    setIsSidebarOpen(false);
    addNotification("Solicitação enviada! Buscando motoristas...");
  };

  const handleAcceptRequest = async (request: TowRequest) => {
    if (!user) return handleLogin();
    // Use driver's current pos as initial driverLocation
    await updateRequestStatus(request.id, 'accepted', user.uid);
    await updateRequestDriverLocation(request.id, driverPos.lat, driverPos.lng);
    addNotification(`Você aceitou a corrida de ${request.customerName}!`);
  };

  const handleArrivedAtOrigin = async () => {
    if (activeRequest) {
      setShowSecurityModal(true);
    }
  };

  const handleVerifyCode = async () => {
    if (activeRequest && enteredCode.toUpperCase() === activeRequest.securityCode) {
      await updateRequestStatus(activeRequest.id, 'in_progress');
      setShowSecurityModal(false);
      setEnteredCode('');
      addNotification("Código verificado! Iniciando transporte...");
    } else {
      addNotification("Código incorreto. Tente novamente.");
    }
  };

  const handleCancelRequest = async () => {
    if (activeRequest) {
      await deleteRequest(activeRequest.id);
      setActiveRequest(null);
      addNotification("Corrida cancelada com sucesso.");
    }
  };

  const handleCompleteService = () => {
    if (activeRequest) {
      updateRequestStatus(activeRequest.id, 'completed');
      setActiveRequest(null);
      setShowRating(true);
      addNotification("Serviço finalizado!");
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-black">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 transform transition-all duration-500 ease-out lg:relative lg:translate-x-0 border-r",
        "bg-white/80 dark:bg-black/60 backdrop-blur-2xl border-slate-100 dark:border-white/5 shadow-2xl",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-8 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-black dark:bg-white rounded-2xl text-white dark:text-black shadow-2xl">
                  <Truck size={24} strokeWidth={2.5} />
                </div>
                <h1 className="text-xl font-black tracking-tighter uppercase italic">GuinchoJá</h1>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 opacity-50 hover:opacity-100 transition-opacity">
                <XCircle size={28} />
              </button>
            </div>

            <nav className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl mb-6">
              <button 
                onClick={() => setView('map')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  view === 'map' ? "bg-white dark:bg-white/10 shadow-sm text-black dark:text-white" : "text-slate-400"
                )}
              >
                Mapa
              </button>
              <button 
                onClick={() => setView('history')}
                className={cn(
                  "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  view === 'history' ? "bg-white dark:bg-white/10 shadow-sm text-black dark:text-white" : "text-slate-400"
                )}
              >
                Histórico
              </button>
            </nav>

            {view === 'map' && (
              <div className="space-y-4">
                {role === 'customer' ? (
                  <>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 transition-all focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white">
                      <label className="text-[9px] text-slate-400 uppercase font-black mb-1.5 block tracking-widest">Partida</label>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white shadow-lg"></div>
                        <input className="bg-transparent border-none outline-none text-xs font-bold w-full" defaultValue="Av. Paulista, 1000" />
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 transition-all focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white">
                      <label className="text-[9px] text-slate-400 uppercase font-black mb-1.5 block tracking-widest">Destino</label>
                      <select 
                        onChange={(e) => setSelectedDestination(MOCK_DESTINATIONS[parseInt(e.target.value)])}
                        className="bg-transparent border-none outline-none text-xs font-bold w-full cursor-pointer"
                      >
                        {MOCK_DESTINATIONS.map((d, index) => (
                          <option key={d.id} value={index}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    {!activeRequest && (
                      <button onClick={handleRequestTow} className="w-full mt-4 bg-black dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs">
                        Solicitar Guincho
                      </button>
                    )}
                  </>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 text-center">
                    <p className="text-xs font-bold opacity-50 mb-2 uppercase tracking-widest">Modo Motorista</p>
                    <p className="text-[10px] opacity-30 leading-relaxed">Aguarde novas chamadas no radar abaixo ou gerencie sua corrida ativa.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 p-8 overflow-y-auto space-y-10 custom-scrollbar">
            {view === 'history' ? (
              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Suas Atividades</h3>
                <div className="space-y-4">
                  {history.length > 0 ? history.map((h) => (
                    <div key={h.id} className="p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                      <div className="flex justify-between items-start mb-3">
                         <span className={cn(
                           "text-[8px] font-black uppercase px-2 py-1 rounded",
                           h.status === 'completed' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                         )}>
                            {h.status === 'completed' ? 'Finalizada' : 'Cancelada'}
                         </span>
                         <span className="text-[9px] font-bold opacity-30 tracking-tight">R$ {h.price}</span>
                      </div>
                      <p className="text-xs font-bold mb-1">{h.origin.address}</p>
                      <p className="text-[10px] opacity-50 mb-3 truncate">Destino: {h.destination.address}</p>
                      <div className="flex items-center gap-2">
                        <User size={12} className="opacity-30" />
                        <span className="text-[10px] font-bold opacity-50">{role === 'driver' ? h.customerName : 'Motorista Express'}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs opacity-30 italic">Sem registros históricos.</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6 border-l-4 border-black dark:border-white pl-3">Live Feed</h3>
                <div className="space-y-4">
                  {notifications.length > 0 ? notifications.map((note, idx) => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={idx} className="p-5 rounded-3xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 shadow-sm">
                      <p className="text-[13px] font-semibold leading-relaxed mb-2">{note}</p>
                      <span className="text-[9px] font-black text-slate-300 dark:text-white/20 uppercase tracking-widest">Agora mesmo</span>
                    </motion.div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-10 opacity-20">
                      <Navigation size={32} />
                      <p className="text-[10px] uppercase font-black mt-4">Nenhuma Atividade</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-6">
               <button onClick={() => setRole(role === 'customer' ? 'driver' : 'customer')} className="text-[10px] font-black px-4 py-2 bg-slate-200 dark:bg-white/10 rounded-xl uppercase tracking-tighter hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                  Alternar: {role === 'customer' ? 'Usuário' : 'Motorista'}
               </button>
               {role === 'driver' && (
                 <button 
                   onClick={() => setIsDriverOnline(!isDriverOnline)} 
                   className={cn(
                     "text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-tighter transition-all",
                     isDriverOnline ? "bg-green-500 text-white" : "bg-red-500 text-white"
                   )}
                 >
                   {isDriverOnline ? 'Online' : 'Offline'}
                 </button>
               )}
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=000&color=fff`} className="w-12 h-12 rounded-2xl shadow-xl grayscale" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{user.displayName}</p>
                    <button onClick={handleLogout} className="text-[9px] text-red-500 font-bold uppercase tracking-widest hover:underline">Sair</button>
                  </div>
                </>
              ) : (
                <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-black uppercase tracking-widest">
                   Entrar com Google
                </button>
              )}
              <button onClick={toggleTheme} className="p-3 border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all">
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Mobile FABs */}
        <div className="lg:hidden flex items-center justify-between p-6 z-[40] absolute inset-x-0 top-0 pointer-events-none">
          <button onClick={() => setIsSidebarOpen(true)} className="pointer-events-auto w-14 h-14 bg-white/80 dark:bg-black/60 backdrop-blur-xl shadow-2xl rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/10">
            <Menu size={24} />
          </button>
          <div className="pointer-events-auto bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl">
            {role === 'customer' ? 'Solicitar' : 'Disponível'}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative z-0">
          <InteractiveMap 
            center={role === 'driver' ? driverPos : currentPos} 
            markers={mapMarkers} 
            origin={activeRequest 
              ? (activeRequest.status === 'accepted' 
                  ? { lat: driverPos.lat, lng: driverPos.lng } 
                  : { lat: activeRequest.origin.lat, lng: activeRequest.origin.lng }
                ) 
              : undefined
            }
            destination={activeRequest 
              ? (activeRequest.status === 'accepted' 
                  ? { lat: activeRequest.origin.lat, lng: activeRequest.origin.lng } 
                  : { lat: activeRequest.destination.lat, lng: activeRequest.destination.lng }
                ) 
              : undefined
            }
          />
        </div>

        {/* Driver Interaction Panel */}
        {role === 'driver' && isDriverOnline && !activeRequest && (
          <div className="absolute inset-x-0 bottom-10 p-6 z-20 pointer-events-none">
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-xl mx-auto w-full pointer-events-auto">
              <div className="glass p-8 rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest italic">Corridas Próximas</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Radar Ativo</span>
                  </div>
                </div>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {allRequests.filter(r => r.status === 'pending').length > 0 ? allRequests.filter(r => r.status === 'pending').map((req) => (
                    <div key={req.id} className="p-5 rounded-[1.5rem] bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase italic tracking-tighter">{req.customerName}</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">R$ {req.price.toFixed(2)} • 1.2 Km</p>
                        </div>
                      </div>
                      <button onClick={() => handleAcceptRequest(req)} className="bg-black dark:bg-white text-white dark:text-black text-[10px] font-black px-6 py-4 rounded-2xl transition-all shadow-xl active:scale-95 uppercase tracking-widest">
                        Aceitar
                      </button>
                    </div>
                  )) : (
                    <div className="py-10 text-center opacity-30">
                      <Search size={32} className="mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Aguardando passageiros...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Global Active Service Card */}
        <AnimatePresence>
          {activeRequest && activeRequest.status !== 'pending' && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 100, opacity: 0 }} 
              className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[92%] md:w-[720px] max-w-[95%] z-[100]"
            >
              <div className="glass p-6 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-center gap-8 border-white/5">
                <div className="flex items-center gap-6 flex-1 w-full">
                  <div className="relative group shrink-0">
                    <img src={role === 'customer' ? "https://i.pravatar.cc/150?u=driver" : "https://i.pravatar.cc/150?u=customer"} className="w-20 h-20 rounded-[2rem] object-cover grayscale brightness-110 border-4 border-black dark:border-white shadow-2xl transition-transform group-hover:scale-105" />
                    <div className="absolute -bottom-3 -right-3 bg-black dark:bg-white text-white dark:text-black text-[9px] font-black px-3 py-2 rounded-xl shadow-xl uppercase border-2 border-white dark:border-black">
                      4.9 ★
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xl font-black text-black dark:text-white uppercase italic tracking-tighter mb-1">
                      {role === 'customer' ? 'Ricardão do Guincho' : activeRequest.customerName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                        {activeRequest.status === 'accepted' ? 'À Caminho' : 'Em Serviço'}
                      </div>
                      <span className="text-[11px] font-bold opacity-40">
                        Distância: {calculateDistance(driverPos, activeRequest.status === 'accepted' ? activeRequest.origin : activeRequest.destination)}Km
                      </span>
                      {role === 'customer' && (
                        <div className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Lock size={10} />
                          Código: {activeRequest.securityCode}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto md:pl-8 md:border-l border-black/5 dark:border-white/5">
                  <div className="flex flex-col md:items-end flex-1">
                    <p className="text-4xl font-black text-black dark:text-white leading-none tracking-tighter italic">R${activeRequest.price}</p>
                    <span className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">Valor Fixo</span>
                  </div>
                  <div className="flex gap-2">
                     {role === 'driver' ? (
                        <>
                          {activeRequest.status === 'accepted' ? (
                            <button onClick={handleArrivedAtOrigin} className="bg-black dark:bg-white text-white dark:text-black px-10 py-5 rounded-[1.5rem] text-[11px] font-black shadow-2xl transition-all active:scale-95 uppercase tracking-widest whitespace-nowrap">
                              Cheguei no Local
                            </button>
                          ) : (
                            <button onClick={handleCompleteService} className="bg-black dark:bg-white text-white dark:text-black px-10 py-5 rounded-[1.5rem] text-[11px] font-black shadow-2xl transition-all active:scale-95 uppercase tracking-widest">
                              Finalizar
                            </button>
                          )}
                        </>
                     ) : (
                        <button onClick={handleCancelRequest} className="bg-slate-100 dark:bg-white/5 text-slate-400 px-8 py-5 rounded-[1.5rem] text-[11px] font-black transition-all hover:bg-red-500 hover:text-white uppercase tracking-widest">
                          Cancelar
                        </button>
                     )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Rating View */}
      <AnimatePresence>
        {showRating && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-12 rounded-[4rem] w-full max-w-sm text-center border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]">
              <div className="mx-auto w-24 h-24 bg-black dark:bg-white rounded-3xl flex items-center justify-center text-white dark:text-black mb-8 rotate-3 shadow-2xl">
                <Star size={48} className="fill-current" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight italic mb-4">Serviço Concluído!</h3>
              <p className="text-sm opacity-50 mb-10 leading-relaxed font-semibold">Como foi sua experiência com o parceiro GuinchoJá hoje?</p>
              
              <div className="flex justify-center gap-3 mb-12">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)} className={cn("transition-transform hover:scale-125", rating >= s ? "text-black dark:text-white" : "opacity-20")}>
                    <Star size={36} className={cn(rating >= s && "fill-current")} />
                  </button>
                ))}
              </div>

              <button onClick={() => setShowRating(false)} className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-transform active:scale-95">
                Enviar Feedback
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Security Code Modal for Driver */}
      <AnimatePresence>
        {showSecurityModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass p-10 rounded-[3rem] w-full max-w-sm text-center border-white/10 shadow-2xl">
              <div className="mx-auto w-20 h-20 bg-black dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-black mb-6 shadow-xl">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight mb-2">Código de Segurança</h3>
              <p className="text-xs opacity-50 mb-8 font-semibold">Solicite o código de 4 dígitos ao cliente para iniciar a corrida.</p>
              
              <input 
                type="text" 
                maxLength={4}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
                placeholder="XXXX"
                className="w-full text-center text-3xl font-black tracking-[0.5em] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-6 mb-8 uppercase"
              />

              <div className="flex gap-3">
                <button onClick={() => setShowSecurityModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                  Cancelar
                </button>
                <button 
                  onClick={handleVerifyCode} 
                  disabled={enteredCode.length !== 4}
                  className="flex-[2] py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
