const path = require('path')
const http = require('http')
const express = require('express')
const { Server } = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

const port = process.env.PORT || 3000
const publicDir = path.join(__dirname, '../public')

const adminUsername = 'Admin'

app.use(express.static(publicDir))

io.on('connection', (socket) => {
  console.log('new WebSocket connection')

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options })

    if (error) {
      return callback(error)
    }

    socket.join(user.room)

    socket.emit('message', generateMessage(adminUsername, 'Welcome!'))
    socket.broadcast.to(user.room).emit('message', generateMessage(adminUsername, `${user.username} has joined`))
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    })
    callback()
  })

  socket.on('sendMessage', (message, callback) => {
    const filter = new Filter()
    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!')
    }
    const user = getUser(socket.id)
    io.to(user.room).emit('message', generateMessage(user.username, message))
    callback('Delivered')
  })

  socket.on('sendLocation', (location, callback) => {
    const user = getUser(socket.id)
    io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, location))
    callback()
  })

  socket.on('disconnect', () => {
    const user = removeUser(socket.id)

    if (user) {
      io.to(user.room).emit('message', generateMessage(adminUsername, `${user.username} left the room`))
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      })
    }
  })
})

server.listen(port, () => {
  console.log('Server is up on port ' + port)
})
