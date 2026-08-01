import { useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import api from '../api/axios';
import GifPicker from './GifPicker';
import ShortRecorder from './ShortRecorder';

export default function MessageInput({ onSend, onTyping }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showShortRecorder, setShowShortRecorder] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setText(e.target.value);
    // Debounced typing indicator: tell the other side we're typing, and
    // automatically tell them we stopped if no keystroke happens for 2s.
    onTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend({ text: text.trim() });
    setText('');
    onTyping(false);
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSend({ fileUrl: data.fileUrl, fileName: data.fileName, fileType: data.fileType });
      return true;
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = '';
  };

  const handleShortSend = async (file) => {
    const success = await uploadFile(file);
    if (success) setShowShortRecorder(false);
  };

  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleGifSelect = (gifUrl) => {
    // A GIF from Tenor is already a full external URL, not something we
    // uploaded ourselves - so unlike file attachments, there's no upload
    // step here, we just send the URL straight through as the message.
    onSend({ fileUrl: gifUrl, fileName: 'GIF', fileType: 'image/gif' });
    setShowGifPicker(false);
  };

  return (
    <div className="message-input-wrapper">
      {showEmojiPicker && (
        <div className="emoji-picker-popup">
          <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={350} />
        </div>
      )}
      {showGifPicker && (
        <div className="gif-picker-popup">
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        </div>
      )}
      {showShortRecorder && (
        <ShortRecorder onSend={handleShortSend} onClose={() => setShowShortRecorder(false)} />
      )}

      <form className="message-input-row" onSubmit={handleSubmit}>
        <button type="button" className="attach-btn" onClick={() => setShowEmojiPicker((prev) => !prev)}>😊</button>
        <button type="button" className="attach-btn" onClick={() => setShowGifPicker((prev) => !prev)}>GIF</button>
        <button type="button" className="attach-btn" onClick={() => setShowShortRecorder(true)} title="Record a short">🎬</button>
        <button type="button" className="attach-btn" onClick={() => fileInputRef.current.click()} disabled={uploading}>
          {uploading ? '...' : '📎'}
        </button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={handleChange}
          className="message-text-input"
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>➤</button>
      </form>
    </div>
  );
}
