import { useState } from 'react';

const TENOR_API_KEY = import.meta.env.VITE_TENOR_API_KEY;

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (value) => {
    setQuery(value);
    if (!value.trim()) return setResults([]);
    if (!TENOR_API_KEY || TENOR_API_KEY === 'your_free_tenor_api_key_here') return;

    setLoading(true);
    try {
      const res = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(value)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif`
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('GIF search failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const noApiKey = !TENOR_API_KEY || TENOR_API_KEY === 'your_free_tenor_api_key_here';

  return (
    <div className="gif-picker">
      <div className="gif-picker-header">
        <input
          type="text"
          placeholder="Search GIFs..."
          value={query}
          onChange={(e) => search(e.target.value)}
          autoFocus
        />
        <button onClick={onClose}>✕</button>
      </div>

      {noApiKey && (
        <p className="hint-text" style={{ padding: '1rem' }}>
          GIF search needs a free Tenor API key — see the README's "GIF Search Setup" section.
        </p>
      )}

      {!noApiKey && loading && <p className="hint-text" style={{ padding: '1rem' }}>Searching...</p>}

      <div className="gif-grid">
        {results.map((gif) => {
          const gifUrl = gif.media_formats?.gif?.url;
          if (!gifUrl) return null;
          return (
            <img
              key={gif.id}
              src={gif.media_formats?.tinygif?.url || gifUrl}
              alt={gif.content_description}
              className="gif-thumb"
              onClick={() => onSelect(gifUrl)}
            />
          );
        })}
      </div>
    </div>
  );
}
