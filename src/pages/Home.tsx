import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Zap, ShieldCheck, Clock, Loader2, Wallet, PlusCircle, Store, Trophy, ChevronRight } from 'lucide-react';
import { Product, GameKey, UserProfile } from '../types';
import { useState, useEffect } from 'react';
import { CheckoutModal } from '../components/CheckoutModal';
import { TopUpModal } from '../components/TopUpModal';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, where, limit, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { GlobalChat } from '../components/GlobalChat';

export default function Home({ contacts }: { contacts: any }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [keys, setKeys] = useState<GameKey[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [activeMarket, setActiveMarket] = useState<'all' | 'owner' | 'partner'>('all');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (u) {
            onSnapshot(doc(db, 'users', u.uid), (snap) => {
                if (snap.exists()) {
                    setUserProfile({ id: snap.id, ...snap.data() } as UserProfile);
                }
            });
        }
    });

    const unsubProds = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    const unsubKeys = onSnapshot(query(collection(db, 'keys'), where('status', '==', 'available')), (s) => {
        setKeys(s.docs.map(d => ({id: d.id, ...d.data()} as GameKey)));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'keys'));

    const unsubSellers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'partner'), limit(50)), (s) => {
        const names: Record<string, string> = {};
        s.docs.forEach(d => {
            const data = d.data() as UserProfile;
            if (data.partnerInfo?.storeName) {
                names[d.id] = data.partnerInfo.storeName;
            }
        });
        setSellerNames(names);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'users-partners'));

    const unsubReviews = onSnapshot(collection(db, 'reviews'), (s) => {
        setReviews(s.docs.map(d => d.data()));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'reviews'));

    return () => { 
        unsubAuth(); 
        unsubProds(); 
        unsubKeys(); 
        unsubSellers();
        unsubReviews();
    };
  }, []);

  const filteredProducts = products.filter(p => {
    if (p.isHidden) return false;
    if (activeMarket === 'owner') return p.sellerType === 'owner' || !p.sellerType;
    if (activeMarket === 'partner') return p.sellerType === 'partner';
    return true;
  });

  return (
    <div className="bg-brand-black min-h-screen relative">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neon-green/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-neon-blue/5 blur-[120px] rounded-full"></div>
      </div>

      <GlobalChat userProfile={userProfile} />

      <AnimatePresence>
        {selectedProduct && (
          <CheckoutModal 
            product={selectedProduct} 
            onClose={() => setSelectedProduct(null)} 
          />
        )}
        {showTopUp && (
          <TopUpModal onClose={() => setShowTopUp(false)} />
        )}
      </AnimatePresence>
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-green/10 border border-neon-green/20 text-neon-green text-xs font-bold mb-8"
          >
            <Zap size={14} />
            <span>Key Original Bergaransi</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-black mb-6 uppercase tracking-tighter neon-glow-green"
          >
            FISEN STORE 555
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-white font-medium mb-4"
          >
            Pusat Key Drip Client Terpercaya
          </motion.p>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Dapatkan key & lisensi Drip Client Free Fire terpercaya dengan harga terbaik. Pengiriman otomatis ke email, proses cepat, aman!
          </motion.p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
            <a href="#products" className="btn-primary flex items-center gap-3">
              <ShoppingCart size={20} />
              BELI SEKARANG
            </a>
            <a href="#products" className="btn-outline flex items-center gap-3">
              LIHAT PRODUK
              <ChevronRight className="rotate-90 sm:rotate-0" size={20} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto pt-12 border-t border-white/5">
            <div>
              <p className="text-4xl font-black text-neon-green mb-1">2,500+</p>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">KEY TERJUAL</p>
            </div>
            <div>
              <p className="text-4xl font-black text-neon-green mb-1">98%</p>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">KEPUASAN PELANGGAN</p>
            </div>
            <div>
              <p className="text-4xl font-black text-neon-green mb-1">&lt; 1 Menit</p>
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">RATA-RATA PENGIRIMAN</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-32 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Zap, title: "Pengiriman Instan", desc: "Key dikirim otomatis ke email kamu dalam hitungan detik setelah pembayaran dikonfirmasi." },
            { icon: ShieldCheck, title: "Aman & Terpercaya", desc: "Semua key original dan bergaransi. Anti-ban protection untuk keamanan akun kamu." },
            { icon: Clock, title: "Support 24/7", desc: "Tim kami siap membantu kamu kapanpun via WhatsApp. Respon cepat dalam 5 menit." }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-morphism p-8 rounded-3xl border-white/5 flex gap-6 hover:border-neon-green/20 transition-all group"
            >
              <div className="w-14 h-14 bg-neon-green/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <feature.icon className="text-neon-green" size={28} />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Cara Belanja Section */}
      <section className="py-24 bg-white/5 border-y border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-red/5 to-transparent"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">CARA <span className="text-neon-green">BELANJA</span></h2>
            <p className="text-white/40 text-sm max-w-xl mx-auto">Ikuti langkah mudah di bawah ini untuk mendapatkan key produk favorit Anda dalam hitungan menit.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Login & Akun", desc: "Login menggunakan akun Google untuk keamanan transaksi." },
              { step: "02", title: "Top Up / Isi Saldo", desc: "Isi saldo via QRIS/Transfer untuk transaksi otomatis instan 1 detik." },
              { step: "03", title: "Pilih Produk", desc: "Pilih durasi atau paket produk yang Anda inginkan di marketplace." },
              { step: "04", title: "Key Terkirim", desc: "Key akan otomatis tampil di layar dan dikirim ke email Anda." }
            ].map((s, i) => (
              <div key={i} className="relative group">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-2xl font-black text-neon-green group-hover:border-neon-green transition-all shadow-xl">
                    {s.step}
                  </div>
                  <h3 className="text-lg font-bold mb-3">{s.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{s.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[70%] w-full h-[2px] bg-gradient-to-r from-neon-green/20 to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section id="products" className="py-12 container mx-auto px-4">
        <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
            <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter">Marketplace</h2>
                <div className="h-1.5 w-20 bg-brand-red mt-2 rounded-full"></div>
            </div>
            
            <div className="flex-1 overflow-x-auto p-1.5 bg-white/5 rounded-2xl gap-2 flex min-w-0">
                {[
                    { id: 'all', label: 'Semua', icon: ShoppingCart },
                    { id: 'owner', label: 'Market Utama', icon: Trophy },
                    { id: 'partner', label: 'Toko Partner', icon: Store }
                ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setActiveMarket(m.id as any)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                            activeMarket === m.id ? 'bg-neon-green text-black' : 'text-white/40 hover:text-white'
                        }`}
                    >
                        <m.icon size={14} /> {m.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full flex flex-col items-center py-20">
              <Loader2 className="animate-spin text-neon-green mb-4" size={40} />
              <p className="text-white/40">Memuat produk...</p>
            </div>
          ) : filteredProducts.length > 0 ? filteredProducts.map((p) => {
            const productStock = keys.filter(k => k.productId === p.id && k.status === 'available').length;
            const isPartnerProd = p.sellerType === 'partner';
            const sellerName = isPartnerProd ? (sellerNames[p.sellerId || ''] || 'Partner Store') : 'FISEN OWNER';
            
            const prodReviews = reviews.filter(r => r.productId === p.id);
            const avgRating = prodReviews.length > 0 ? prodReviews.reduce((acc, r) => acc + r.rating, 0) / prodReviews.length : 0;

            return (
              <motion.div 
                key={p.id}
                whileHover={{ y: -8 }}
                onClick={() => setSelectedProduct(p)}
                className="glass-morphism rounded-3xl overflow-hidden group border-white/5 hover:border-neon-green/50 transition-all duration-300 cursor-pointer flex flex-col h-full"
              >
                <div className="h-44 overflow-hidden relative">
                  <img src={p.image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80"} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 to-transparent"></div>
                  
                  {p.discountPercentage && p.discountPercentage > 0 && (
                      <div className="absolute top-4 left-4 bg-neon-green text-black text-[10px] font-black px-2 py-1 rounded-md transform -rotate-12 shadow-xl border border-white/20">
                          SAVE {p.discountPercentage}%
                      </div>
                  )}

                  {avgRating > 0 && (
                      <div className="absolute top-16 left-4 flex gap-1">
                        {[...Array(5)].map((_, i) => (
                           <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < Math.floor(avgRating) ? 'bg-neon-green' : 'bg-white/20'}`} />
                        ))}
                      </div>
                  )}

                  <div className="absolute top-4 right-4">
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase backdrop-blur-md border ${
                        productStock > 0 ? 'bg-green-500/20 text-green-500 border-green-500/20' : 'bg-red-500/20 text-red-500 border-red-500/20'
                    }`}>
                        {productStock > 0 ? `Stock: ${productStock}` : 'Habis'}
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 flex flex-col gap-1">
                    <span className="bg-white text-black font-black text-[9px] px-2 py-0.5 rounded-md uppercase w-fit">
                      Free Fire
                    </span>
                    <div className={`flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase w-fit ${
                        isPartnerProd ? 'bg-neon-green text-black' : 'bg-neon-blue text-black'
                    }`}>
                        {isPartnerProd ? <Store size={10} /> : <Trophy size={10} />}
                        {sellerName}
                    </div>
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-lg font-bold mb-2 group-hover:text-neon-green transition-colors line-clamp-1">{p.name}</h3>
                  <p className="text-white/40 text-xs mb-6 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                  
                  <div className="mt-auto flex items-center justify-between">
                    <div className="text-white">
                      {p.originalPrice && p.originalPrice > p.price ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-white/40 line-through">Rp {p.originalPrice.toLocaleString('id-ID')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white">Rp {p.price.toLocaleString('id-ID')}</span>
                            {p.discountPercentage && (
                                <span className="bg-neon-green/20 text-neon-green text-[8px] font-black px-1.5 py-0.5 rounded">-{p.discountPercentage}%</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xl font-black">Rp {p.price.toLocaleString('id-ID')}</span>
                      )}
                    </div>
                    <button className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-neon-green hover:text-black transition-all group-hover:scale-105 active:scale-95 shadow-lg shadow-white/0 hover:shadow-neon-green/20">
                      <ShoppingCart size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          }) : (
            <div className="col-span-full text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
              <p className="text-white/20 uppercase tracking-widest font-black">Belum ada produk untuk kategori ini.</p>
            </div>
          )}
        </div>
      </section>

      {/* Payment Proof / Branding */}
      <section className="py-24 relative overflow-hidden text-center">
        <div className="container mx-auto px-4">
            <div className="text-center">
                <h2 className="text-4xl font-black mb-12 uppercase tracking-tighter">KEPERCAYAAN <span className="text-neon-green italic">ANDA</span> ADALAH PRIORITAS KAMI</h2>
                <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale hover:grayscale-0 transition-all">
                    <div className="font-black text-xl italic tracking-tighter">QRIS</div>
                    <div className="font-black text-xl italic tracking-tighter">DANA</div>
                    <div className="font-black text-xl italic tracking-tighter">OVO</div>
                    <div className="font-black text-xl italic tracking-tighter">SHOPEEPAY</div>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}
