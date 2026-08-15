import React, { useState } from "react";
import { ShieldCheck, Lock, Unlock, X, KeyRound, AlertCircle } from "lucide-react";

interface PinShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinUnlocked: boolean;
  onUnlockSuccess: () => void;
  onLockPin: () => void;
}

export const PinShieldModal: React.FC<PinShieldModalProps> = ({
  isOpen,
  onClose,
  pinUnlocked,
  onUnlockSuccess,
  onLockPin,
}) => {
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [errorMsg, setErrorCircle] = useState<string>("");

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === "1234" || enteredPin === "0000") {
      onUnlockSuccess();
      setEnteredPin("");
      setErrorCircle("");
      onClose();
    } else {
      setErrorCircle("Incorrect PIN code. Default PIN is '1234'.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass border border-white/10 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#05070A] text-white/40 hover:text-white cursor-pointer border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            {pinUnlocked ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Parental Control PIN Shield</h2>
          <p className="text-xs text-white/50">
            {pinUnlocked
              ? "Restricted vault categories are currently UNLOCKED."
              : "Enter master 4-digit PIN to access restricted stream categories."}
          </p>
        </div>

        {pinUnlocked ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#00FF9D]/10 border border-[#00FF9D]/30 text-[#00FF9D] text-xs font-mono text-center">
              ✓ Shield Active: PIN Verified (Default: 1234)
            </div>
            <button
              onClick={() => {
                onLockPin();
                onClose();
              }}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold text-xs rounded-xl shadow-lg cursor-pointer"
            >
              Re-Lock PIN Shield
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-white/40">Master PIN (Default: 1234)</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full bg-[#05070A] border border-white/10 focus:border-[#0088FF] text-center tracking-[1em] text-lg font-mono rounded-xl pl-9 pr-4 py-2.5 text-white outline-none"
                  autoFocus
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#0088FF] hover:bg-[#006CD0] text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-[#0088FF]/30 cursor-pointer"
            >
              Verify PIN Code
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
