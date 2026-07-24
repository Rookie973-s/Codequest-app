import { useState } from 'react';
import Head from 'next/head';

export default function Login() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.href = '/codequest.html';
        return;
      }
      setError(data.error || 'That code is not valid.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Code Quest — Enter Access Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;700;800&family=JetBrains+Mono:wght@600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className={`wrap ${shake ? 'shake' : ''}`}>
        <div className="glow" />
        <div className="card">
          <div className="badge">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#252422" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2.5" fill="#252422" stroke="none" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              <circle cx="12" cy="15.4" r="1.3" fill="#FFC300" stroke="none" />
            </svg>
          </div>
          <h1>Code Quest</h1>
          <p className="sub">Enter your access code to begin your quest</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TB-XX-XXXXX"
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Unlock Code Quest'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
          <p className="hint">Access codes are given out by your instructor.</p>
        </div>
      </div>
      <style jsx global>{`
        html, body { margin: 0; padding: 0; background: #14120F; }
      `}</style>
      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #14120F;
          position: relative;
          overflow: hidden;
          font-family: 'Nunito', sans-serif;
          padding: 20px;
        }
        .glow {
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(circle at 20% 20%, rgba(255,195,0,.10), transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(255,158,27,.08), transparent 45%);
          filter: blur(60px);
          pointer-events: none;
        }
        .wrap.shake .card { animation: shakeCard 0.4s ease-in-out; }
        @keyframes shakeCard {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .card {
          position: relative;
          background: #211D18;
          border-radius: 36px;
          padding: 52px 40px 44px;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow:
            10px 10px 24px rgba(0,0,0,0.45),
            -8px -8px 20px rgba(255,255,255,0.02),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .badge {
          width: 62px;
          height: 62px;
          margin: 0 auto 20px;
          border-radius: 18px;
          background: linear-gradient(145deg, #FFD666, #FFC300);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            6px 6px 14px rgba(0,0,0,0.4),
            -4px -4px 10px rgba(255,255,255,0.03);
        }
        h1 {
          font-family: 'Baloo 2', sans-serif;
          font-size: 30px;
          margin: 0 0 8px;
          color: #F7F2E9;
          letter-spacing: -0.5px;
        }
        .sub { color: #93887A; font-size: 14.5px; margin: 0 0 32px; font-weight: 600; line-height: 1.5; }

        .field {
          background: #171412;
          border-radius: 18px;
          padding: 4px;
          margin-bottom: 18px;
          box-shadow:
            inset 4px 4px 10px rgba(0,0,0,0.5),
            inset -4px -4px 10px rgba(255,255,255,0.02);
        }
        input {
          width: 100%;
          box-sizing: border-box;
          background: transparent;
          border: none;
          border-radius: 14px;
          padding: 18px 16px;
          font-size: 20px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          text-align: center;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #F7F2E9;
          outline: none;
        }
        input::placeholder { color: #4A443C; letter-spacing: 3px; }
        .field:focus-within {
          box-shadow:
            inset 4px 4px 10px rgba(0,0,0,0.5),
            inset -4px -4px 10px rgba(255,255,255,0.02),
            0 0 0 3px rgba(255,195,0,0.35);
        }

        button {
          width: 100%;
          background: linear-gradient(145deg, #FFD666, #FFC300);
          color: #252422;
          border: none;
          border-radius: 100px;
          padding: 16px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          font-family: 'Nunito', sans-serif;
          box-shadow: 6px 6px 14px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.02);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        button:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); }
        button:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        button:disabled { opacity: 0.6; cursor: not-allowed; }

        .error {
          color: #FF8A6B;
          background: rgba(255, 107, 90, 0.1);
          border-radius: 12px;
          padding: 10px;
          font-size: 13.5px;
          font-weight: 700;
          margin: 18px 0 0;
        }
        .hint { color: #5C5348; font-size: 12px; margin: 26px 0 0; font-weight: 600; }
      `}</style>
    </>
  );
}
