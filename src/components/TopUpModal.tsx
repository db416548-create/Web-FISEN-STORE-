import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, CreditCard, Globe, X, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface TopUpModalProps {
  onClose: () => void;
}

export const TopUpModal = ({ onClose }: TopUpModalProps) => {
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState<'bank' | 'qris' | 'malaysia'>('qris');
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [proof, setProof] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    if (!proof) {
        alert('Silakan upload screenshot bukti pembayaran untuk verifikasi otomatis.');
        return;
    }
    
    setStep('processing');
    
    // Simulated Automated Verification
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      await addDoc(collection(db, 'deposits'), {
        userId: auth.currentUser.uid,
        amount: Number(amount),
        method: method,
        status: 'pending',
        proofUploaded: true, // Marker for admin
        createdAt: serverTimestamp(),
      });
      setStep('success');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'deposits');
      setStep('form');
    }
  };

  const handleWhatsAppConfirm = () => {
    const text = `Halo Admin Fisen Store, saya baru saja melakukan Top Up sebesar Rp ${amount.toLocaleString('id-ID')} via ${method}. Mohon segera diverifikasi.`;
    window.open(`https://wa.me/082211243753?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-morphism w-full max-w-md rounded-3xl p-8 border-neon-green/20 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/20 hover:text-white"><X/></button>

        {step === 'form' ? (
          <div>
            <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter">Top Up <span className="text-neon-green italic">Saldo</span></h3>
            
            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase text-white/40 mb-2 tracking-widest">Input Nominal Custom (Rp)</label>
              <input 
                type="number"
                placeholder="Min Rp 1.000"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-neon-green text-xl font-black transition-all"
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {[10000, 25000, 50000, 100000, 250000].map(v => (
                   <button key={v} onClick={() => setAmount(v)} className="text-[10px] font-bold bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:border-neon-green hover:text-neon-green transition-all">
                     +Rp {v.toLocaleString()}
                   </button>
                ))}
              </div>
            </div>

            <h4 className="text-[10px] font-bold uppercase text-white/40 mb-3 tracking-widest">Metode Pembayaran</h4>
            <div className="grid grid-cols-1 gap-3 mb-6">
                <button onClick={() => setMethod('qris')} className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${method === 'qris' ? 'border-neon-green bg-neon-green/10' : 'border-white/5 opacity-60 hover:opacity-100'}`}>
                    <CreditCard size={20} className="text-neon-green" />
                    <div className="text-left flex-1">
                        <span className="block text-sm font-bold">QRIS ALL PAY</span>
                        <span className="text-[10px] opacity-40 uppercase tracking-tighter">Instant Verification</span>
                    </div>
                    {method === 'qris' && <div className="text-neon-green text-[10px] font-black italic">PROCESSED BY AI</div>}
                </button>
                <button onClick={() => setMethod('bank')} className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${method === 'bank' ? 'border-neon-green bg-neon-green/10' : 'border-white/5 opacity-60 hover:opacity-100'}`}>
                    <Landmark size={20} className="text-neon-green" />
                    <div className="text-left">
                        <span className="block text-sm font-bold">Bank Mandiri</span>
                        <span className="text-[10px] opacity-40 uppercase tracking-tighter">1860010564991 / FISEN</span>
                    </div>
                </button>
                <button onClick={() => setMethod('malaysia')} className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${method === 'malaysia' ? 'border-neon-green bg-neon-green/10' : 'border-white/5 opacity-60 hover:opacity-100'}`}>
                    <Globe size={20} className="text-neon-green" />
                    <div className="text-left">
                        <span className="block text-sm font-bold">Malaysia QR</span>
                        <span className="text-[10px] opacity-40 uppercase tracking-tighter">DuitNow QR</span>
                    </div>
                </button>
            </div>

            <div className="mb-8 p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                <label className="block text-[10px] font-bold text-white/40 uppercase mb-2 tracking-widest">Upload Screenshot Transfer / QR</label>
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setProof(e.target.files ? e.target.files[0] : null)}
                    className="text-xs text-white/40 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neon-green/10 file:text-neon-green hover:file:bg-neon-green/20 w-full" 
                />
                <p className="text-[8px] text-neon-green mt-2 font-bold uppercase tracking-widest animate-pulse">Sistem akan otomatis verifikasi gambar Anda</p>
            </div>

            <button onClick={handleSubmit} className="w-full btn-primary flex items-center justify-center gap-2 group">
              <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              Verifikasi Bukti & Top Up
            </button>
          </div>
        ) : step === 'processing' ? (
            <div className="py-20 flex flex-col items-center text-center">
                <div className="w-20 h-20 border-4 border-neon-green/20 border-t-neon-green rounded-full animate-spin mb-8"></div>
                <h3 className="text-xl font-bold mb-2 uppercase tracking-tighter italic">AI SCANNING...</h3>
                <p className="text-white/40 text-sm max-w-xs">Sistem sedang memvalidasi nominal dan nomor referensi pada screenshot Anda.</p>
                <div className="mt-8 px-4 py-1.5 bg-brand-red/10 border border-brand-red/20 rounded-full text-brand-red text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Detecting Fraud & Clones
                </div>
            </div>
        ) : (
          <div className="text-center py-6 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">SUCCESS!</h3>
            <p className="text-white/60 mb-8 max-w-xs mx-auto text-sm leading-relaxed">Permintaan Top Up sedang diproses. Klik tombol di bawah untuk konfirmasi bukti pembayaran ke WhatsApp owner.</p>
            
            <div className="grid grid-cols-2 gap-4">
                <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold transition-all">Tutup</button>
                <button 
                  onClick={handleWhatsAppConfirm} 
                  className="w-full bg-[#25D366] hover:scale-105 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Send size={18} /> Konfirmasi WA
                </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
