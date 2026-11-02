'use client';

import { useEffect, useState } from 'react';
import { LEVELS, type Card, type Level } from '@/lib/schema';
import { generatePdf } from '@/lib/pdf';
import { speak, type Accent } from '@/lib/speak';

const STORAGE_KEY = 'lexi:session';
const TIMEOUT_MS = 60_000;
const keyOf = (c: Card) => c.headword.trim().toLowerCase();

export default function Home() {
  const [query, setQuery] = useState('');
  const [raw, setRaw] = useState('');
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState<Card[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [last, setLast] = useState<{ query: string; level: Level } | null>(null);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>('C1');
  const [accent, setAccent] = useState<Accent>('en-US');

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

  async function send(req = { query: query.trim(), level }) {
    if (!req.query) return;
    setLast(req);
    setLoading(true);
    setRaw('');
    setCard(null);
    setError('');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });
      const data = await res.json();
      setRaw(`${res.status}\n` + JSON.stringify(data, null, 2));
      if (data.card) setCard(data.card);
      else setError(data.error?.message ?? 'Невідома помилка');
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Відповідь не прийшла за 1 хвилину. Спробуйте ще раз.'
          : String(e),
      );
    } finally {
      clearTimeout(timer);
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
        <div className="levels" role="radiogroup" aria-label="Рівень">
          <span>Рівень</span>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              className={level === l ? 'on' : ''}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
          <span className="sep" />
          {(['en-US', 'en-GB'] as const).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={accent === a}
              className={accent === a ? 'on' : ''}
              onClick={() => setAccent(a)}
            >
              {a === 'en-US' ? 'US' : 'UK'}
            </button>
          ))}
        </div>
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

        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            {last && (
              <button className="retry" onClick={() => send(last)} disabled={loading}>
                Повторити
              </button>
            )}
          </div>
        )}

        {card && (
          <CardView
            card={card}
            accent={accent}
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
              <b>{c.headword} <SpeakButton text={c.headword} accent={accent} /></b>
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

function SpeakButton({ text, accent }: { text: string; accent: Accent }) {
  return (
    <button
      type="button"
      className="speak"
      onClick={() => speak(text, accent)}
      aria-label={`Озвучити: ${text}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}

function CardView({
  card,
  accent,
  added,
  onAdd,
}: {
  card: Card;
  accent: Accent;
  added: boolean;
  onAdd: () => void;
}) {
  return (
    <article className="entry">
      <div className="entry-head">
        <div>
          <h2 className="headword">{card.headword}</h2>
          {card.ipa && <span className="ipa">{card.ipa}</span>}
          <SpeakButton text={card.headword} accent={accent} />
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
              <div>{e.en} <SpeakButton text={e.en} accent={accent} /></div>
              <div className="uk">{e.uk}</div>
            </li>
          ))}
        </ul>
      </section>

      {card.synonyms && card.synonyms.length > 0 && (
        <section className="sec">
          <p className="label">Синоніми</p>
          <div className="related">
            {card.synonyms.map((p) => (
              <span className="chip syn" key={p}>{p}</span>
            ))}
          </div>
        </section>
      )}

      {card.relatedPhrases && card.relatedPhrases.length > 0 && (
        <section className="sec">
          <p className="label">Пов&apos;язані вирази</p>
          <div className="related">
            {card.relatedPhrases.map((p) => (
              <span className="chip rel" key={p}>{p}</span>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
