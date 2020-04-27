import express from 'express'
import mongodb from 'mongodb'
import { parse as parseXml, validate as validateXml } from 'fast-xml-parser'
import path from 'path'

const MongoClient = mongodb.MongoClient

const app = express()
let db: mongodb.Db

// Parse body as string
app.use((req, res, next) => {
    let bodyText = ''
    req.on('data', (chunk: Buffer|string) => {
        if (typeof chunk == 'string') {
            bodyText += chunk
        } else {
            bodyText += chunk.toString('utf8')
        }
    })
    req.on('end', () => {
        req.body = bodyText
        next()
    })
})

app.get('**', express.static(path.resolve(__dirname, '../front')))
app.all('/sub/hook', async (req, res) => {
    const queryStr = req.originalUrl.split('?')[1]
    const challenge = queryStr?.split('&').find(it => it.startsWith('hub.challenge='))?.slice('hub.challenge='.length)

    if (validateXml(req.body) !== true) {
        const error = validateXml(req.body)
        console.error('VALIDATE ERROR', error)
        res.status(500).send('error')
        return
    }

    const subscribeObject = parseXml(req.body)

    await db.collection('subs-log').insertOne({ time: Date.now(), req: {
        url: req.originalUrl,
        method: req.method,
        body: subscribeObject,
        headers: req.headers,
    } })

    res.send(challenge ?? 'ok')
})

app.get('/sub/logs', async (req, res) => {
    const data = await db.collection('subs-log').find().sort({ time: -1 }).toArray()
    res.send(JSON.stringify(data, void 0, 2))
})

MongoClient.connect('mongodb://mongo:27017', { useUnifiedTopology: true }, (err, client) => {
    if (err) throw err
    db = client.db('voms-timeline')

    app.listen(80, () => {
        console.log('LISTEN')
    })
})
