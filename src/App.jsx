import { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';

export default function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [uniqueNums, setUniqueNums] = useState([]);
  const [selectedNum, setSelectedNum] = useState(null);
  const [status, setStatus] = useState('Carica un\'immagine per iniziare');
  const [busy, setBusy] = useState(false);
  const [originalSize, setOriginalSize] = useState({ w: 0, h: 0 });
  const canvasRef = useRef(null);
  // Id dell'analisi in corso: i risultati di analisi superate vengono scartati
  const runIdRef = useRef(0);

  // Libera l'URL dell'immagine precedente quando ne viene caricata una nuova
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setNumbers([]);
    setUniqueNums([]);
    setSelectedNum(null);
    analyzeImage(url);
  };

  const analyzeImage = (url) => {
    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current;

    setBusy(true);
    setStatus('Preparazione filtro alto contrasto...');
    const img = new Image();
    img.onerror = () => {
      if (!isCurrent()) return;
      setStatus('Impossibile leggere l\'immagine.');
      setBusy(false);
    };
    img.onload = async () => {
      if (!isCurrent()) return;
      setOriginalSize({ w: img.naturalWidth, h: img.naturalHeight });
      const cvs = canvasRef.current;
      cvs.width = img.naturalWidth;
      cvs.height = img.naturalHeight;
      const ctx = cvs.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      // Filtro Bianco/Nero per eliminare le pieghe e far risaltare i numeri
      const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const threshold = lum > 140 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = threshold;
      }
      ctx.putImageData(imgData, 0, 0);

      setStatus('Avvio OCR (solo cifre)...');
      let worker;
      try {
        worker = await createWorker('eng', 1, {
          logger: m => {
            if (isCurrent() && m.status === 'recognizing text') {
              setStatus(`Analisi OCR: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        // La whitelist va impostata sul worker, non passata a recognize()
        await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
        const result = await worker.recognize(cvs);
        if (!isCurrent()) return;

        const found = [];
        const unq = new Set();

        result.data.words.forEach(w => {
          const text = w.text.trim();
          if (/^\d+$/.test(text)) {
            found.push({ text, bbox: w.bbox });
            unq.add(text);
          }
        });

        setNumbers(found);
        setUniqueNums(Array.from(unq).sort((a, b) => Number(a) - Number(b)));
        setStatus(found.length
          ? `Completato: trovati ${found.length} numeri totali.`
          : 'Nessun numero trovato. Prova con una foto più nitida.');
      } catch (err) {
        console.error(err);
        if (isCurrent()) setStatus('Errore durante l\'analisi.');
      } finally {
        if (worker) await worker.terminate();
        if (isCurrent()) setBusy(false);
      }
    };
    img.src = url;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <input type="file" accept="image/*" onChange={handleUpload} disabled={busy} style={{ background: '#333', padding: '10px', borderRadius: '5px', maxWidth: '100%' }} />
        <div role="status" aria-live="polite" style={{ background: '#222', padding: '10px 20px', borderRadius: '20px', color: '#4CAF50' }}>{status}</div>
      </div>

      {uniqueNums.length > 0 && (
        <div style={{ padding: '15px', background: '#1e1e1e', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#aaa' }}>Tastiera Numerica:</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={() => setSelectedNum(null)}
              aria-pressed={selectedNum === null}
              style={{ padding: '8px 16px', background: selectedNum === null ? '#ff9800' : '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Mostra Tutti
            </button>
            {uniqueNums.map(num => (
              <button
                key={num}
                onClick={() => setSelectedNum(num)}
                aria-pressed={selectedNum === num}
                style={{
                  padding: '8px 16px',
                  background: selectedNum === num ? '#4CAF50' : '#333',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}

      {imageSrc && (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <img src={imageSrc} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '8px' }} alt="Mappa" />

          {originalSize.w > 0 && numbers.map((item, idx) => {
            const isTarget = item.text === selectedNum;
            const show = selectedNum === null || isTarget;
            if (!show) return null;

            // Calcolo coordinate in percentuale per la responsività
            const left = (item.bbox.x0 / originalSize.w) * 100;
            const top = (item.bbox.y0 / originalSize.h) * 100;
            const width = ((item.bbox.x1 - item.bbox.x0) / originalSize.w) * 100;
            const height = ((item.bbox.y1 - item.bbox.y0) / originalSize.h) * 100;

            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  border: isTarget ? '3px solid #00ff00' : '1px solid rgba(255, 255, 255, 0.3)',
                  backgroundColor: isTarget ? 'rgba(0, 255, 0, 0.4)' : 'rgba(0, 0, 0, 0.1)',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  boxShadow: isTarget ? '0 0 12px #00ff00' : 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            );
          })}
        </div>
      )}

      {/* Canvas nascosto per l'elaborazione OCR */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
