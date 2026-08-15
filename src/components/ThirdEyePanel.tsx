import React, { useState } from "react";
import { Eye, ShieldAlert, CheckCircle2, X, Sliders, RefreshCw, AlertCircle } from "lucide-react";
import { RejectionEntry } from "../types";

interface ThirdEyePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThirdEyePanel: React.FC<ThirdEyePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [garbleThreshold, setGarbleThreshold] = useState<number>(65);
  const [alertMode, setAlertMode] = useState<boolean>(false);
  const [testHeadline, setTestHeadline] = useState<string>("BREAKING: Global Financial Index Update #2026");
  const [testResult, setTestResult] = useState<{ accepted: boolean; reason?: string; score?: number } | null>(null);

  const [rejections, setRejections] = useState<RejectionEntry[]>([
    { title: "S33k_Sp@m_Headline!!!---", reason: "THRESHOLD", score: 42, rejectedAt: new Date().toISOString() },
    { title: "Buy Cheap Software Click Here", reason: "BLACKLIST", rejectedAt: new Date().toISOString() },
    { title: "Duplicate Feed Item Stream 102", reason: "DUPLICATE", rejectedAt: new Date().toISOString() },
  ]);

  if (!isOpen) return null;

  const handleTestHeadline = () => {
    if (!testHeadline) return;
    const alphanumCount = (testHeadline.match(/[a-z0-9\s\:\!\?\-\.]/gi) || []).length;
    const score = Math.round((alphanumCount / testHeadline.length) * 100);

    let accepted = true;
    let reason: any = undefined;

    if (alertMode) {
      const whitelist = ["BREAKING", "URGENT", "ALERT", "FLASH", "UPDATE"];
      const upper = testHeadline.toUpperCase();
      if (!whitelist.some(kw => upper.includes(kw))) {
        accepted = false;
        reason = "ALERT_MODE";
      }
    }

    if (accepted && score < garbleThreshold) {
      accepted = false;
      reason = "THRESHOLD";
    }

    setTestResult({ accepted, reason, score });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass border border-white/10 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#05070A] text-white/40 hover:text-white cursor-pointer border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">ThirdEye Signal Processing Inspector</h2>
            <p className="text-xs text-white/50">Garble ratio scoring, alert mode whitelist bypass, and duplicate filtering.</p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#05070A] p-4 rounded-2xl border border-white/10 text-xs font-mono">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-white font-bold">Garble Score Threshold</span>
              <span className="text-cyan-400 font-bold">{garbleThreshold}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={95}
              value={garbleThreshold}
              onChange={(e) => setGarbleThreshold(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-[#0D121D] border border-white/10">
            <div>
              <div className="text-white font-bold">Alert Mode</div>
              <div className="text-[10px] text-white/40">Only allow Whitelist Headlines</div>
            </div>
            <button
              onClick={() => setAlertMode(!alertMode)}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                alertMode ? "bg-amber-500 text-black" : "bg-[#05070A] text-white/40 border border-white/10"
              }`}
            >
              {alertMode ? "ALERT ON" : "NORMAL"}
            </button>
          </div>
        </div>

        {/* TEST HEADLINE INSPECTOR */}
        <div className="space-y-2 font-mono">
          <label className="text-xs text-white/40">Test Signal Headline Processing</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={testHeadline}
              onChange={(e) => setTestHeadline(e.target.value)}
              className="flex-1 bg-[#05070A] border border-white/10 text-xs text-white p-2.5 rounded-xl outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleTestHeadline}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Test Signal
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              testResult.accepted
                ? "bg-[#00FF9D]/10 border-[#00FF9D]/30 text-[#00FF9D]"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              <span>Status: {testResult.accepted ? "✓ ACCEPTED" : `✗ REJECTED (${testResult.reason})`}</span>
              <span>Score: {testResult.score}/100</span>
            </div>
          )}
        </div>

        {/* REJECTION LOG BUFFER TABLE */}
        <div className="space-y-2 font-mono">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/50">Recent Rejection Log Buffer</h3>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {rejections.map((r, i) => (
              <div key={i} className="p-2 rounded-xl bg-[#05070A] border border-white/10 text-[11px] flex items-center justify-between text-white/50">
                <span className="truncate max-w-xs text-white">{r.title}</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                  {r.reason} {r.score ? `(${r.score}%)` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
