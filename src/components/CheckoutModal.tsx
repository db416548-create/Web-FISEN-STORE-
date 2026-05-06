import { useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, CheckCircle, Mail, AlertCircle, Loader2, MessageSquare, CreditCard, Landmark, Globe, Wallet } from 'lucide-react';
import { Product, Transaction as TransactionType, GameKey, UserProfile } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, runTransaction, doc, query, where, limit, getDocs, getDoc } from 'firebase/firestore';

interface CheckoutModalProps {
  product: Product | null;
  onClose: () => void;
}

export const CheckoutModal = ({ product, onClose }: CheckoutModalProps) => {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [step, setStep] = useState<'info' | 'payment' | 'processing' | 'success' | 'error'>('info');
  const [method, setMethod] = useState<'qris' | 'bank' | 'malaysia' | 'wallet'>('qris');
  const [deliveredKey, setDeliveredKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [isVerifyingProof, setIsVerifyingProof] = useState(false);

  const OWNER_EMAIL = 'mayfisenchristmaabuat@gmail.com';
  const isBuyerOwner = auth.currentUser?.email === OWNER_EMAIL;

  useEffect(() => {
    if (auth.currentUser) {
        setEmail(auth.currentUser.email || '');
        getDoc(doc(db, 'users', auth.currentUser.uid)).then(s => {
            if (s.exists()) {
                const data = s.data() as UserProfile;
                setUserProfile(data);
                if (data.whatsapp) setWhatsapp(data.whatsapp);
            }
        });
    }
  }, []);

  useEffect(() => {
    if (product?.sellerType === 'partner' && product.sellerId) {
        getDoc(doc(db, 'users', product.sellerId)).then(s => {
            if (s.exists()) {
                setSellerProfile(s.data() as UserProfile);
            }
        });
    } else {
        setSellerProfile(null);
    }
  }, [product]);

  useEffect(() => {
    let timer: any;
    if (step === 'payment' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && step === 'payment') {
      setErrorMessage('Waktu pembayaran habis (5 menit). Silakan ulangi pesanan.');
      setStep('error');
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  if (!product) return null;

  const handleWhatsAppDelivery = () => {
    const text = `Halo, saya telah membeli ${product.name}. Email: ${email}. WA: ${whatsapp}. Key: ${deliveredKey}`;
    const waNumber = product.sellerType === 'partner' ? (sellerProfile?.whatsapp || '082211243753') : '082211243753';
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPaymentProof(e.target.files[0]);
    }
  };

  const discountedPrice = product.discount && product.discount > 0 
    ? product.price * (1 - product.discount / 100) 
    : product.price;

  const handleCheckout = async () => {
    setStep('processing');
    try {
      // 1. Find available key for this product
      const q = query(collection(db, 'keys'), where('productId', '==', product.id), where('status', '==', 'available'), limit(1));
      const keySnap = await getDocs(q);
      
      if (keySnap.empty) {
        setErrorMessage('Stok key untuk produk ini habis! Silakan hubungi admin/penjual.');
        setStep('error');
        return;
      }

      const keyDoc = keySnap.docs[0];
      const keyData = keyDoc.data() as GameKey;

      // 2. Perform Atomic Transaction
      await runTransaction(db, async (transaction) => {
        if (method === 'wallet' && !isBuyerOwner) {
            if (!auth.currentUser) throw new Error('Harus login untuk pakai saldo');
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data() as UserProfile;
            
            if (userData.balance < discountedPrice) {
                throw new Error('Saldo tidak mencukupi');
            }
            
            transaction.update(userRef, { balance: userData.balance - discountedPrice });
        }

        // Mark key as sold
        transaction.update(keyDoc.ref, {
          status: 'sold',
          soldTo: email,
          soldToWA: whatsapp,
          soldAt: serverTimestamp()
        });

        // Create transaction record
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          productId: product.id,
          productName: product.name,
          amount: isBuyerOwner ? 0 : discountedPrice,
          customerEmail: email,
          customerWA: whatsapp,
          status: 'completed',
          keyDelivered: keyData.key,
          method: isBuyerOwner ? 'owner_gift' : method,
          sellerId: product.sellerId || 'owner',
          sellerType: product.sellerType || 'owner',
          createdAt: serverTimestamp()
        });
      });

      setDeliveredKey(keyData.key);
      setStep('success');
    } catch (e: any) {
      if (e.message === 'Saldo tidak mencukupi') {
          setErrorMessage('Saldo anda tidak cukup! Silakan top up dulu.');
      } else {
          handleFirestoreError(e, OperationType.WRITE, 'checkout/transaction');
          setErrorMessage('Terjadi kesalahan sistem. Silakan coba lagi nanti.');
      }
      setStep('error');
    }
  };

  const handleNext = async () => {
    if (step === 'info' && email) setStep('payment');
    else if (step === 'payment') {
      if (method !== 'wallet' && !paymentProof) {
        alert('Silakan upload bukti pembayaran (Screenshot) terlebih dahulu untuk verifikasi otomatis.');
        return;
      }
      
      if (method !== 'wallet') {
        setIsVerifyingProof(true);
        setStep('processing');
        // Simulated AI Verification of Screenshot
        await new Promise(resolve => setTimeout(resolve, 3000));
        setIsVerifyingProof(false);
      }
      
      handleCheckout();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative glass-morphism w-full max-w-lg rounded-3xl p-8 border-neon-green/20 shadow-2xl overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-neon-green shadow-[0_0_20px_rgba(0,255,85,0.8)]"></div>

        {step === 'info' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-2xl font-black mb-2 uppercase">Order Info</h3>
            <p className="text-white/60 text-sm mb-6">Key akan otomatis dikirim ke email & dapat dishare ke WA.</p>
            
            <div className="bg-white/5 p-4 rounded-2xl mb-6">
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="text-white/40">Produk</span>
                <span className="font-bold">{product.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40">Total</span>
                {product.discount ? (
                  <div className="text-right">
                    <p className="text-[10px] text-white/40 line-through">Rp {product.price.toLocaleString('id-ID')}</p>
                    <p className="text-xl font-black text-neon-green">Rp {discountedPrice.toLocaleString('id-ID')}</p>
                  </div>
                ) : (
                  <span className="text-xl font-black text-neon-green">Rp {product.price.toLocaleString('id-ID')}</span>
                )}
              </div>
            </div>

            <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Penerima Pesanan</label>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-[8px] text-white/20 uppercase mb-1">Email</label>
                    <input 
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-neon-green transition-colors font-mono"
                    />
                </div>
                <div>
                    <label className="block text-[8px] text-white/20 uppercase mb-1">WhatsApp</label>
                    <input 
                    type="tel"
                    placeholder="08..."
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-neon-green transition-colors font-mono"
                    />
                </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Pilih Metode Pembayaran</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <button onClick={() => setMethod('qris')} className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${method === 'qris' ? 'border-neon-green bg-neon-green/10' : 'border-white/10 bg-white/5 opacity-60'}`}>
                    <CreditCard size={20} className={method === 'qris' ? 'text-neon-green' : 'text-white/20'} />
                    <div className="text-left">
                        <p className="text-xs font-bold">QRIS Indo</p>
                        <p className="text-[9px] opacity-50">E-Wallet / Bank</p>
                    </div>
                </button>
                <button onClick={() => setMethod('wallet')} disabled={!userProfile} className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${method === 'wallet' ? 'border-neon-green bg-neon-green/10' : 'border-white/10 bg-white/5 opacity-60 disabled:opacity-20'}`}>
                    <Wallet size={20} className={method === 'wallet' ? 'text-neon-green' : 'text-white/20'} />
                    <div className="text-left">
                        <p className="text-xs font-bold">Pakai Saldo</p>
                        <p className="text-[9px] opacity-50">Rp {userProfile?.balance?.toLocaleString('id-ID') || 0}</p>
                    </div>
                </button>
                <button onClick={() => setMethod('bank')} className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${method === 'bank' ? 'border-neon-green bg-neon-green/10' : 'border-white/10 bg-white/5 opacity-60'}`}>
                    <Landmark size={20} className={method === 'bank' ? 'text-neon-green' : 'text-white/20'} />
                    <div className="text-left">
                        <p className="text-xs font-bold">Mandiri</p>
                        <p className="text-[9px] opacity-50">1860010564991</p>
                    </div>
                </button>
                <button onClick={() => setMethod('malaysia')} className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${method === 'malaysia' ? 'border-neon-green bg-neon-green/10' : 'border-white/10 bg-white/5 opacity-60'}`}>
                    <Globe size={20} className={method === 'malaysia' ? 'text-neon-green' : 'text-white/20'} />
                    <div className="text-left">
                        <p className="text-xs font-bold">Malaysia</p>
                        <p className="text-[9px] opacity-50">DuitNow QR</p>
                    </div>
                </button>
            </div>

            <button 
              disabled={!email || !email.includes('@')}
              onClick={handleNext}
              className="w-full btn-primary disabled:opacity-50 disabled:scale-100"
            >
              Lanjutkan Ke Pembayaran
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black">PEMBAYARAN</h3>
                {method !== 'wallet' && (
                  <div className="px-3 py-1 bg-brand-red text-white text-xs font-black rounded-lg animate-pulse">
                     {formatTime(timeLeft)}
                  </div>
                )}
             </div>

              <div className="space-y-4 mb-8">
                {method === 'bank' ? (
                   <div className="p-6 rounded-2xl border border-neon-green/30 bg-neon-green/5">
                      <p className="text-xs text-white/40 uppercase mb-4">Transfer Ke Rekening Mandiri</p>
                      <p className="text-2xl font-black text-white mb-1">1860010564991</p>
                      <p className="text-sm opacity-60 mb-6">A.N FISEN STORE 555</p>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-white/60 mb-4">
                        Pesan: Produk akan dikirim OTOMATIS setelah Anda upload Screenshot di bawah.
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase block">Upload Bukti TF / Screenshot</label>
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="text-xs text-white/40 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neon-green/10 file:text-neon-green hover:file:bg-neon-green/20" />
                      </div>
                   </div>
                ) : method === 'wallet' ? (
                    <div className="p-6 rounded-2xl border border-neon-green/30 bg-neon-green/5 text-center">
                        <p className="text-xs text-white/40 uppercase mb-4">Konfirmasi Pembayaran Saldo</p>
                        <p className="text-lg font-bold mb-2 text-neon-green">Total Potong: Rp {isBuyerOwner ? 0 : discountedPrice.toLocaleString('id-ID')}</p>
                        <p className="text-sm text-white/60">Sisa Saldo Anda: {isBuyerOwner ? 'UNLIMITED' : `Rp ${((userProfile?.balance || 0) - discountedPrice >= 0 ? ((userProfile?.balance || 0) - discountedPrice).toLocaleString('id-ID') : 'Saldo Tidak Cukup')}`}</p>
                        <p className="text-[10px] text-neon-green font-bold mt-4 uppercase">⚡ INSTAN 1 DETIK</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 py-6 bg-white rounded-3xl shadow-inner">
                        <div className="w-64 h-80 bg-gray-50 flex items-center justify-center border-4 border-gray-100 overflow-hidden rounded-2xl relative">
                            <img 
                              src={sellerProfile?.partnerInfo?.paymentQR || "https://raw.githubusercontent.com/mayfisenchristmaabuat/assets/main/qr_payment.png"} 
                              alt="QRIS PAYMENT" 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=FISEN_STORE_PAYMENT';
                              }}
                            />
                        </div>
                        <div className="text-black text-center px-4 w-full">
                            <p className="font-black text-lg tracking-tighter italic mb-4">
                                {sellerProfile?.partnerInfo?.paymentMethodName || 'QRIS ALL PAY'}
                            </p>
                            <div className="space-y-2 text-left bg-gray-50 p-4 rounded-xl border border-gray-100 mb-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase block">Upload Bukti Bayar / Screenshot</label>
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-red/10 file:text-brand-red hover:file:bg-brand-red/20" />
                            </div>
                        </div>
                    </div>
                )}
             </div>

             <button 
              onClick={handleNext}
              className="w-full btn-primary"
            >
              Konfirmasi & Bayar
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-20 flex flex-col items-center text-center">
            <Loader2 className="animate-spin text-neon-green mb-6" size={48} />
            <h3 className="text-xl font-bold mb-2">
                {isVerifyingProof ? 'Memverifikasi Bukti Pembayaran...' : 'Memeriksa Transaksi...'}
            </h3>
            <p className="text-white/60 text-sm">
                {isVerifyingProof ? 'Sistem sedang memindai screenshot Anda. Mohon tunggu...' : 'Validasi sedang berlangsung.'}
            </p>
            {isVerifyingProof && (
                <div className="mt-4 px-4 py-1 bg-neon-green/10 text-neon-green text-[10px] font-bold rounded-full animate-pulse border border-neon-green/20">
                    AI VERIFICATION ACTIVE
                </div>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-3xl font-black mb-4 uppercase">BERHASIL!</h3>
            <p className="text-white/80 mb-4">Berikut adalah key anda:</p>
            
            <div className="bg-neon-green/10 border border-neon-green/20 p-4 rounded-xl font-mono text-neon-green text-lg break-all mb-6 relative group text-center">
                {deliveredKey}
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(deliveredKey);
                    alert('Key dicopy ke clipboard!');
                  }}
                  className="absolute top-2 right-2 p-1 text-[10px] bg-white/10 rounded uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Copy
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <button 
                    onClick={onClose}
                    className="bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold transition-all text-sm"
                >
                    Tutup
                </button>
                <button 
                    onClick={handleWhatsAppDelivery}
                    className="bg-[#25D366] hover:scale-105 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                >
                    <MessageSquare size={18} /> Share WA
                </button>
            </div>
            <p className="text-white/40 text-[10px]">Key juga dikirim otomatis ke email: {email}</p>
          </div>
        )}

        {step === 'error' && (
           <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            <h3 className="text-2xl font-black mb-4 uppercase">Gagal</h3>
            <p className="text-white/60 mb-8">{errorMessage}</p>
            <button 
              onClick={() => { setStep('info'); setTimeLeft(300); }}
              className="w-full btn-primary"
            >
              Ulangi Pesanan
            </button>
          </div>
        )}

        <button 
           onClick={onClose}
           className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
        >
          &times;
        </button>
      </motion.div>
    </div>
  );
};
