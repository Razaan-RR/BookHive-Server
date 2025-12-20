require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const admin = require('firebase-admin')

const port = process.env.PORT || 3000

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)
const serviceAccount = JSON.parse(decoded)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const app = express()

app.use(
  cors({
    origin: [process.env.CLIENT_DOMAIN],
    credentials: true,
    optionSuccessStatus: 200,
  })
)
app.use(express.json())

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db('booksDB')
    const booksCollection = db.collection('books')
    const ordersCollection = db.collection('orders')
    const usersCollection = db.collection('users')

    const verifyADMIN = async (req, res, next) => {
      const { email } = req.body
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'admin')
        return res.status(403).send({ message: 'Admin only' })
      next()
    }

    const verifyLIBRARIAN = async (req, res, next) => {
      const { email } = req.body
      const user = await usersCollection.findOne({ email })
      if (user?.role !== 'librarian')
        return res.status(403).send({ message: 'Librarian only' })
      next()
    }

    app.post('/books', verifyLIBRARIAN, async (req, res) => {
      const book = req.body
      book.createdAt = new Date()
      const result = await booksCollection.insertOne(book)
      res.send(result)
    })

    app.get('/books', async (req, res) => {
      const result = await booksCollection.find().toArray()
      res.send(result)
    })

    app.get('/books/latest', async (req, res) => {
      const limit = Number(req.query.limit) || 6

      const result = await booksCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()

      res.send(result)
    })

    app.get('/book/:id', async (req, res) => {
      const result = await booksCollection.findOne({
        _id: new ObjectId(req.params.id),
      })
      res.send(result)
    })

    app.post('/create-book-checkout-session', async (req, res) => {
      const paymentInfo = req.body

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'bdt',
              product_data: {
                name: paymentInfo.name,
                description: paymentInfo.description,
                images: [paymentInfo.image],
              },
              unit_amount: paymentInfo.price * 100,
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.customer.email,
        mode: 'payment',
        metadata: {
          bookId: paymentInfo.bookId,
          customer: paymentInfo.customer.email,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/book/${paymentInfo.bookId}`,
      })

      res.send({ url: session.url })
    })

    app.post('/payment-success', async (req, res) => {
      const { sessionId } = req.body
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      const book = await booksCollection.findOne({
        _id: new ObjectId(session.metadata.bookId),
      })

      const existingOrder = await ordersCollection.findOne({
        transactionId: session.payment_intent,
      })

      if (session.status === 'complete' && book && !existingOrder) {
        const orderInfo = {
          bookId: session.metadata.bookId,
          transactionId: session.payment_intent,
          customer: session.metadata.customer,
          status: 'pending',
          paymentStatus: 'paid',
          name: book.name,
          price: session.amount_total / 100,
          image: book.image,
          orderDate: new Date().toISOString(),
        }

        const result = await ordersCollection.insertOne(orderInfo)

        return res.send({
          transactionId: session.payment_intent,
          orderId: result.insertedId,
        })
      }

      res.send(existingOrder)
    })

    app.get('/my-orders/:email', async (req, res) => {
      const result = await ordersCollection
        .find({ customer: req.params.email })
        .toArray()
      res.send(result)
    })

    app.post('/user', async (req, res) => {
      const userData = req.body
      userData.created_at = new Date().toISOString()
      userData.last_loggedIn = new Date().toISOString()
      userData.role = 'user'

      const exists = await usersCollection.findOne({
        email: userData.email,
      })

      if (exists) {
        const result = await usersCollection.updateOne(
          { email: userData.email },
          { $set: { last_loggedIn: new Date().toISOString() } }
        )
        return res.send(result)
      }

      const result = await usersCollection.insertOne(userData)
      res.send(result)
    })

    app.get('/user/role/:email', async (req, res) => {
      const user = await usersCollection.findOne({
        email: req.params.email,
      })
      res.send({ role: user?.role })
    })

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.patch('/update-role', verifyADMIN, async (req, res) => {
      const { email, role } = req.body
      const result = await usersCollection.updateOne(
        { email },
        { $set: { role } }
      )
      res.send(result)
    })

    await client.db('admin').command({ ping: 1 })
    console.log('MongoDB connected')
  } finally {
  }
}

run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from BookHive Server')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
