import { useState } from 'react';
import api from '../api/axios';
import Avatar from './Avatar';

export default function NewChatModal({ onClose, onConversationCreated }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (value) => {
    setQuery(value);
    if (!value.trim()) return setResults([]);
    setSearching(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(value)}`);
      setResults(data);
    } finally {
      setSearching(false);
    }
  };

  const toggleUser = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u._id === user._id) ? prev.filter((u) => u._id !== user._id) : [...prev, user]
    );
  };

  const startPrivateChat = async (user) => {
    const { data } = await api.post('/conversations/private', { userId: user._id });
    onConversationCreated(data);
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) return;
    const { data } = await api.post('/conversations/group', {
      groupName,
      participantIds: selectedUsers.map((u) => u._id),
    });
    onConversationCreated(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{groupMode ? 'New Group' : 'New Chat'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={!groupMode ? 'tab active' : 'tab'} onClick={() => setGroupMode(false)}>Direct Message</button>
          <button className={groupMode ? 'tab active' : 'tab'} onClick={() => setGroupMode(true)}>Group</button>
        </div>

        {groupMode && (
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="modal-input"
          />
        )}

        <input
          type="text"
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="modal-input"
        />

        {groupMode && selectedUsers.length > 0 && (
          <div className="selected-chips">
            {selectedUsers.map((u) => (
              <span key={u._id} className="chip" onClick={() => toggleUser(u)}>
                {u.name} ✕
              </span>
            ))}
          </div>
        )}

        <div className="search-results">
          {searching && <p className="hint-text">Searching...</p>}
          {!searching && query && results.length === 0 && <p className="hint-text">No users found</p>}
          {results.map((user) => (
            <div
              key={user._id}
              className="user-result"
              onClick={() => (groupMode ? toggleUser(user) : startPrivateChat(user))}
            >
              <Avatar name={user.name} color={user.avatarColor} isOnline={user.isOnline} size={36} />
              <div>
                <div className="user-result-name">{user.name}</div>
                <div className="user-result-email">{user.email}</div>
              </div>
              {groupMode && selectedUsers.some((u) => u._id === user._id) && <span className="check-mark">✓</span>}
            </div>
          ))}
        </div>

        {groupMode && (
          <button className="create-group-btn" onClick={createGroup} disabled={selectedUsers.length < 2 || !groupName.trim()}>
            Create Group ({selectedUsers.length} members)
          </button>
        )}
      </div>
    </div>
  );
}
