import React, { useMemo, useState } from 'react';
import { Download, X, FileText, Image as ImageIcon, Check, AlertCircle, Layers } from 'lucide-react';
import { Novel, Chapter, User } from '../types';
import { BerryDatabase } from '../data';

interface DownloadNovelDialogProps {
  novel: Novel;
  chapters: Chapter[]; // Published chapters, visible to the current user
  currentUser: User;
  isOwner: boolean;
  onClose: () => void;
  onDownloadAllowedChange?: (allowed: boolean) => void;
}

type ExportFormat = 'png' | 'jpg' | 'txt';

// Content is stored as plain text with \n\n paragraphs plus a few inline
// markers. Split it into text/image segments so images can be drawn on the
// exported pages instead of leaking their raw base64 into the text.
type Segment = { type: 'text'; value: string } | { type: 'image'; src: string };

const IMG_MARKERS = /<img\s+src="([^"]+)"\s*\/?>|\(PNG,\s*JPG:\s*([^\s)]+)\)/gi;

function parseContent(raw: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const cleanText = (t: string) => t.replace(/<\/?(b|i|u)>/gi, '');
  raw.replace(IMG_MARKERS, (match, src1, src2, offset) => {
    const before = raw.slice(lastIndex, offset).trim();
    if (before) segments.push({ type: 'text', value: cleanText(before) });
    const src = (src1 || src2 || '').trim();
    const v = src.toLowerCase();
    if (v.startsWith('data:image/') || v.startsWith('https://') || v.startsWith('http://') || v.startsWith('/')) {
      segments.push({ type: 'image', src });
    }
    lastIndex = offset + match.length;
    return match;
  });
  const tail = raw.slice(lastIndex).trim();
  if (tail) segments.push({ type: 'text', value: cleanText(tail) });
  return segments;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    // Remote covers/images need CORS approval to stay canvas-exportable;
    // if the host refuses, we skip the image rather than fail the export.
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Some browsers (observed in Chromium) silently replace a download filename
// that contains Arabic characters with the generic name "download". Build
// filenames from ASCII-safe parts only so every file keeps a real name.
function safeFileBase(novel: Novel): string {
  const en = (novel.titleEn || '').replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
  if (en) return en;
  const id = (novel.id || '').replace(/[^A-Za-z0-9_-]/g, '');
  return id ? `novel-${id}` : 'novel';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function DownloadNovelDialog({
  novel,
  chapters,
  currentUser,
  isOwner,
  onClose,
  onDownloadAllowedChange
}: DownloadNovelDialogProps) {
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.number - b.number),
    [chapters]
  );

  const [format, setFormat] = useState<ExportFormat>('png');
  const [fromChapter, setFromChapter] = useState(1);
  const [toChapter, setToChapter] = useState(sortedChapters.length || 1);
  const [imageWidth, setImageWidth] = useState(1080);
  const [customWidth, setCustomWidth] = useState('');
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [allowMembers, setAllowMembers] = useState(novel.downloadAllowed !== false);

  const downloadBlocked = !isOwner && novel.downloadAllowed === false;

  const selectedChapters = useMemo(() => {
    const from = Math.max(1, Math.min(fromChapter, toChapter));
    const to = Math.max(from, toChapter);
    // Select by position in the ordered list (1-based), so gaps in chapter
    // numbering can't silently drop chapters from the export.
    return sortedChapters.slice(from - 1, to);
  }, [sortedChapters, fromChapter, toChapter]);

  const effectiveWidth = () => {
    const custom = parseInt(customWidth, 10);
    if (!Number.isNaN(custom) && custom >= 320 && custom <= 4096) return custom;
    return imageWidth;
  };

  const handleToggleAllowMembers = () => {
    const next = !allowMembers;
    setAllowMembers(next);
    const allNovels = BerryDatabase.get<Novel[]>('novels', []);
    const updated = allNovels.map((n) => (n.id === novel.id ? { ...n, downloadAllowed: next } : n));
    BerryDatabase.set('novels', updated);
    onDownloadAllowedChange?.(next);
  };

  const exportTxt = () => {
    const lines: string[] = [];
    lines.push(`${novel.titleAr}${novel.titleEn ? ` (${novel.titleEn})` : ''}`);
    lines.push(`المؤلف: ${novel.author || 'غير معروف'} | المترجم: ${novel.translatorName || '—'}`);
    lines.push(`تم التنزيل من منصة بيري ميست 🍇`);
    lines.push('');
    for (const chap of selectedChapters) {
      lines.push('━'.repeat(30));
      lines.push(`الفصل ${chap.number}: ${chap.title}`);
      lines.push('━'.repeat(30));
      for (const seg of parseContent(chap.content)) {
        lines.push(seg.type === 'text' ? seg.value : '[صورة مضمّنة]');
      }
      lines.push('');
    }
    // BOM keeps Arabic readable when opened in Windows Notepad
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `${safeFileBase(novel)}-ch${fromChapter}-${toChapter}.txt`);
  };

  const exportImages = async () => {
    const W = effectiveWidth();
    const pad = Math.round(W * 0.055);
    const fontSize = Math.max(14, Math.round(W / 30));
    const lineHeight = Math.round(fontSize * 1.9);
    const pageH = Math.round(W * 1.5);
    const fontFamily = `'Tajawal', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif`;
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    let fileCounter = 0;
    for (let ci = 0; ci < selectedChapters.length; ci++) {
      const chap = selectedChapters[ci];
      setProgress(`جارٍ تجهيز الفصل ${chap.number} (${ci + 1} من ${selectedChapters.length})…`);

      const segments = parseContent(chap.content);

      // Preload the chapter's embedded images before layout
      const images = new Map<string, HTMLImageElement | null>();
      for (const seg of segments) {
        if (seg.type === 'image' && !images.has(seg.src)) {
          images.set(seg.src, await loadImage(seg.src));
        }
      }

      let canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = pageH;
      let ctx = canvas.getContext('2d')!;
      let page = 1;
      let y = pad;
      const pages: HTMLCanvasElement[] = [];

      const paintBackground = (c: CanvasRenderingContext2D) => {
        c.fillStyle = '#14101E';
        c.fillRect(0, 0, W, pageH);
        c.fillStyle = '#B9A6E8';
      };

      const finishPage = () => {
        // Footer: page number + site credit
        ctx.font = `${Math.round(fontSize * 0.7)}px ${fontFamily}`;
        ctx.fillStyle = '#7C6BA8';
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        ctx.fillText(`بيري ميست 🍇 — ${novel.titleAr} — صفحة ${page}`, W / 2, pageH - Math.round(pad / 2.5));
        pages.push(canvas);
      };

      const newPage = () => {
        finishPage();
        page++;
        canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = pageH;
        ctx = canvas.getContext('2d')!;
        paintBackground(ctx);
        y = pad;
      };

      paintBackground(ctx);

      // Chapter header
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.font = `bold ${Math.round(fontSize * 1.25)}px ${fontFamily}`;
      ctx.fillStyle = '#E8DEFF';
      ctx.fillText(novel.titleAr, W - pad, y + fontSize);
      y += Math.round(lineHeight * 1.2);
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = '#A78BFA';
      ctx.fillText(`الفصل ${chap.number}: ${chap.title}`, W - pad, y + fontSize);
      y += lineHeight;
      ctx.strokeStyle = 'rgba(167,139,250,0.35)';
      ctx.beginPath();
      ctx.moveTo(pad, y + 6);
      ctx.lineTo(W - pad, y + 6);
      ctx.stroke();
      y += Math.round(lineHeight * 0.8);

      const writeParagraph = (text: string) => {
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#D6C9F5';
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        const maxWidth = W - pad * 2;
        for (const para of text.split(/\n+/)) {
          const words = para.trim().split(/\s+/).filter(Boolean);
          if (words.length === 0) continue;
          let line = '';
          for (const word of words) {
            const attempt = line ? `${line} ${word}` : word;
            if (ctx.measureText(attempt).width > maxWidth && line) {
              if (y + lineHeight > pageH - pad * 1.5) newPage();
              ctx.font = `${fontSize}px ${fontFamily}`;
              ctx.fillStyle = '#D6C9F5';
              ctx.fillText(line, W - pad, y + fontSize);
              y += lineHeight;
              line = word;
            } else {
              line = attempt;
            }
          }
          if (line) {
            if (y + lineHeight > pageH - pad * 1.5) newPage();
            ctx.font = `${fontSize}px ${fontFamily}`;
            ctx.fillStyle = '#D6C9F5';
            ctx.fillText(line, W - pad, y + fontSize);
            y += lineHeight;
          }
          y += Math.round(lineHeight * 0.45); // paragraph gap
        }
      };

      const drawImage = (img: HTMLImageElement) => {
        const maxW = W - pad * 2;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const drawW = Math.round(img.naturalWidth * scale);
        let drawH = Math.round(img.naturalHeight * scale);
        const maxH = pageH - pad * 3;
        if (drawH > maxH) drawH = maxH;
        if (y + drawH > pageH - pad * 1.5) newPage();
        try {
          ctx.drawImage(img, Math.round((W - drawW) / 2), y, drawW, drawH);
          y += drawH + Math.round(lineHeight * 0.6);
        } catch {
          writeParagraph('[تعذر تضمين صورة]');
        }
      };

      for (const seg of segments) {
        if (seg.type === 'text') {
          writeParagraph(seg.value);
        } else {
          const img = images.get(seg.src);
          if (img) drawImage(img);
          else writeParagraph('[صورة غير متاحة]');
        }
      }
      finishPage();

      for (let p = 0; p < pages.length; p++) {
        setProgress(`جارٍ تنزيل الفصل ${chap.number} — صفحة ${p + 1} من ${pages.length}…`);
        const blob = await new Promise<Blob | null>((resolve) =>
          pages[p].toBlob(resolve, mime, format === 'jpg' ? quality : undefined)
        );
        if (blob) {
          const pageSuffix = pages.length > 1 ? `-p${p + 1}` : '';
          triggerDownload(blob, `${safeFileBase(novel)}-ch${chap.number}${pageSuffix}.${ext}`);
          fileCounter++;
          // Small gap so the browser accepts a burst of downloads
          await sleep(350);
        }
      }
    }
    return fileCounter;
  };

  const handleDownload = async () => {
    setError('');
    setDone(false);

    if (currentUser.role === 'GUEST') {
      window.dispatchEvent(new Event('open-login-modal'));
      return;
    }
    if (downloadBlocked) return;
    if (selectedChapters.length === 0) {
      setError('لا توجد فصول ضمن النطاق المحدد.');
      return;
    }

    setBusy(true);
    try {
      if (format === 'txt') {
        exportTxt();
      } else {
        await exportImages();
      }
      setProgress('');
      setDone(true);
    } catch (e) {
      console.error('Novel export failed:', e);
      setError('حدث خطأ أثناء إنشاء الملفات. جرب نطاقاً أصغر أو حجماً أقل.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#17121F] border border-violet-500/20 rounded-3xl p-6 text-right shadow-2xl shadow-violet-500/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 cursor-pointer">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-white">تنزيل الرواية 📥</h3>
            <div className="p-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl">
              <Download size={18} />
            </div>
          </div>
        </div>

        <p className="text-xs text-purple-300 mb-4 leading-relaxed">
          {novel.titleAr} — {sortedChapters.length} فصل متاح
        </p>

        {downloadBlocked ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>عذراً، مالك المنصة عطّل تنزيل هذه الرواية حالياً.</span>
          </div>
        ) : (
          <>
            {/* Format selection */}
            <label className="block text-[11px] font-bold text-purple-200 mb-2">صيغة التنزيل</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                { id: 'png' as const, label: 'PNG صور', icon: <ImageIcon size={14} /> },
                { id: 'jpg' as const, label: 'JPG صور', icon: <ImageIcon size={14} /> },
                { id: 'txt' as const, label: 'TXT نصي', icon: <FileText size={14} /> }
              ]).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    format === f.id
                      ? 'bg-violet-600/25 border-violet-500/50 text-violet-200'
                      : 'bg-white/5 border-white/10 text-purple-300 hover:bg-white/10'
                  }`}
                >
                  {f.icon}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Chapter range */}
            <label className="block text-[11px] font-bold text-purple-200 mb-2">
              <Layers size={12} className="inline ml-1" />
              نطاق الفصول (اختر أي عدد تريده)
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <span className="text-[10px] text-purple-400 block mb-1">من الفصل</span>
                <input
                  type="number"
                  min={1}
                  max={sortedChapters.length}
                  value={fromChapter}
                  onChange={(e) => setFromChapter(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#0F0C17] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-center focus:border-violet-500/50 outline-none"
                />
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-purple-400 block mb-1">إلى الفصل</span>
                <input
                  type="number"
                  min={1}
                  max={sortedChapters.length}
                  value={toChapter}
                  onChange={(e) => setToChapter(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#0F0C17] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-center focus:border-violet-500/50 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => { setFromChapter(1); setToChapter(sortedChapters.length || 1); }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-purple-300 cursor-pointer"
              >
                كل الفصول ({sortedChapters.length})
              </button>
              <button
                onClick={() => { setFromChapter(1); setToChapter(Math.min(10, sortedChapters.length || 1)); }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-purple-300 cursor-pointer"
              >
                أول 10 فصول
              </button>
              <span className="px-3 py-1.5 text-[10px] text-violet-300 font-bold">{selectedChapters.length} فصل محدد</span>
            </div>

            {/* Image size (PNG/JPG only) */}
            {format !== 'txt' && (
              <>
                <label className="block text-[11px] font-bold text-purple-200 mb-2">حجم الصورة (العرض بالبكسل — أي حجم تريده)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[720, 1080, 1440, 2160].map((w) => (
                    <button
                      key={w}
                      onClick={() => { setImageWidth(w); setCustomWidth(''); }}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                        imageWidth === w && !customWidth
                          ? 'bg-violet-600/25 border-violet-500/50 text-violet-200'
                          : 'bg-white/5 border-white/10 text-purple-300 hover:bg-white/10'
                      }`}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="أو أدخل عرضاً مخصصاً (320 - 4096)"
                  value={customWidth}
                  min={320}
                  max={4096}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="w-full bg-[#0F0C17] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-center focus:border-violet-500/50 outline-none mb-4"
                />
              </>
            )}

            {/* JPG quality */}
            {format === 'jpg' && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-purple-200 mb-2">
                  جودة JPG: {Math.round(quality * 100)}%
                </label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(parseInt(e.target.value, 10) / 100)}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* Owner: allow/deny member downloads for this novel */}
            {isOwner && (
              <button
                onClick={handleToggleAllowMembers}
                className={`w-full mb-4 px-4 py-3 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-between ${
                  allowMembers
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                <span>{allowMembers ? 'مفعّل ✓' : 'معطّل ✗'}</span>
                <span>السماح للأعضاء بتنزيل هذه الرواية (صلاحية المالك)</span>
              </button>
            )}

            {/* Status */}
            {busy && (
              <div className="mb-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-300 text-[11px] text-center animate-pulse">
                {progress || 'جارٍ التحضير…'}
              </div>
            )}
            {done && !busy && (
              <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] text-center flex items-center justify-center gap-1.5">
                <Check size={14} />
                <span>اكتمل التنزيل بنجاح! تحقق من مجلد التنزيلات لديك 🎉</span>
              </div>
            )}
            {error && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-[11px] text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleDownload}
              disabled={busy || sortedChapters.length === 0}
              className={`w-full py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
                busy || sortedChapters.length === 0
                  ? 'bg-white/10 text-purple-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/15 cursor-pointer'
              }`}
            >
              <Download size={16} />
              <span>
                {sortedChapters.length === 0
                  ? 'لا توجد فصول متاحة للتنزيل بعد'
                  : `تنزيل ${selectedChapters.length} فصل بصيغة ${format.toUpperCase()}`}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
