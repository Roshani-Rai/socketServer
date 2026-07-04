import express from 'express'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import User from './modals/user.modals.js'

dotenv.config()

const port = process.env.PORT || 8000
const mongoUrl = process.env.MONGO_URL

if (!mongoUrl) {
  console.error('MONGO_URL is not defined in environment variables')
  process.exit(1)
}

const connectDb = async () => {
  try {
    await mongoose.connect(mongoUrl)
    console.log('DB connected')
  } catch (error) {
    console.error('DB connection error:', error.message)
    process.exit(1)
  }
}

const app = express()
app.use(express.json())

// ✅ middleware AFTER app is defined
app.use(express.json())
app.use(cors({
  origin: process.env.NEXT_BASE_URL,
  credentials: true,
}))

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_BASE_URL,
    credentials: true,        // ✅ this was the main fix
    methods: ['GET', 'POST'],
  },
})

// emit to a single user's personal socket (existing behavior, unchanged)
app.post('/emit', async (req, res) => {
  const { event, userId, data } = req.body

  if (!event || !userId) {
    return res.status(400).json({ success: false, message: 'event and userId are required' })
  }

  try {
    const user = await User.findById(userId)

    if (!user) {
      console.warn(`emit failed: user ${userId} not found`)
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    if (!user.socketId || !user.isOnline) {
      console.warn(`emit skipped: user ${userId} has no active socket`)
      return res.json({ success: false, message: 'User is not connected', delivered: false })
    }

    io.to(user.socketId).emit(event, data)
    console.log(`emitted "${event}" to user ${userId} (socket ${user.socketId})`)
    return res.json({ success: true, delivered: true })
  } catch (error) {
    console.error('emit error:', error.message)
    return res.status(500).json({ success: false, message: error.message })
  }
})

// emit to everyone in a ride room (driver + rider), e.g. after an OTP verify
// route flips bookingStatus. Call this from your Next.js API routes:
//   axios.post(`${SOCKET_BASE_URL}/emit-room`, {
//     event: 'booking-status-update',
//     bookingId,
//     data: { bookingStatus, booking },
//   })
app.post('/emit-room', (req, res) => {
  const { event, bookingId, data } = req.body

  if (!event || !bookingId) {
    return res.status(400).json({ success: false, message: 'event and bookingId are required' })
  }

  try {
    io.to(`ride-${bookingId}`).emit(event, data)
    console.log(`emitted "${event}" to room ride-${bookingId}`)
    return res.json({ success: true, delivered: true })
  } catch (error) {
    console.error('emit-room error:', error.message)
    return res.status(500).json({ success: false, message: error.message })
  }
})

io.on('connection', (socket) => {
  console.log('connected:', socket.id)

  socket.on('identity', async (data) => {
    const userId = typeof data === 'string' ? data : data?.userId  
    if (!userId) return;

    socket.userId = userId
    try {
      await User.findByIdAndUpdate(userId, {
        socketId: socket.id,
        isOnline: true,
      })
      console.log('identity saved:', userId)
    } catch (err) {
      console.error('identity error:', err.message)
    }
  })

  socket.on('update-location',async({userId,latitude,longitude})=>{
    
     await User.findByIdAndUpdate(userId,{
        location:{
            type:'Point',
            coordinates:[longitude,latitude]
        }
     })
  })

  socket.on('join-ride',(bookingId)=>{
    console.log('join-ride',bookingId)
    socket.join(`ride-${bookingId}`)
  })

  // forward status alongside lat/lng so riders get a lightweight,
  // best-effort status sync riding along with every GPS ping
  // (the authoritative status change is still broadcast via
  // 'booking-status-update' through the /emit-room endpoint above)
  socket.on('driver-location-update',({bookingId,longitude,latitude,status})=>{
      console.log('EMITTING TO ROOM:', `ride-${bookingId}`, 'status:', status)
     io.to(`ride-${bookingId}`).emit("driver-location",{
      latitude,
      longitude,
      status
     })
  })

  socket.on('send-chat-message', (message) => {
    const { bookingId } = message
    socket.to(`ride-${bookingId}`).emit('new-chat-message', message)
})

  socket.on('disconnect', async () => {
    if (!socket.userId) return;
    try {
      await User.findByIdAndUpdate(socket.userId, {
        socketId: null,
        isOnline: false,
      })
      console.log('user offline:', socket.userId)
    } catch (err) {
      console.error('disconnect error:', err.message)
    }
  })
})

await connectDb()

server.listen(port, () => {
  console.log(`Server started on port ${port}`)
})