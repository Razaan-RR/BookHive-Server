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
    const reviewsCollection = db.collection('reviews')

    const verifyADMIN = async (req, res, next) => {
      const { adminEmail } = req.body
      const user = await usersCollection.findOne({ email: adminEmail })
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
      res.send(await booksCollection.find().toArray())
    })

    app.get('/books/latest', async (req, res) => {
      const limit = Number(req.query.limit) || 6
      res.send(
        await booksCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray()
      )
    })

    app.get('/book/:id', async (req, res) => {
      res.send(
        await booksCollection.findOne({ _id: new ObjectId(req.params.id) })
      )
    })

    app.post('/orders', async (req, res) => {
      const { customer, bookId, name, price, customerInfo } = req.body

      if (!customer || !bookId || !name || !price) {
        return res.status(400).send({ message: 'Missing required fields' })
      }

      const order = {
        bookId,
        name,
        price,
        customer,
        customerInfo,
        status: 'pending',
        paymentStatus: 'unpaid',
        orderDate: new Date().toISOString(),
      }

      const result = await ordersCollection.insertOne(order)
      res.send({ ...order, _id: result.insertedId })
    })

    app.patch('/orders/cancel/:id', async (req, res) => {
      const { id } = req.params
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id), status: 'pending' },
        { $set: { status: 'cancelled' } }
      )

      if (result.modifiedCount === 0) {
        return res
          .status(400)
          .send({ message: 'Order not found or already processed' })
      }

      res.send({ success: true })
    })

    app.get('/my-orders/:email', async (req, res) => {
      res.send(
        await ordersCollection.find({ customer: req.params.email }).toArray()
      )
    })

    app.get('/librarian/orders', async (req, res) => {
      const orders = await ordersCollection
        .find()
        .sort({ orderDate: -1 })
        .toArray()

      res.send(orders)
    })

    app.patch('/orders/status/:id', async (req, res) => {
      const { id } = req.params
      const { status } = req.body

      if (!status)
        return res.status(400).send({ message: 'Status is required' })

      try {
        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        )

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: 'Order not found or already has this status' })
        }

        res.send({ success: true, status })
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to update status' })
      }
    })

    app.get('/librarian/orders', verifyLIBRARIAN, async (req, res) => {
      try {
        const orders = await ordersCollection
          .find()
          .sort({ orderDate: -1 })
          .toArray()
        res.send(orders)
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to fetch orders' })
      }
    })

    app.get('/my-orders/:email', async (req, res) => {
      try {
        const email = req.params.email
        const orders = await ordersCollection
          .find({ customer: email })
          .sort({ orderDate: -1 })
          .toArray()
        res.send(orders)
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to fetch your orders' })
      }
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
          orderId: paymentInfo.orderId,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/my-orders`,
      })

      res.send({ url: session.url })
    })

    app.post('/payment-success', async (req, res) => {
      const { sessionId } = req.body
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      if (session.status === 'complete') {
        await ordersCollection.updateOne(
          { _id: new ObjectId(session.metadata.orderId) },
          {
            $set: {
              paymentStatus: 'paid',
              transactionId: session.payment_intent,
              paidAt: new Date().toISOString(),
            },
          }
        )

        return res.send({ success: true })
      }

      res.send({ success: false })
    })

    app.get('/invoices/:email', async (req, res) => {
      const email = req.params.email
      const invoices = await ordersCollection
        .find({ customer: email, paymentStatus: 'paid' })
        .toArray()
      res.send(invoices)
    })

    app.post('/user', async (req, res) => {
      const userData = {
        ...req.body,
        created_at: new Date().toISOString(),
        last_loggedIn: new Date().toISOString(),
        role: 'user',
      }

      const exists = await usersCollection.findOne({ email: userData.email })

      if (exists) {
        return res.send(
          await usersCollection.updateOne(
            { email: userData.email },
            { $set: { last_loggedIn: new Date().toISOString() } }
          )
        )
      }

      res.send(await usersCollection.insertOne(userData))
    })

    app.get('/user/role/:email', async (req, res) => {
      const user = await usersCollection.findOne({ email: req.params.email })
      res.send({ role: user?.role })
    })

    app.get('/users', async (req, res) => {
      res.send(await usersCollection.find().toArray())
    })

    app.patch('/update-role', async (req, res) => {
      try {
        const { adminEmail, email, role } = req.body

        if (!adminEmail || !email || !role) {
          return res.status(400).send({ message: 'Missing required fields' })
        }

        const adminUser = await usersCollection.findOne({ email: adminEmail })
        if (!adminUser) {
          return res.status(403).send({ message: 'Admin not found' })
        }

        if (adminUser.role !== 'admin') {
          return res.status(403).send({ message: 'Admin only' })
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { role } }
        )

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: 'User not found or role unchanged' })
        }

        res.send({ success: true })
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to update role' })
      }
    })

    app.post('/wishlist/add', async (req, res) => {
      const { email, bookId } = req.body
      const book = await booksCollection.findOne({ _id: new ObjectId(bookId) })
      res.send(
        await usersCollection.updateOne(
          { email },
          { $addToSet: { wishlist: book } }
        )
      )
    })

    app.post('/wishlist/remove', async (req, res) => {
      const { email, bookId } = req.body
      res.send(
        await usersCollection.updateOne(
          { email },
          { $pull: { wishlist: { _id: new ObjectId(bookId) } } }
        )
      )
    })

    app.get('/wishlist/:email', async (req, res) => {
      const user = await usersCollection.findOne({ email: req.params.email })
      res.send(user?.wishlist || [])
    })

    app.post('/review', async (req, res) => {
      const { email, bookId, rating, review } = req.body

      const order = await ordersCollection.findOne({
        bookId,
        customer: email,
        paymentStatus: 'paid',
      })

      if (!order) return res.status(403).send({ message: 'Order required' })

      res.send(
        await reviewsCollection.insertOne({
          bookId,
          user: email,
          rating,
          review,
          createdAt: new Date(),
        })
      )
    })

    app.get('/reviews/:bookId', async (req, res) => {
      res.send(
        await reviewsCollection
          .find({ bookId: req.params.bookId })
          .sort({ createdAt: -1 })
          .toArray()
      )
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
