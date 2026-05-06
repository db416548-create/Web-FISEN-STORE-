import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserIcon, LogOut, Package, Key, CreditCard, History, Settings, ExternalLink, RefreshCw, Upload, Plus, Download, Search, Edit3, Trash2, ShieldCheck, ChevronRight, Loader2, X, MessageSquare, LogIn, Save } from 'lucide-react';
import Papa from 'papaparse';
import { Product, GameKey, Transaction, UserProfile, Deposit } from '../types';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch, runTransaction, query, where, getDocs, getDoc, setDoc, limit } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { GlobalChat } from '../components/GlobalChat';

export default function Admin() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'keys' | 'transactions' | 'users' | 'deposits' | 'partner-config' | 'buyer-dashboard' | 'settings' | 'reviews'>('buyer-dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [keys, setKeys] = useState<GameKey[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: 0, originalPrice: 0, discountPercentage: 0, category: 'Key', image: '' });
  const [manualTopUp, setManualTopUp] = useState({ email: '', amount: 0, userCode: '' });
  const [isProcessingManual, setIsProcessingManual] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWA, setEditWA] = useState('');
  const [editEmail, setEditEmail] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productImgRef = useRef<HTMLInputElement>(null);
  const editImgRef = useRef<HTMLInputElement>(null);

  const OWNER_EMAIL = 'mayfisenchristmaabuat@gmail.com';
  const isOwner = user?.email === OWNER_EMAIL;
  const isPartner = userProfile?.role === 'partner';

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        unsubProfile = onSnapshot(doc(db, 'users', u.uid), (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            if (!data.userCode) {
                const newCode = `FIS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
                setDoc(doc(db, 'users', u.uid), { userCode: newCode }, { merge: true });
            }
            setUserProfile({ id: snap.id, ...data } as UserProfile);
            setEditName(data.displayName || '');
            setEditWA(data.whatsapp || '');
            setEditEmail(data.email || u.email || '');
          }
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${u.uid}`));
      } else {
        setUserProfile(null);
        if (unsubProfile) unsubProfile();
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (!user || !user.email || !userProfile) return;
    
    setLoading(true);
    
    // Default queries for customers (just their own transactions)
    let productsQuery = query(collection(db, 'products'), where('isHidden', '==', false), limit(1)); // dummy
    let keysQuery = query(collection(db, 'keys'), where('status', '==', 'available'), limit(1)); // dummy
    let transQuery = query(collection(db, 'transactions'), where('customerEmail', '==', user.email));
    
    if (isOwner) {
      productsQuery = collection(db, 'products') as any;
      keysQuery = collection(db, 'keys') as any;
      transQuery = collection(db, 'transactions') as any;
    } else if (isPartner) {
      productsQuery = query(collection(db, 'products'), where('sellerId', '==', user.uid)) as any;
      keysQuery = query(collection(db, 'keys'), where('sellerId', '==', user.uid)) as any;
      transQuery = query(collection(db, 'transactions'), where('sellerId', '==', user.uid)) as any;
    }

    const unsubs: (() => void)[] = [];

    if (isOwner || isPartner) {
        unsubs.push(onSnapshot(productsQuery, (s) => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product))), (e) => handleFirestoreError(e, OperationType.LIST, 'products')));
        unsubs.push(onSnapshot(keysQuery, (s) => setKeys(s.docs.map(d => ({ id: d.id, ...d.data() } as GameKey))), (e) => handleFirestoreError(e, OperationType.LIST, 'keys')));
        unsubs.push(onSnapshot(collection(db, 'reviews'), (s) => setAllReviews(s.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => handleFirestoreError(e, OperationType.LIST, 'reviews')));
    }

    unsubs.push(onSnapshot(transQuery, (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() } as Transaction))), (e) => handleFirestoreError(e, OperationType.LIST, 'transactions')));

    if (isOwner) {
      unsubs.push(onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile))), (e) => handleFirestoreError(e, OperationType.LIST, 'users')));
      unsubs.push(onSnapshot(collection(db, 'deposits'), (s) => setDeposits(s.docs.map(d => ({ id: d.id, ...d.data() } as Deposit))), (e) => handleFirestoreError(e, OperationType.LIST, 'deposits')));
    }
    setLoading(false);
    return () => unsubs.forEach(u => u());
  }, [user, user?.email, userProfile, isOwner, isPartner]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
        alert('File terlalu besar! Maksimal 1MB.');
        return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64 = reader.result as string;
        if (isEditing && editingProduct) {
            setEditingProduct({ ...editingProduct, image: base64 });
        } else {
            setNewProduct({ ...newProduct, image: base64 });
        }
        setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert('Login gagal!');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { 
        displayName: editName,
        whatsapp: editWA,
        email: editEmail
      }, { merge: true });
      alert('Profil berhasil diperbarui!');
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-brand-red/20 rounded-full flex items-center justify-center mb-8 text-brand-red">
          <Key size={40} />
        </div>
        <h1 className="text-4xl font-black mb-4 uppercase">Area Terbatas</h1>
        <p className="text-white/60 mb-8 max-w-sm">Silakan login dengan akun Google anda untuk mengakses panel owner FISEN STORE.</p>
        <button onClick={handleLogin} className="btn-primary flex items-center gap-3">
          <LogIn size={20} /> Login with Google
        </button>
      </div>
    );
  }

  // Dashboard logic: Access permitted for any logged-in user with a profile
  const isPartnerUser = userProfile?.role === 'partner';

  if (!userProfile) {
    return (
        <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-brand-red mb-4" size={40} />
            <p className="text-white/40 uppercase tracking-widest text-xs font-bold">Memuat Data Profil...</p>
        </div>
    );
  }

  const handleAddProduct = async () => {
    try {
      await addDoc(collection(db, 'products'), {
        ...newProduct,
        price: Number(newProduct.price),
        originalPrice: Number(newProduct.originalPrice || 0),
        discountPercentage: Number(newProduct.discountPercentage || 0),
        sellerId: user.uid,
        sellerType: isOwner ? 'owner' : 'partner',
        isHidden: false
      });
      setShowAddProduct(false);
      setNewProduct({ name: '', description: '', price: 0, originalPrice: 0, discountPercentage: 0, category: 'Key', image: '' });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'products');
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    try {
      await runTransaction(db, async (t) => {
        t.update(doc(db, 'products', editingProduct.id), {
          ...editingProduct,
          price: Number(editingProduct.price),
          originalPrice: Number(editingProduct.originalPrice || 0),
          discountPercentage: Number(editingProduct.discountPercentage || 0)
        });
      });
      setEditingProduct(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `products/${editingProduct.id}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Hapus produk ini? Pastikan anda sudah menghapus semua key terkait.')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
      }
    }
  };

  const handleExportKeys = () => {
    const csv = Papa.unparse(keys);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'keys_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportKeys = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const importedKeys = results.data as any[];
        let totalCount = 0;
        
        try {
          // Batching process: 500 items max per batch
          const CHUNK_SIZE = 400; // Safer than 500
          for (let i = 0; i < importedKeys.length; i += CHUNK_SIZE) {
            const chunk = importedKeys.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            let chunkCount = 0;

            chunk.forEach(k => {
              if (k.key && k.productId) {
                const newKeyRef = doc(collection(db, 'keys'));
                batch.set(newKeyRef, {
                  productId: k.productId.trim(),
                  key: k.key.trim(),
                  status: 'available',
                  sellerId: user.uid,
                  createdAt: serverTimestamp()
                });
                chunkCount++;
              }
            });

            if (chunkCount > 0) {
              await batch.commit();
              totalCount += chunkCount;
            }
          }
          
          if (totalCount > 0) {
            alert(`Berhasil mengimpor ${totalCount} key ke database!`);
          } else {
            alert('Tidak ada key valid ditemukan di file CSV (Pastikan header ada: productId, key)');
          }
        } catch (e) {
          console.error('Import Error:', e);
          handleFirestoreError(e, OperationType.WRITE, 'keys');
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error('Parse Error:', error);
        alert('Gagal membaca file CSV: ' + error.message);
        setLoading(false);
      }
    });
  };

  const handleDeleteKey = async (id: string) => {
    if (confirm('Hapus key ini?')) {
      try {
        await deleteDoc(doc(db, 'keys', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `keys/${id}`);
      }
    }
  };

  const handleManualTopUp = async () => {
    if ((!manualTopUp.email && !manualTopUp.userCode) || manualTopUp.amount <= 0) {
      alert('Masukkan Email atau Kode User serta jumlah yang valid!');
      return;
    }

    setIsProcessingManual(true);
    try {
      let targetUserId = '';
      let targetEmail = '';

      if (manualTopUp.userCode) {
        const q = query(collection(db, 'users'), where('userCode', '==', manualTopUp.userCode.toUpperCase().trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetUserId = snap.docs[0].id;
          targetEmail = snap.docs[0].data().email;
        } else {
          alert('Kode user tidak ditemukan!');
          setIsProcessingManual(false);
          return;
        }
      } else {
        const q = query(collection(db, 'users'), where('email', '==', manualTopUp.email.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          targetUserId = snap.docs[0].id;
          targetEmail = manualTopUp.email;
        } else {
          alert('Email tidak ditemukan!');
          setIsProcessingManual(false);
          return;
        }
      }

      const userRef = doc(db, 'users', targetUserId);

      await runTransaction(db, async (transaction) => {
        const freshSnap = await transaction.get(userRef);
        if (!freshSnap.exists()) throw new Error('User does not exist');
        
        const newBalance = (freshSnap.data().balance || 0) + manualTopUp.amount;
        transaction.update(userRef, { balance: newBalance });
        
        const depRef = doc(collection(db, 'deposits'));
        transaction.set(depRef, {
            userId: targetUserId,
            userEmail: targetEmail,
            amount: manualTopUp.amount,
            method: 'manual_admin',
            status: 'completed',
            createdAt: serverTimestamp()
        });
      });

      alert(`Berhasil menambahkan Rp ${manualTopUp.amount.toLocaleString('id-ID')} ke ${targetEmail}`);
      setManualTopUp({ email: '', amount: 0, userCode: '' });
    } catch (e) {
      console.error(e);
      alert('Gagal menambahkan saldo.');
    } finally {
      setIsProcessingManual(false);
    }
  };

  const handleToggleRole = async (u: UserProfile, role: 'customer' | 'reseller' | 'partner') => {
    try {
      await runTransaction(db, async (t) => {
        t.update(doc(db, 'users', u.id), { role });
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${u.id}`);
    }
  };

  const handleApproveDeposit = async (dep: Deposit) => {
    try {
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'users', dep.userId);
        const userSnap = await t.get(userRef);
        if (userSnap.exists()) {
          const currentBalance = userSnap.data().balance || 0;
          t.update(userRef, { balance: currentBalance + dep.amount });
          t.update(doc(db, 'deposits', dep.id), { status: 'completed' });
        }
      });
      alert('Deposit disetujui, saldo ditambahkan!');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `deposits/${dep.id}`);
    }
  };

  return (
    <div className={`min-h-screen bg-brand-black pb-24 relative ${(showAddProduct || editingProduct) ? 'overflow-hidden' : ''}`}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-green/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-blue/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="transition-all duration-500">
        <nav className="border-b border-white/10 glass-morphism sticky top-0 z-[100] backdrop-blur-xl">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <button onClick={() => window.location.href = '/'} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-neon-green rounded-xl flex items-center justify-center neon-border-green">
                            <Package className="text-black group-hover:scale-110 transition-transform" />
                        </div>
                        <span className="text-2xl font-black uppercase tracking-tighter neon-glow-green">FISEN <span className="text-white font-normal italic">STORE</span></span>
                    </button>
                </div>
                {user && (
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-white/40 uppercase font-black">Saldo Anda</p>
                            <p className="text-sm font-black text-neon-green">Rp {userProfile?.balance?.toLocaleString('id-ID') || 0}</p>
                        </div>
                    </div>
                )}
            </div>
        </nav>

        <div className="container mx-auto px-4 py-12 relative z-10">
          <GlobalChat userProfile={userProfile} />

      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-morphism w-full max-w-md rounded-3xl p-8 animate-in zoom-in-95 duration-300">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold uppercase tracking-tight">Tambah Produk Baru</h3>
                <button onClick={() => setShowAddProduct(false)} className="text-white/40 hover:text-white"><X/></button>
             </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Nama Produk</label>
                  <input placeholder="Contoh: Drip Client 1 Day" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Harga Asli (Rp)</label>
                    <input placeholder="Harga Asli" type="number" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all" value={newProduct.originalPrice || ''} onChange={e => {
                        const original = Number(e.target.value);
                        const discount = newProduct.discountPercentage || 0;
                        const final = discount > 0 ? original * (1 - discount / 100) : original;
                        setNewProduct({...newProduct, originalPrice: original, price: final});
                    }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Diskon (%)</label>
                    <input placeholder="Diskon" type="number" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all" value={newProduct.discountPercentage || ''} onChange={e => {
                        const discount = Number(e.target.value);
                        const original = newProduct.originalPrice || 0;
                        const final = original * (1 - discount / 100);
                        setNewProduct({...newProduct, discountPercentage: discount, price: final});
                    }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1 text-neon-green">Harga Jual Akhir (Auto)</label>
                  <input placeholder="Harga Akhir" type="number" className="w-full bg-white/10 p-3 rounded-xl border border-neon-green/20 outline-none text-neon-green font-bold" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Deskripsi</label>
                  <textarea placeholder="Fitur produk..." className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all h-24" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Gambar Produk</label>
                  <div className="flex gap-4 items-center">
                    <button 
                        onClick={() => productImgRef.current?.click()}
                        className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex flex-col items-center gap-2 group w-full"
                    >
                        {newProduct.image ? (
                            <img src={newProduct.image} alt="Preview" className="w-12 h-12 object-cover rounded-md" />
                        ) : (
                            <Upload className="text-white/40 group-hover:text-brand-red" size={24} />
                        )}
                        <span className="text-[10px] font-bold uppercase">{uploadingImage ? 'Uploading...' : 'Pilih File Gambar'}</span>
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={productImgRef} onChange={(e) => handleFileChange(e)} />
                  </div>
                  <input placeholder="Atau masukkan URL gambar" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all mt-2" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
                </div>
                <button onClick={handleAddProduct} className="w-full btn-primary py-4">Simpan Produk</button>
             </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-morphism w-full max-w-md rounded-3xl p-8 animate-in zoom-in-95 duration-300">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold uppercase tracking-tight">Edit Produk</h3>
                <button onClick={() => setEditingProduct(null)} className="text-white/40 hover:text-white"><X/></button>
             </div>
             <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Nama Produk</label>
                  <input className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Harga Asli (Rp)</label>
                    <input type="number" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all" value={editingProduct.originalPrice || 0} onChange={e => {
                        const original = Number(e.target.value);
                        const discount = editingProduct.discountPercentage || 0;
                        const final = discount > 0 ? original * (1 - discount / 100) : original;
                        setEditingProduct({...editingProduct, originalPrice: original, price: final});
                    }} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Diskon (%)</label>
                    <input type="number" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all" value={editingProduct.discountPercentage || 0} onChange={e => {
                        const discount = Number(e.target.value);
                        const original = editingProduct.originalPrice || 0;
                        const final = original * (1 - discount / 100);
                        setEditingProduct({...editingProduct, discountPercentage: discount, price: final});
                    }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1 text-neon-green">Harga Jual Akhir</label>
                  <input type="number" className="w-full bg-white/10 p-3 rounded-xl border border-neon-green/20 outline-none text-neon-green font-bold" value={editingProduct.price || 0} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 uppercase font-bold ml-1 text-brand-red">Visibility</label>
                    <select 
                        className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none"
                        value={editingProduct.isHidden ? 'true' : 'false'}
                        onChange={(e) => setEditingProduct({...editingProduct, isHidden: e.target.value === 'true'})}
                    >
                        <option value="false" className="bg-zinc-900">Muncul di Toko</option>
                        <option value="true" className="bg-zinc-900">Sembunyikan Produk</option>
                    </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Gambar Produk</label>
                  <div className="flex gap-4 items-center">
                    <button 
                        onClick={() => editImgRef.current?.click()}
                        className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex flex-col items-center gap-2 group w-full"
                    >
                        {editingProduct.image ? (
                            <img src={editingProduct.image} alt="Preview" className="w-12 h-12 object-cover rounded-md" />
                        ) : (
                            <Upload className="text-white/40 group-hover:text-brand-red" size={24} />
                        )}
                        <span className="text-[10px] font-bold uppercase">{uploadingImage ? 'Uploading...' : 'Ganti Gambar'}</span>
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={editImgRef} onChange={(e) => handleFileChange(e, true)} />
                  </div>
                  <input placeholder="Atau masukkan URL gambar" className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all mt-2" value={editingProduct.image} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Deskripsi</label>
                  <textarea className="w-full bg-white/5 p-3 rounded-xl border border-white/10 outline-none focus:border-brand-red transition-all h-24" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                </div>
                <button onClick={handleUpdateProduct} className="w-full btn-primary py-4">Perbarui Produk</button>
             </div>
          </div>
        </div>
      )}

      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
            <div>
              <h1 className="text-4xl font-black mb-2 uppercase">
                {isOwner ? 'Owner Panel' : isPartner ? 'Partner Panel' : 'Dashboard Pengguna'}
              </h1>
              <p className="text-white/60 font-mono text-sm uppercase tracking-widest text-brand-red">
                Dashboard / {isOwner ? 'Fisen Store' : isPartner ? (userProfile?.partnerInfo?.storeName || 'Partner') : 'Member Area'}
              </p>
            </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:text-brand-red hover:bg-brand-red/10 transition-all"
            title="Keluar Admin"
          >
            <LogOut size={20} />
          </button>
        </div>
        
        <div className="flex glass-morphism p-1.5 rounded-2xl flex-wrap">
          {[
            { id: 'buyer-dashboard', label: 'Dashboard Utama', icon: UserIcon },
            ...(isOwner || isPartner ? [
                { id: 'products', label: 'Stok Produk', icon: Package },
                { id: 'keys', label: 'Game Keys', icon: Key },
                { id: 'transactions', label: 'History Order', icon: History },
            ] : []),
            ...(isOwner ? [
                { id: 'users', label: 'Pelanggan', icon: UserIcon },
                { id: 'deposits', label: 'Konfirmasi TopUp', icon: Save }
            ] : []),
            ...(isPartner ? [
                { id: 'partner-config', label: 'Branding Toko', icon: Save }
            ] : []),
            { id: 'settings', label: 'Pengaturan Akun', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
                activeTab === tab.id ? 'bg-neon-green text-black shadow-lg neon-border-green' : 'hover:bg-white/5 text-white/60'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-morphism rounded-3xl p-8 min-h-[600px] border-white/5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <Loader2 className="animate-spin text-brand-red mb-4" size={48} />
            <p className="text-white/40">Menghubungkan ke database...</p>
          </div>
        ) : (
          <>
            {activeTab === 'buyer-dashboard' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-morphism p-6 rounded-3xl border-white/5 bg-gradient-to-br from-neon-green/10 to-transparent">
                            <p className="text-[10px] text-white/40 uppercase font-bold mb-2">Total Saldo</p>
                            <h3 className="text-2xl font-black text-neon-green">Rp {userProfile?.balance?.toLocaleString('id-ID') || 0}</h3>
                        </div>
                        <div className="glass-morphism p-6 rounded-3xl border-white/5 bg-gradient-to-br from-green-500/10 to-transparent">
                            <p className="text-[10px] text-white/40 uppercase font-bold mb-2">Berhasil</p>
                            <h3 className="text-2xl font-black text-green-500">
                                {transactions.filter(t => t.customerEmail === user?.email && t.status === 'completed').length} Pesanan
                            </h3>
                        </div>
                        <div className="glass-morphism p-6 rounded-3xl border-white/5 bg-gradient-to-br from-yellow-500/10 to-transparent">
                            <p className="text-[10px] text-white/40 uppercase font-bold mb-2">Pending</p>
                            <h3 className="text-2xl font-black text-yellow-500">
                                {transactions.filter(t => t.customerEmail === user?.email && t.status === 'pending').length} Pesanan
                            </h3>
                        </div>
                        <div className="glass-morphism p-6 rounded-3xl border-white/5 bg-gradient-to-br from-red-500/10 to-transparent">
                            <p className="text-[10px] text-white/40 uppercase font-bold mb-2">Gagal</p>
                            <h3 className="text-2xl font-black text-red-500">
                                {transactions.filter(t => t.customerEmail === user?.email && t.status === 'failed').length} Pesanan
                            </h3>
                        </div>
                    </div>

                    <div className="glass-morphism p-6 rounded-3xl border-white/5">
                        <p className="text-[10px] text-white/40 uppercase font-bold mb-2">ID UNIK ANDA</p>
                        <h3 className="text-xl font-black text-brand-red font-mono tracking-widest">{userProfile?.userCode || 'LOADING...'}</h3>
                    </div>

                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <History size={24} className="text-brand-red" />
                            Riwayat Belanja Anda
                        </h2>
                        <div className="grid grid-cols-1 gap-4">
                            {transactions.filter(t => t.customerEmail === user?.email).map((t) => (
                                <div key={t.id} className="glass-morphism p-6 rounded-2xl border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <p className="text-[10px] text-white/40 font-mono uppercase">{new Date(t.createdAt?.toDate()).toLocaleDateString('id-ID')}</p>
                                        <h4 className="font-bold text-lg">{t.productName}</h4>
                                        <p className="text-xs text-white/60">Metode: <span className="uppercase text-brand-orange font-bold font-mono">{t.method}</span></p>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-2">
                                        <p className="text-lg font-black text-white">Rp {t.amount.toLocaleString('id-ID')}</p>
                                        <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${
                                            t.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                            t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                            'bg-red-500/10 text-red-500'
                                        }`}>
                                            {t.status === 'completed' ? 'Berhasil' : t.status === 'pending' ? 'Pending' : 'Gagal'}
                                        </span>
                                        {t.status === 'completed' && (
                                            <button 
                                                onClick={async () => {
                                                    const comment = prompt('Masukkan ulasan anda:');
                                                    const rating = Number(prompt('Rating (1-5):', '5'));
                                                    if (comment && rating >= 1 && rating <= 5) {
                                                        try {
                                                            await addDoc(collection(db, 'reviews'), {
                                                                productId: t.productId,
                                                                userId: user?.uid,
                                                                userName: userProfile?.displayName || user?.email?.split('@')[0],
                                                                rating,
                                                                comment,
                                                                createdAt: serverTimestamp()
                                                            });
                                                            alert('Terima kasih atas ulasan anda!');
                                                        } catch (e) {
                                                            handleFirestoreError(e, OperationType.CREATE, 'reviews');
                                                        }
                                                    }
                                                }}
                                                className="text-[10px] text-brand-red uppercase font-bold hover:underline"
                                            >
                                                Beri Ulasan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {transactions.filter(t => t.customerEmail === user?.email).length === 0 && (
                                <div className="p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                                    <p className="text-white/20">Belum ada riwayat pembelian.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Package size={24} className="text-brand-red" />
                            Kepercayaan Konsumen
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="glass-morphism p-8 rounded-3xl border-white/5 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-brand-red/20 rounded-2xl flex items-center justify-center text-brand-red">
                                        <Save size={32} />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-black">100%</p>
                                        <p className="text-xs text-white/40 uppercase font-bold">Otomatis & Real-time</p>
                                    </div>
                                </div>
                                <p className="text-sm text-white/60 leading-relaxed italic">
                                    "Seluruh sistem pengiriman FISEN STORE menggunakan enkripsi otomatis. Key anda langsung dikirim setelah sukses payment."
                                </p>
                            </div>
                            <div className="glass-morphism p-8 rounded-3xl border-white/5 space-y-4">
                                <h4 className="font-bold uppercase tracking-tight text-white/40 text-xs">Ulasan Terbaru</h4>
                                <div className="space-y-4">
                                    {allReviews.slice(0, 3).map((r, i) => (
                                        <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex gap-1 mb-1">
                                                {[...Array(r.rating)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-brand-orange" />)}
                                            </div>
                                            <p className="text-xs text-white mb-1">"{r.comment}"</p>
                                            <p className="text-[10px] text-white/40 uppercase font-bold">— {r.userName}</p>
                                        </div>
                                    ))}
                                    {allReviews.length === 0 && <p className="text-xs text-white/20">Belum ada ulasan publik.</p>}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-2xl font-bold">Pengaturan Akun</h2>
                    <div className="glass-morphism p-8 rounded-3xl border-white/5 max-w-xl space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-brand-red/10 rounded-2xl border border-brand-red/20 mb-4">
                            <div className="w-10 h-10 bg-brand-red/20 rounded-xl flex items-center justify-center text-brand-red shrink-0">
                                <Key size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-white/40 uppercase font-bold">Kode Unik Akun</p>
                                <p className="text-lg font-black font-mono text-white">{userProfile?.userCode || 'Generating...'}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Email / Gmail</label>
                                <input 
                                    placeholder="example@gmail.com" 
                                    className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-neon-green transition-all"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Nama Tampilan</label>
                                <input 
                                    placeholder="Nama Anda" 
                                    className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-neon-green transition-all"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Nomor WhatsApp</label>
                                <input 
                                    placeholder="08..." 
                                    className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-neon-green transition-all"
                                    value={editWA}
                                    onChange={(e) => setEditWA(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            className="w-full btn-primary flex items-center justify-center gap-2"
                        >
                            {isSavingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            SIMPAN & TERAPKAN
                        </button>

                        <div className="p-4 bg-neon-green/10 rounded-2xl border border-neon-green/20">
                            <p className="text-xs text-neon-green font-bold leading-relaxed">
                                Pastikan data anda benar agar admin/penjual dapat menghubungi anda jika terjadi kendala pengiriman.
                            </p>
                        </div>
                        <button onClick={() => auth.signOut()} className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest text-xs">Keluar Dari Akun</button>
                    </div>
                </div>
            )}

            {activeTab === 'products' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Daftar Produk</h2>
                  <button onClick={() => setShowAddProduct(true)} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
                    <Plus size={18} /> Tambah Produk
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-widest">
                        <th className="pb-4 pt-2">ID</th>
                        <th className="pb-4 pt-2">Nama</th>
                        <th className="pb-4 pt-2">Stock</th>
                        <th className="pb-4 pt-2">Harga</th>
                        <th className="pb-4 pt-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {products.map(p => {
                        const productStock = keys.filter(k => k.productId === p.id && k.status === 'available').length;
                        return (
                          <tr key={p.id} className="group">
                            <td className="py-4 font-mono text-xs text-white/40">{p.id}</td>
                            <td className="py-4">
                                <div className="font-bold">{p.name}</div>
                                <div className="text-[10px] text-white/40 uppercase">{p.category}</div>
                            </td>
                            <td className="py-4">
                                <span className={`font-mono text-sm px-2 py-1 rounded-lg ${productStock > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {productStock}
                                </span>
                            </td>
                            <td className="py-4">
                                <div className="font-bold text-white">Rp {p.price.toLocaleString('id-ID')}</div>
                                {p.discountPercentage ? <div className="text-[10px] text-neon-green">-{p.discountPercentage}% OFF</div> : null}
                            </td>
                            <td className="py-4 text-right">
                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingProduct(p)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                                        <Plus size={16} />
                                    </button>
                                    <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors text-red-500/60 hover:text-red-500">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'keys' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h2 className="text-2xl font-bold">Manajemen Key</h2>
                  <div className="flex gap-4">
                    <input type="file" accept=".csv" onChange={handleImportKeys} ref={fileInputRef} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-brand-orange hover:text-brand-orange transition-all flex items-center gap-2">
                       <Upload size={18} /> Import CSV
                    </button>
                    <button onClick={handleExportKeys} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-brand-red hover:text-brand-red transition-all flex items-center gap-2">
                      <Download size={18} /> Export CSV
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-white/10 text-white/40 text-xs uppercase">
                      <tr>
                        <th className="pb-4">Product ID</th>
                        <th className="pb-4">Key Script</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {keys.slice(0, 100).map((k) => (
                        <tr key={k.id} className="text-sm">
                          <td className="py-4 font-mono text-xs">{k.productId || 'N/A'}</td>
                          <td className="py-4 font-mono text-brand-orange">{k.key}</td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              k.status === 'available' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                            }`}>
                              {k.status}
                            </span>
                          </td>
                          <td className="py-4">
                            <button onClick={() => handleDeleteKey(k.id)} className="text-white/20 hover:text-red-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Log Transaksi</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {transactions.map((t) => (
                    <div key={t.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-mono text-white/40 uppercase">{t.id}</span>
                        <span className={`text-[10px] font-black uppercase ${t.status === 'completed' ? 'text-green-500' : 'text-brand-orange'}`}>{t.status}</span>
                      </div>
                      <h4 className="font-bold mb-1">{t.productName}</h4>
                      <div className="flex flex-col gap-1 mb-4">
                        <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Penerima:</p>
                        <p className="text-white/80 text-xs truncate">📧 {t.customerEmail}</p>
                        {t.customerWA && <p className="text-white/80 text-xs">📱 {t.customerWA}</p>}
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-white/5">
                        <span className="font-black text-brand-red">Rp {t.amount.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && <p className="col-span-full py-12 text-center text-white/20">Belum ada transaksi.</p>}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section>
                  <h2 className="text-2xl font-bold mb-6">Tambah Saldo Manual</h2>
                  <div className="glass-morphism p-8 rounded-3xl border-brand-red/20 max-w-xl space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-full">
                        <label className="block text-[10px] text-white/40 uppercase mb-2 font-black">Email Member</label>
                        <input 
                          placeholder="contoh@gmail.com" 
                          className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-brand-red transition-all" 
                          value={manualTopUp.email} 
                          onChange={e => setManualTopUp({...manualTopUp, email: e.target.value})} 
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="block text-[10px] text-white/40 uppercase mb-2 font-black">ATAU KODE UNIK USER</label>
                        <input 
                          placeholder="FIS-XXXXX" 
                          className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-brand-red transition-all font-mono" 
                          value={manualTopUp.userCode} 
                          onChange={e => setManualTopUp({...manualTopUp, userCode: e.target.value})} 
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="block text-[10px] text-white/40 uppercase mb-2 font-black">Jumlah Saldo (Rp)</label>
                        <input 
                          type="number" 
                          placeholder="10000" 
                          className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-brand-red transition-all" 
                          value={manualTopUp.amount || ''} 
                          onChange={e => setManualTopUp({...manualTopUp, amount: Number(e.target.value)})} 
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleManualTopUp} 
                      disabled={isProcessingManual}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      {isProcessingManual ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                      Proses Tambah Saldo
                    </button>
                  </div>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-6">Manajemen Member</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-white/10 text-white/40 text-xs uppercase">
                        <tr>
                          <th className="pb-4">Email</th>
                          <th className="pb-4">Role</th>
                          <th className="pb-4">Saldo</th>
                          <th className="pb-4">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                          <tr key={u.id} className="text-sm">
                            <td className="py-4 font-mono">{u.email}</td>
                            <td className="py-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                u.role === 'partner' ? 'bg-brand-red/20 text-brand-red' :
                                u.role === 'reseller' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-4 font-bold text-brand-orange">Rp {u.balance?.toLocaleString('id-ID') || 0}</td>
                            <td className="py-4">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleToggleRole(u, u.role === 'reseller' ? 'customer' : 'reseller')}
                                        className={`text-[10px] uppercase font-black px-2 py-1 rounded transition-all ${
                                            u.role === 'reseller' ? 'bg-purple-500 text-white' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        {u.role === 'reseller' ? 'Revoke Reseller' : 'Set Reseller'}
                                    </button>
                                    <button 
                                        onClick={() => handleToggleRole(u, u.role === 'partner' ? 'customer' : 'partner')}
                                        className={`text-[10px] uppercase font-black px-2 py-1 rounded transition-all ${
                                            u.role === 'partner' ? 'bg-brand-red text-white' : 'bg-brand-red/10 border border-brand-red/20 text-brand-red hover:bg-brand-red/20'
                                        }`}
                                    >
                                        {u.role === 'partner' ? 'Revoke Partner' : 'Set Partner'}
                                    </button>
                                </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'deposits' && isOwner && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-2xl font-bold">Persetujuan Top-Up</h2>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                    <thead className="border-b border-white/10 text-white/40 text-xs uppercase">
                      <tr>
                        <th className="pb-4">User</th>
                        <th className="pb-4">Jumlah</th>
                        <th className="pb-4">Metode</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {deposits.map((d) => (
                        <tr key={d.id} className="text-sm">
                          <td className="py-4 font-mono text-xs">{d.userId}</td>
                          <td className="py-4 font-bold">Rp {d.amount.toLocaleString('id-ID')}</td>
                          <td className="py-4 uppercase text-[10px]">{d.method}</td>
                          <td className="py-4 text-[10px]">
                            <span className={d.status === 'pending' ? 'text-brand-orange' : 'text-green-500'}>{d.status}</span>
                          </td>
                          <td className="py-4">
                            {d.status === 'pending' && (
                              <button 
                                onClick={() => handleApproveDeposit(d)}
                                className="text-xs bg-green-500/20 text-green-500 px-3 py-1 rounded-lg border border-green-500/30 font-bold"
                              >
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'partner-config' && isPartner && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-2xl font-bold">Setelan Toko Partner</h2>
                    <div className="glass-morphism p-8 rounded-3xl border-brand-red/20 max-w-2xl space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Nama Toko</label>
                            <input 
                                placeholder="Nama Toko Anda" 
                                className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-brand-red transition-all"
                                defaultValue={userProfile?.partnerInfo?.storeName || ''}
                                onBlur={async (e) => {
                                    if (user) {
                                        await setDoc(doc(db, 'users', user.uid), { 
                                            partnerInfo: { ...userProfile?.partnerInfo, storeName: e.target.value } 
                                        }, { merge: true });
                                    }
                                }}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-white/40 uppercase font-bold ml-1">QRIS Pembayaran (URL Gambar)</label>
                            <input 
                                placeholder="https://..." 
                                className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-brand-red transition-all"
                                defaultValue={userProfile?.partnerInfo?.paymentQR || ''}
                                onBlur={async (e) => {
                                    if (user) {
                                        await setDoc(doc(db, 'users', user.uid), { 
                                            partnerInfo: { ...userProfile?.partnerInfo, paymentQR: e.target.value } 
                                        }, { merge: true });
                                    }
                                }}
                            />
                        {userProfile?.partnerInfo?.paymentQR && (
                                <div className="mt-4 p-4 bg-white rounded-2xl inline-block">
                                    <img src={userProfile.partnerInfo.paymentQR} alt="QRIS Preview" className="w-32 h-32 object-contain" />
                                </div>
                            )}
                        </div>

                        {!userProfile?.partnerInfo?.paymentQR && (
                            <div className="p-4 bg-brand-orange/10 rounded-2xl border border-brand-orange/20">
                                <p className="text-xs text-brand-orange font-bold leading-relaxed">
                                    ⚠️ Peringatan: Anda belum mengunggah QRIS. Pembayaran dari pelanggan akan masuk ke sistem Owner FISEN secara default sampai anda mengaturnya.
                                </p>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] text-white/40 uppercase font-bold ml-1">Nama Metode Pembayaran</label>
                            <input 
                                placeholder="e.g. DANA / QRIS ALL PAYMENT" 
                                className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 outline-none focus:border-brand-red transition-all"
                                defaultValue={userProfile?.partnerInfo?.paymentMethodName || ''}
                                onBlur={async (e) => {
                                    if (user) {
                                        await setDoc(doc(db, 'users', user.uid), { 
                                            partnerInfo: { ...userProfile?.partnerInfo, paymentMethodName: e.target.value } 
                                        }, { merge: true });
                                    }
                                }}
                            />
                        </div>

                        <div className="p-4 bg-brand-red/10 rounded-2xl border border-brand-red/20">
                            <p className="text-xs text-brand-red font-bold leading-relaxed">
                                Catatan: Sebagai partner, semua transaksi dari produk anda akan dibayar langsung ke QRIS yang anda masukkan di atas. Pastikan data benar!
                            </p>
                        </div>
                    </div>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
</div>
  );
}
