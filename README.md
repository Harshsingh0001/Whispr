# Whispr – Real-Time Chat Application

A modern real-time chat application built with the MERN stack, Socket.io, and WebRTC. Whispr provides one-to-one and group messaging with real-time communication features such as typing indicators, online presence, read receipts, media sharing, disappearing messages, voice/video calling, GIF support, and short video recording.

The project focuses on building a scalable real-time communication platform using modern web technologies while keeping the architecture modular and easy to extend.

---

## Features

### Authentication
- JWT-based authentication
- Secure password hashing using bcrypt
- Protected API routes
- Persistent login sessions

### Messaging
- One-to-one chat
- Group conversations
- Real-time messaging
- Typing indicators
- Read receipts
- Online/offline presence
- Emoji reactions
- Image and file sharing

### Media
- Emoji picker
- GIF search (Tenor API)
- Short video recording
- Video playback inside chat
- Multiple file upload support

### Communication
- Voice calling
- Video calling
- Incoming call notifications
- Missed and declined call logs
- Group calling using WebRTC

### Additional Features
- Disappearing messages
- Responsive mobile-first interface
- Real-time Socket.io updates
- MongoDB persistence

---

## Tech Stack

### Frontend

- React (Vite)
- React Router
- Axios
- Socket.io Client

### Backend

- Node.js
- Express.js
- Socket.io
- MongoDB
- Mongoose
- JWT
- bcrypt
- Multer

### APIs

- Tenor GIF API
- WebRTC
- MediaRecorder API

---

## Project Structure

```
whispr
│
├── backend
│   ├── config
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── socket
│   ├── utils
│   └── server.js
│
├── frontend
│   ├── public
│   └── src
│       ├── components
│       ├── context
│       ├── hooks
│       ├── pages
│       ├── services
│       └── App.jsx
│
└── README.md
```

---

## Getting Started

### Clone Repository

```bash
git clone https://github.com/yourusername/whispr.git
cd whispr
```

---

### Backend Setup

```bash
cd backend

npm install

cp .env.example .env

npm run dev
```

---

### Frontend Setup

```bash
cd frontend

npm install

cp .env.example .env

npm run dev
```

---

## Environment Variables

### Backend

```
PORT=

MONGO_URI=

JWT_SECRET=

CLIENT_URL=
```

### Frontend

```
VITE_API_URL=

VITE_TENOR_API_KEY=
```

---

## Core Technologies Used

| Technology | Purpose |
|------------|---------|
| React | Frontend UI |
| Express | REST API |
| MongoDB | Database |
| Socket.io | Real-time communication |
| JWT | Authentication |
| Multer | File uploads |
| WebRTC | Voice & Video calls |
| MediaRecorder API | Video recording |
| Tenor API | GIF search |

---

## Key Functionalities

### Real-Time Messaging

Messages are delivered instantly using Socket.io. Users receive typing indicators, read receipts, emoji reactions, and presence updates without refreshing the page.

---

### Presence Management

Each connected user may have multiple active sessions. Presence is managed using Socket.io connections to ensure users remain online until all active sessions disconnect.

---

### Disappearing Messages

Users can enable disappearing messages for conversations. Expired messages are automatically removed using MongoDB TTL indexes.

---

### Voice & Video Calls

Voice and video calls are implemented using WebRTC, while Socket.io is used for signaling between peers.

Features include:

- Incoming call notifications
- Accept/Decline calls
- Missed call history
- Group calling

---

### Short Video Recording

Users can record short videos directly from the browser using the MediaRecorder API and send them as chat messages.

---

## Responsive Design

The application is fully responsive and optimized for:

- Desktop
- Tablet
- Mobile devices

---

## Future Improvements

- Push notifications
- End-to-end encryption
- Message search
- Stories feature
- Status updates
- TURN server support
- Screen sharing
- Voice messages
- Message forwarding

---

## Screenshots

Add screenshots here.

```
Login

Chat Window

Group Chat

Voice Call

Video Call

Mobile View
```


---
