require('dotenv').config()
require('./mongo') // require directly because this is executed in in mongo.js

// import express from 'express' -> Js modules imports
const express = require('express')
const cors = require('cors')
const logger = require('./loggerMiddleware')
const Note = require('./models/Note')
const notFoud = require('./middleware/notFound')
const handleErrors = require('./middleware/handleErrors')

const Sentry = require('@sentry/node')
const Tracing = require('@sentry/tracing')

const app = express()

app.use(cors())
app.use(express.json())
app.use('/images', express.static('images'))
app.use(logger)

Sentry.init({
  dsn: 'https://d1edbcbf6de64824975e9687fc0f1666@o1372405.ingest.sentry.io/6677298',
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Tracing.Integrations.Express({ app })
  ],
  tracesSampleRate: 1.0
})
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler())
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler())

// HOME
app.get('/', (request, response) => {
  console.log(request.id)
  console.log(request.ips)
  console.log(request.originalUrl)
  response.send('<h1>Hello World!</h1>')
})

// GET ALL NOTES
app.get('/api/notes', (request, response, next) => {
  Note.find({}).then(notes => {
    response.json(notes)
  }).catch(next)
})

// GET NOTE
app.get('/api/notes/:id', (request, response, next) => {
  const { id } = request.params

  Note.findById(id).then(note => {
    if (note) return response.json(note)
    else response.status(404).end()
  }).catch(next)
})

// CHANGE NOTE
app.put('/api/notes/:id', (request, response, next) => {
  const { id } = request.params
  const note = request.body
  // response.json(note)

  const newNoteInfo = {
    content: note.content,
    important: note.important
  }

  Note.findByIdAndUpdate(id, newNoteInfo, { new: true }) // { new: true } see to new update
    .then(result => {
      response.json(result)
    })
    .catch(next)
})

// DELETE NOTE
app.delete('/api/notes/:id', (request, response, next) => {
  const { id } = request.params
  Note.findByIdAndDelete(id).then(() => {
    response.status(204).end()
  }).catch(next)
})

// ADD NEW NOTE
app.post('/api/notes', (request, response, next) => {
  const note = request.body

  if (!note || !note.content) {
    return response.status(400).json({
      error: 'note.content is missing'
    })
  }

  const newNote = new Note({
    content: note.content,
    date: new Date(),
    important: note.important || false
  })

  newNote.save().then(savedNote => {
    response.status(201).json(savedNote)
  }).catch(next)
})

// ERROR SENTRY
app.use(Sentry.Handlers.errorHandler())

// ERRORS
app.use(notFoud)
app.use(handleErrors)

const PORT = process.env.PORT
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})