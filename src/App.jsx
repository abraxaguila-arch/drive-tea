     import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, updateDoc, setDoc, addDoc, serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { Bell, Clock, Archive, Check, X, MessageCircle, Activity, Hash, Settings, Smartphone, Trash2 } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyAoVkhpsSmak7-dfr08suTiFGDojpXLoic",
  authDomain: "drive-tea.firebaseapp.com",
  projectId: "drive-tea",
  storageBucket: "drive-tea.firebasestorage.app",
  messagingSenderId: "92344292901",
  appId: "1:92344292901:web:984971533ed0e80965d1cc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'drive-tea-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [filter, setFilter] = useState('activos');
  const [loading, setLoading] = useState(true);
  const [editingObs, setEditingObs] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const pRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'pacientes');
    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');

    const unsubP = onSnapshot(pRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPacientes(data.sort((a, b) => (b.fechaCreacion?.seconds || 0) - (a.fechaCreacion?.seconds || 0)));
      setLoading(false);
    });

    const unsubL = onSnapshot(lRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMensajes(data.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds).slice(0, 30));
    });

    return () => { unsubP(); unsubL(); };
  }, [user]);

  const enviarAGoogleChat = async (texto) => {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ text: texto })
      });
    } catch (e) { console.error("Error en Webhook:", e); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!user || !newUserId) return;
    const id = `p_${Date.now()}`;
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'pacientes', id), {
      numero: newUserId,
      psicologia: { status: null, obs: '' },
      fonoaudiologia: { status: null, obs: '' },
      terapiaOcupacional: { status: null, obs: '' },
      completado: false,
      cerrado: false,
      fechaCreacion: serverTimestamp()
    });
    setNewUserId('');
    setShowAddModal(false);
  };

  const updateEstado = async (paciente, area, status) => {
    const areaData = { ...paciente[area], status };
    const update = { [area]: areaData };
    const psicStatus = area === 'psicologia' ? status : paciente.psicologia.status;
    const fonoStatus = area === 'fonoaudiologia' ? status : paciente.fonoaudiologia.status;
    const toStatus = area === 'terapiaOcupacional' ? status : paciente.terapiaOcupacional.status;
    const estanListosLosTres = (psicStatus !== null && fonoStatus !== null && toStatus !== null);

    if (estanListosLosTres && !paciente.completado) {
      update.completado = true;
      const mensajeAlerta = `🔔 PROCESO TERMINADO: El equipo ha finalizado la evaluación del Usuario #${paciente.numero}. Ya puedes revisar y cerrar el diagnóstico.`;
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
        texto: mensajeAlerta, tipo: 'alert', timestamp: serverTimestamp()
      });
      enviarAGoogleChat(mensajeAlerta);
    } else if (!estanListosLosTres) {
      update.completado = false;
    }
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'pacientes', paciente.id), update);
  };

  const saveObs = async (paciente, area, text) => {
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'pacientes', paciente.id), {
      [area]: { ...paciente[area], obs: text }
    });
    setEditingObs(null);
  };

  const cerrarProceso = async (p) => {
    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'pacientes', p.id), { cerrado: true });
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs'), {
      texto: `📁 Archivo: Proceso del Usuario #${p.numero} finalizado y guardado.`,
      tipo: 'info', timestamp: serverTimestamp()
    });
  };

  const borrarHistorial = async () => {
    if (!window.confirm('¿Borrar todo el historial de alertas?')) return;
    const lRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'logs');
    const snap = await getDocs(lRef);
    snap.docs.forEach(async (d) => {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'logs', d.id));
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 text-indigo-600 font-black animate-pulse">CARGANDO...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3.5 rounded-2xl text-white"><Activity size={24} /></div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Drive TEA Colaborativo</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Sincronización en Tiempo Real</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setShowSettings(!showSettings)} className={`p-3 rounded-2xl transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
              <Settings size={20} />
            </button>
            <button onClick={() => setFilter(filter === 'activos' ? 'cerrados' : 'activos')} className="flex-1 md:flex-none px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase transition-all hover:bg-slate-200">
              {filter === 'activos' ? 'Historial' : 'Activos'}
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-indigo-100 active:scale-95 transition-all">
              + Nuevo Usuario
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-500 rounded-lg"><Smartphone size={20}/></div>
              <h3 className="font-black uppercase text-sm tracking-widest">Notificaciones Google Chat</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="https://chat.googleapis.com/v1/spaces/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-3 text-sm outline-none focus:border-indigo-500 transition-all font-mono"/>
              <button onClick={() => setShowSettings(false)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase">Guardar</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-6 py-5 text-left">Referencia</th>
                    <th className="px-4 py-5 text-center">Psicología</th>
                    <th className="px-4 py-5 text-center">Fonoaudiología</th>
                    <th className="px-4 py-5 text-center">T. Ocupacional</th>
                    <th className="px-6 py-5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pacientes.filter(p => filter === 'activos' ? !p.cerrado : p.cerrado).map((p) => (
                    <tr key={p.id} className={`${p.completado && !p.cerrado ? 'bg-indigo-50/20' : ''} transition-colors group`}>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-sm">{p.numero}</div>
                        </div>
                      </td>
                      {['psicologia', 'fonoaudiologia', 'terapiaOcupacional'].map(area => (
                        <td key={area} className="px-2 py-4">
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                              <button onClick={() => updateEstado(p, area, true)} className={`p-2.5 rounded-xl transition-all ${p[area].status === true ? 'bg-green-500 text-white shadow-md' : 'text-slate-300 hover:text-green-500'}`}><Check size={18} strokeWidth={4}/></button>
                              <button onClick={() => updateEstado(p, area, false)} className={`p-2.5 rounded-xl transition-all ${p[area].status === false ? 'bg-red-500 text-white shadow-md' : 'text-slate-300 hover:text-red-500'}`}><X size={18} strokeWidth={4}/></button>
                            </div>
                            <button onClick={() => setEditingObs({ p, area })} className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${p[area].obs ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}>
                              <MessageCircle size={10} /> {p[area].obs ? 'Ver Nota' : 'Nota'}
                            </button>
                          </div>
                        </td>
                      ))}
                      <td className="px-6 py-4 text-center">
                        {p.completado && !p.cerrado ? (
                          <button onClick={() => cerrarProceso(p)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">Cerrar</button>
                        ) : p.cerrado ? (
                          <div className="flex items-center justify-center gap-1.5 text-slate-300 font-black text-[10px] uppercase italic"><Archive size={12}/> Archivado</div>
                        ) : (
                          <div className="text-amber-500 text-[9px] font-black uppercase flex flex-col items-center gap-1"><Clock size={14} className="animate-pulse" /><span>Pendiente</span></div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pacientes.length === 0 && (
                    <tr><td colSpan="5" className="py-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">No hay registros aún</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-200 h-[500px] flex flex-col">
              <h2 className="text-slate-900 font-black text-xs uppercase tracking-[0.2em] mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                Alertas Activas <Bell size={16} className="text-amber-500 animate-bounce" />
              </h2>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {mensajes.map(m => (
                  <div key={m.id} className={`p-4 rounded-3xl text-[11px] leading-relaxed ${m.tipo === 'alert' ? 'bg-indigo-600 text-white font-bold shadow-lg' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                    {m.texto}
                    <div className="mt-2 text-[8px] font-mono opacity-50 text-right uppercase">
                      {m.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <button onClick={borrarHistorial} className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-500 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  <Trash2 size={12}/> Borrar Historial
                </button>
                <div className="bg-indigo-50 p-4 rounded-2xl">
                  <p className="text-[10px] text-indigo-700 font-bold leading-tight">La alarma se activa cuando las 3 áreas emiten respuesta.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><Hash size={32} strokeWidth={3} /></div>
            <h2 className="font-black text-slate-900 uppercase text-lg tracking-tighter mb-2">Nuevo Ingreso</h2>
            <p className="text-slate-400 text-xs font-medium mb-8">Ingresa el ID de referencia interna.</p>
            <form onSubmit={handleCreateUser}>
              <input autoFocus type="text" placeholder="Ej: 88" value={newUserId} onChange={(e)=>setNewUserId(e.target.value)} className="w-full text-center text-4xl font-black bg-slate-50 rounded-3xl p-6 outline-none border-4 border-transparent focus:border-indigo-600 transition-all text-indigo-600 mb-6 placeholder:text-slate-100"/>
              <div className="flex gap-4">
                <button type="button" onClick={()=>setShowAddModal(false)} className="flex-1 font-black text-slate-400 text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="flex-2 bg-indigo-600 text-white py-4 px-8 rounded-2xl font-black text-[10px] uppercase shadow-xl">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingObs && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-black text-indigo-900 uppercase text-xs tracking-[0.2em] mb-1">Nota de Especialidad</h3>
                <p className="text-slate-400 font-bold text-sm uppercase">Usuario #{editingObs.p.numero}</p>
              </div>
              <div className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-slate-500 uppercase">{editingObs.area}</div>
            </div>
            <textarea autoFocus className="w-full h-44 bg-slate-50 rounded-[2rem] p-6 text-sm outline-none border-2 border-transparent focus:border-indigo-600 transition-all resize-none font-medium leading-relaxed" placeholder="Escribe los detalles aquí..." defaultValue={editingObs.p[editingObs.area].obs} onBlur={(e) => saveObs(editingObs.p, editingObs.area, e.target.value)}/>
            <button onClick={()=>setEditingObs(null)} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em]">Guardar Anotación</button>
          </div>
        </div>
      )}

      <style>{`.flex-2 { flex: 2; }`}</style>
    </div>
  );
};

export default App;         
