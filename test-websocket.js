// WebSocket test for MS-Status
// Run with: node test-websocket.js

const io = require('socket.io-client');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4OGI1ZWFjZS1mNjMxLTQ4ZjMtOTg0Zi1hMTVhZjNiMmZmOWEiLCJlbWFpbCI6InN0YXR1c0B0ZXN0LmNvbSIsIm5hbWUiOiJTdGF0dXMgVGVzdGVyIiwiaWF0IjoxNzcyNTk4NDk5LCJleHAiOjE3NzI1OTkzOTl9.YTzqQ2ZOOs3gIYKLO6U0N2UVbHDZGCv7SelDeT3X_ZQ';
const JOB_ID = 'test-job-001';

console.log('🔌 Connecting to WebSocket...');

const socket = io('http://localhost:3003/status', {
  auth: { token: TOKEN },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected! Socket ID:', socket.id);
  
  // Subscribe to job updates
  console.log(`📬 Subscribing to job: ${JOB_ID}`);
  socket.emit('subscribeToJob', { jobId: JOB_ID }, (response) => {
    console.log('📬 Subscribe response:', JSON.stringify(response, null, 2));
  });

  // Get my jobs
  socket.emit('getMyJobs', {}, (response) => {
    console.log('📋 My jobs:', JSON.stringify(response, null, 2));
  });
});

socket.on('statusUpdate', (data) => {
  console.log('🔔 Status update received:', JSON.stringify(data, null, 2));
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('⏰ Test complete. Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 30000);
