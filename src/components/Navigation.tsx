import { useState, useEffect } from 'react';
import { ShoppingCart, User, LayoutDashboard, LogOut, Wallet } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const Navbar = () => {
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');
  const OWNER_EMAIL = 'mayfisenchristmaabuat@gmail.com';
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWA, setEditWA] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (showDropdown) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showDropdown]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.displayName || user?.displayName || '');
      setEditWA(profile.whatsapp || '');
      setEditEmail(profile.email || user?.email || '');
    }
  }, [profile, user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { 
        displayName: editName,
        whatsapp: editWA,
        email: editEmail
      }, { merge: true });
      setShowDropdown(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (u) {
        const userRef = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const newProfile = { id: u.uid, email: u.email || '', role: 'customer', balance: 0 };
            await setDoc(userRef, newProfile);
            setProfile(newProfile as UserProfile);
          }

          unsubscribeProfile = onSnapshot(userRef, (s) => {
            if (s.exists()) {
              setProfile({ id: s.id, ...s.data() } as UserProfile);
            }
          }, (error) => {
            if (auth.currentUser) {
              handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
            }
          });
        } catch (error) {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      unsubAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/10 bg-brand-black/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tighter text-white">
            FISEN <span className="text-neon-green">STORE</span>
          </span>
          <span className="text-black font-black bg-neon-green px-1.5 py-0.5 rounded text-[10px]">555</span>
        </Link>

        <div className="flex items-center gap-4">
          {!user ? (
            <button onClick={handleLogin} className="text-sm font-black bg-neon-green px-6 py-2 rounded-xl text-black hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,85,0.4)]">
              LOGIN
            </button>
          ) : (
            <div className="flex items-center gap-3 relative">
              {profile && (
                <div className="hidden sm:flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 px-3 py-1.5 rounded-xl">
                  <Wallet size={14} className="text-neon-green" />
                  <span className="text-xs font-black text-white">
                    {user.email === OWNER_EMAIL ? 'UNLIMITED' : `Rp ${profile.balance?.toLocaleString('id-ID') || 0}`}
                  </span>
                </div>
              )}
              
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 hover:border-neon-green transition-all"
              >
                <img src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.uid}`} alt="AV" className="w-full h-full object-cover" />
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowDropdown(false)}
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-14 w-64 bg-brand-black p-4 rounded-2xl border border-white/20 shadow-2xl z-50"
                    >
                    <div className="flex items-center gap-3 mb-4 p-2 bg-white/5 rounded-xl">
                       <img src={user.photoURL || ''} className="w-8 h-8 rounded-lg" />
                       <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate">{user.displayName}</p>
                          <p className="text-[10px] text-white/40 truncate">{user.email}</p>
                       </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="px-3 py-2 bg-white/5 rounded-xl">
                        <span className="text-[10px] text-white/40 uppercase block mb-1">Nama Tampilan</span>
                        <input 
                          type="text" 
                          placeholder="Nama Anda" 
                          className="w-full bg-transparent text-xs outline-none text-white font-bold"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>

                      <div className="px-3 py-2 bg-white/5 rounded-xl">
                        <span className="text-[10px] text-white/40 uppercase block mb-1">Email Kontak</span>
                        <input 
                          type="text" 
                          placeholder="Email Anda" 
                          className="w-full bg-transparent text-xs outline-none text-white/80"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                        />
                      </div>

                      <div className="px-3 py-2 bg-white/5 rounded-xl">
                        <span className="text-[10px] text-white/40 uppercase block mb-1">WhatsApp</span>
                        <input 
                          type="text" 
                          placeholder="08..." 
                          className="w-full bg-transparent text-xs outline-none text-white/80 font-mono"
                          value={editWA}
                          onChange={(e) => setEditWA(e.target.value)}
                        />
                      </div>

                      <button 
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="w-full py-3 bg-neon-green text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,85,0.2)] disabled:opacity-50"
                      >
                        {isSaving ? 'Menyimpan...' : 'Simpan & Terapkan'}
                      </button>
                      
                      <div className="flex justify-between items-center px-3 py-2 bg-neon-green/5 rounded-xl border border-neon-green/10">
                        <span className="text-[10px] text-white/40 uppercase font-black">Saldo</span>
                        <span className="text-xs font-black text-neon-green">
                          {user.email === OWNER_EMAIL ? 'UNLIMITED' : `Rp ${profile?.balance?.toLocaleString('id-ID') || 0}`}
                        </span>
                      </div>

                      <div className="h-px bg-white/10 my-2" />
                      
                      <Link to="/admin" className="flex items-center gap-3 w-full p-2.5 text-xs font-bold hover:bg-neon-green/10 hover:text-neon-green rounded-xl transition-all" onClick={() => setShowDropdown(false)}>
                        <LayoutDashboard size={14} /> Panel Saya
                      </Link>
                      
                      <button onClick={() => auth.signOut()} className="flex items-center gap-3 w-full p-2.5 text-xs font-bold text-red-500 hover:bg-red-500/5 rounded-xl transition-all">
                        <LogOut size={14} /> Keluar Akun
                      </button>
                    </div>
                  </motion.div>
                </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export const Footer = () => {
  return (
    <footer className="bg-brand-black border-t border-white/10 py-12">
      <div className="container mx-auto px-4 text-center">
        <p className="text-2xl font-black mb-4">FISEN STORE 555</p>
        <p className="text-white/60 max-w-md mx-auto mb-8">
          Destinasi utama untuk gaming premium. Cepat, Terpercaya, dan Otomatis 24/7.
        </p>
        <div className="flex justify-center gap-8 text-sm text-white/40">
          <span>&copy; 2024 Fisen. All rights reserved.</span>
          <a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a>
        </div>
      </div>
    </footer>
  );
};
