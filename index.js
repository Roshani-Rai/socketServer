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
io.on('connection', (socket) => {
  console.log('connected:', socket.id)

  socket.on('identity', async (data) => {
    const userId = typeof data === 'string' ? data : data?.userId  
    if (!userId) return

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

  socket.on('disconnect', async () => {
    if (!socket.userId) return
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