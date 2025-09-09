import { useState, useEffect, useRef } from 'react';
import { canChat_backend } from 'declarations/canChat_backend';
import './index.scss';

function App() {
  const [currentView, setCurrentView] = useState('home'); // 'home', 'room', 'join'
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for room code in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('refID');
    if (refId && refId.length === 6) {
      setJoinCode(refId.toUpperCase());
      setCurrentView('join');
      // Auto-join the room
      setTimeout(() => {
        handleJoinRoom();
      }, 100);
    }
  }, []);

  // Update URL when room code changes
  useEffect(() => {
    if (roomCode && currentView === 'room') {
      const newUrl = `${window.location.origin}${window.location.pathname}?refID=${roomCode}`;
      window.history.pushState({}, '', newUrl);
    }
  }, [roomCode, currentView]);

  // Poll for new messages every 2 seconds
  useEffect(() => {
    if (currentView === 'room' && roomCode) {
      const interval = setInterval(async () => {
        try {
          const roomMessages = await canChat_backend.getMessages(roomCode);
          setMessages(roomMessages);
        } catch (err) {
          console.error('Error fetching messages:', err);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentView, roomCode]);

  const handleCreateRoom = async () => {
    try {
      setError('');
      const result = await canChat_backend.createRoom();
      
      if ('Ok' in result) {
        setRoomCode(result.Ok.roomCode);
        setRoom(result.Ok.room);
        setSessionId(result.Ok.sessionId);
        setMessages(result.Ok.room.messages);
        setIsCreator(true);
        setCurrentView('room');
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError('Failed to create room: ' + err.message);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    try {
      setError('');
      const result = await canChat_backend.joinRoom(joinCode.trim().toUpperCase());
      
      if ('Ok' in result) {
        setRoomCode(joinCode.trim().toUpperCase());
        setRoom(result.Ok.room);
        setSessionId(result.Ok.sessionId);
        setMessages(result.Ok.room.messages);
        setIsCreator(false);
        setCurrentView('room');
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError('Failed to join room: ' + err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !sessionId) return;

    try {
      const result = await canChat_backend.sendMessage(roomCode, sessionId, newMessage.trim());
      
      if ('Ok' in result) {
        setMessages(prev => [...prev, result.Ok]);
        setNewMessage('');
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError('Failed to send message: ' + err.message);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      if (sessionId) {
        await canChat_backend.leaveRoom(roomCode, sessionId);
      }
      setCurrentView('home');
      setRoomCode('');
      setRoom(null);
      setMessages([]);
      setNewMessage('');
      setError('');
      setIsCreator(false);
      setSessionId('');
      // Clear URL parameters
      window.history.pushState({}, '', window.location.pathname);
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  };

  const handleCopyRoomCode = async () => {
    try {
      const roomUrl = `${window.location.origin}${window.location.pathname}?refID=${roomCode}`;
      await navigator.clipboard.writeText(roomUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = `${window.location.origin}${window.location.pathname}?refID=${roomCode}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(Number(timestamp) / 1000000);
    return date.toLocaleTimeString();
  };

  const formatMessageSender = (message) => {
    // Show "You" for current user, display name for others
    return message.sender === sessionId ? "You" : message.senderName;
  };

  if (currentView === 'home') {
    return (
      <div className="app">
        <div className="container">
          <h1>canChat</h1>
          <p>Create or join a chat room</p>
          
          {error && <div className="error">{error}</div>}
          
          <div className="button-group">
            <button onClick={handleCreateRoom} className="btn btn-primary">
              Create Room
            </button>
            <button onClick={() => setCurrentView('join')} className="btn btn-secondary">
              Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'join') {
    return (
      <div className="app">
        <div className="container">
          <h1>Join Room</h1>
          <p>Enter the 6-character room code</p>
          
          {error && <div className="error">{error}</div>}
          
          <div className="input-group">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength="6"
              className="room-code-input"
            />
            <button onClick={handleJoinRoom} className="btn btn-primary">
              Join
            </button>
          </div>
          
          <button onClick={() => setCurrentView('home')} className="btn btn-link">
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'room') {
    return (
      <div className="app">
        <div className="chat-container">
          <div className="chat-header">
            <div className="room-code-section">
              <h2>Room: {roomCode}</h2>
              <button 
                onClick={handleCopyRoomCode} 
                className={`btn btn-copy ${copySuccess ? 'copied' : ''}`}
                title="Copy room link"
              >
                {copySuccess ? '✓ Copied!' : '📋 Copy Link'}
              </button>
            </div>
            <div className="room-info">
              <span>{room?.participants.length} participant(s)</span>
              <button onClick={handleLeaveRoom} className="btn btn-small">
                Leave Room
              </button>
            </div>
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`message ${message.sender === sessionId ? 'own' : 'other'}`}>
                  <div className="message-header">
                    <span className="sender">{formatMessageSender(message)}</span>
                    <span className="timestamp">{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="message-content">{message.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="message-input"
            />
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}

export default App;