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
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div className={`wrap ${shake ? 'shake' : ''}`}>
        <div className="card">
          <div className="badge">🔐</div>
          <h1>CODE QUEST</h1>
          <p className="sub">Enter your access code to begin your quest.</p>
          <form onSubmit={handleSubmit}>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TB-XXXXXX"
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Unlock Code Quest'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          <p className="hint">Access codes are given out by your instructor.</p>
        </div>
      </div>
      <style jsx global>{`
        html, body { margin: 0; padding: 0; }
      `}</style>
      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #06020e;
          background-image:
            radial-gradient(circle at 15% 20%, rgba(78,205,196,.15), transparent 40%),
            radial-gradient(circle at 85% 15%, rgba(199,125,255,.15), transparent 45%),
            radial-gradient(circle at 80% 85%, rgba(255,107,129,.12), transparent 40%);
          font-family: 'Nunito', sans-serif;
          padding: 20px;
        }
        .wrap.shake .card { animation: shakeCard 0.4s ease-in-out; }
        @keyframes shakeCard {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .card {
          background: rgba(22, 10, 48, 0.6);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 28px;
          padding: 48px 40px;
          max-width: 420px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .badge { font-size: 40px; margin-bottom: 8px; }
        h1 {
          font-family: 'Baloo 2', sans-serif;
          font-size: 34px;
          margin: 0 0 8px;
          background: linear-gradient(to right, #4ECDC4, #C77DFF, #FF6B81);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .sub { color: #A89BCA; font-size: 15px; margin: 0 0 28px; font-weight: 600; }
        input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 14px;
          padding: 16px;
          font-size: 18px;
          text-align: center;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #fff;
          outline: none;
          font-family: 'Nunito', sans-serif;
          transition: all 0.3s ease;
        }
        input:focus { border-color: #C77DFF; box-shadow: 0 0 0 3px rgba(199,125,255,0.25); }
        button {
          width: 100%;
          margin-top: 16px;
          background: linear-gradient(135deg, #4ECDC4, #C77DFF);
          color: #06020e;
          border: none;
          border-radius: 100px;
          padding: 15px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          font-family: 'Nunito', sans-serif;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(199,125,255,0.4); }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        .error {
          color: #FF6B81;
          background: rgba(255,107,129,0.1);
          border-radius: 10px;
          padding: 10px;
          font-size: 14px;
          font-weight: 700;
          margin: 16px 0 0;
        }
        .hint { color: #6b5f8a; font-size: 12px; margin: 24px 0 0; }
      `}</style>
    </>
  );
}
