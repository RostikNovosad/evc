'use client';

import { useEffect, useState } from 'react';
import type { Card } from '@/lib/schema';
import { generatePdf } from '@/lib/pdf';

const STORAGE_KEY = 'lexi:session';
const keyOf = (c: Card) => c.headword.trim().toLowerCase();

export default function Home() {
  const [query, setQuery] = useState('');
  const [raw, setRaw] = useState('');
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setStack(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
      } catch {}
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
  }, [stack, loaded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send() {
    if (!query.trim()) return;
    setLoading(true);
    setRaw('');
    setCard(null);
    setError('');
    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setRaw(`${res.status}\n` + JSON.stringify(data, null, 2));
      if (data.card) setCard(data.card);
      else setError(data.error?.message ?? 'Невідома помилка');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const inStack = card ? stack.some((c) => keyOf(c) === keyOf(card)) : false;

  return (
    <div className="shell">
      <main className="main">
        <button
          className="menu-btn"
          onClick={() => setOpen(true)}
          aria-label={`Відкрити словник, карток: ${stack.length}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          {stack.length > 0 && <span className="badge">{stack.length}</span>}
        </button>

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="break the ice"
            aria-label="Слово або вираз"
            autoFocus
          />
          <button className="btn" type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Шукаю…' : 'Відправити'}
          </button>
        </form>
        <p className="hint">Для багатозначних слів додайте підказку в дужках: bank (river)</p>

        {loading && (
          <div className="loading" role="status">
            <div className="loading-row">
              <span className="dots"><i /><i /><i /></span>
              Готую картку
            </div>
            <div className="bar w1" />
            <div className="bar w2" />
            <div className="bar w3" />
          </div>
        )}

        {error && <p className="error">{error}</p>}

        {card && (
          <CardView
            card={card}
            added={inStack}
            onAdd={() => setStack((s) => [card, ...s])}
          />
        )}

        {raw && (
          <details className="raw">
            <summary>JSON відповіді</summary>
            <pre>{raw}</pre>
          </details>
        )}
      </main>

      <div className={`backdrop ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`stack ${open ? 'open' : ''}`} aria-label="Словник" aria-hidden={!open} inert={!open}>
        <div className="stack-head">
          <h2>Словник <span className="count">{stack.length}</span></h2>
          <button className="close" onClick={() => setOpen(false)} aria-label="Закрити">×</button>
        </div>

        <ul className="stack-list">
          {stack.length === 0 && (
            <li className="empty">Порожньо. Додайте картку зі знайденого слова.</li>
          )}
          {stack.map((c) => (
            <li className="stack-item" key={keyOf(c)}>
              <b>{c.headword}</b>
              <span>{c.translationUk}</span>
              <small>{c.definitionEn}</small>
              <button
                aria-label={`Видалити ${c.headword}`}
                onClick={() => setStack((s) => s.filter((x) => keyOf(x) !== keyOf(c)))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <div className="stack-actions">
          <button className="btn" disabled={stack.length === 0} onClick={() => generatePdf(stack)}>
            Згенерувати PDF
          </button>
          <button className="ghost" disabled={stack.length === 0} onClick={() => setStack([])}>
            Очистити
          </button>
        </div>
      </aside>
    </div>
  );
}

function CardView({ card, added, onAdd }: { card: Card; added: boolean; onAdd: () => void }) {
  return (
    <article className="entry">
      <div className="entry-head">
        <div>
          <h2 className="headword">{card.headword}</h2>
          {card.ipa && <span className="ipa">{card.ipa}</span>}
          <div className="tags">
            {[card.type, card.partOfSpeech, card.register].filter(Boolean).map((t) => (
              <span className="tag" key={t}>{t}</span>
            ))}
            <span className={`tag ${card.confidence === 'low' ? 'low' : ''}`}>
              впевненість: {card.confidence}
            </span>
          </div>
        </div>
        <button className="add" onClick={onAdd} disabled={added}>
          {added ? '✓ У словнику' : '+ Додати до словника'}
        </button>
      </div>

      {card.corrected && card.corrected.toLowerCase() !== card.query.trim().toLowerCase() && (
        <p className="fix">Виправлено з «{card.query}» на «{card.corrected}»</p>
      )}

      <section className="sec">
        <p className="label">Переклад</p>
        <p className="translation">{card.translationUk}</p>
      </section>

      <section className="sec">
        <p className="label">Значення</p>
        <p>{card.definitionEn}</p>
      </section>

      <section className="sec">
        <p className="label">Нюанси</p>
        <p>{card.explanationUk}</p>
      </section>

      <section className="sec">
        <p className="label">Використання</p>
        <ul className="examples">
          {card.examples.map((e, i) => (
            <li key={i}>
              <div>{e.en}</div>
              <div className="uk">{e.uk}</div>
            </li>
          ))}
        </ul>
      </section>

      {card.relatedPhrases && card.relatedPhrases.length > 0 && (
        <section className="sec">
          <p className="label">Пов&apos;язані вирази</p>
          <div className="related">
            {card.relatedPhrases.map((p) => (
              <span className="tag" key={p}>{p}</span>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
