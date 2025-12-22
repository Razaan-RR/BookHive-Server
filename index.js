// require('dotenv').config()
// const express = require('express')
// const cors = require('cors')
// const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
// const admin = require('firebase-admin')

// const port = process.env.PORT || 3000

// const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
//   'utf-8'
// )
// const serviceAccount = JSON.parse(decoded)

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// })

// const app = express()

// app.use(
//   cors({
//     origin: [process.env.CLIENT_DOMAIN],
//     credentials: true,
//     optionSuccessStatus: 200,
//   })
// )
// app.use(express.json())

// const client = new MongoClient(process.env.MONGODB_URI, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// })

// async function run() {
//   try {
//     const db = client.db('booksDB')
//     const booksCollection = db.collection('books')
//     const ordersCollection = db.collection('orders')
//     const usersCollection = db.collection('users')
//     const reviewsCollection = db.collection('reviews')

//     const verifyADMIN = async (req, res, next) => {
//       const { adminEmail } = req.body
//       const user = await usersCollection.findOne({ email: adminEmail })
//       if (user?.role !== 'admin')
//         return res.status(403).send({ message: 'Admin only' })
//       next()
//     }

//     const verifyLIBRARIAN = async (req, res, next) => {
//       const { email } = req.body
//       const user = await usersCollection.findOne({ email })
//       if (user?.role !== 'librarian')
//         return res.status(403).send({ message: 'Librarian only' })
//       next()
//     }

//     app.post('/books', verifyLIBRARIAN, async (req, res) => {
//       const book = req.body
//       book.createdAt = new Date()
//       const result = await booksCollection.insertOne(book)
//       res.send(result)
//     })

//     app.get('/books', async (req, res) => {
//       res.send(await booksCollection.find().toArray())
//     })

//     app.delete('/books/:id', async (req, res) => {
//       try {
//         const { id } = req.params
//         const { adminEmail } = req.body

//         const adminUser = await usersCollection.findOne({ email: adminEmail })
//         if (adminUser?.role !== 'admin') {
//           return res.status(403).send({ message: 'Admin only' })
//         }

//         await ordersCollection.deleteMany({ bookId: id })
//         const result = await booksCollection.deleteOne({
//           _id: new ObjectId(id),
//         })

//         if (result.deletedCount === 0) {
//           return res.status(404).send({ message: 'Book not found' })
//         }

//         res.send({ success: true })
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to delete book' })
//       }
//     })

//     app.get('/books/latest', async (req, res) => {
//       const limit = Number(req.query.limit) || 6
//       res.send(
//         await booksCollection
//           .find()
//           .sort({ createdAt: -1 })
//           .limit(limit)
//           .toArray()
//       )
//     })

//     app.get('/book/:id', async (req, res) => {
//       res.send(
//         await booksCollection.findOne({ _id: new ObjectId(req.params.id) })
//       )
//     })

//     app.patch('/books/update/:id', async (req, res) => {
//       const { id } = req.params
//       const updateData = req.body

//       try {
//         const result = await booksCollection.updateOne(
//           { _id: new ObjectId(id) },
//           { $set: updateData }
//         )

//         if (result.modifiedCount === 0) {
//           return res.status(404).send({ message: 'Book not updated' })
//         }

//         res.send({ success: true })
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to update book' })
//       }
//     })

//     app.patch('/books/status/:id', async (req, res) => {
//       const { id } = req.params
//       const { status } = req.body

//       if (!status) {
//         return res.status(400).send({ message: 'Status required' })
//       }

//       try {
//         const result = await booksCollection.updateOne(
//           { _id: new ObjectId(id) },
//           { $set: { status } }
//         )

//         if (result.modifiedCount === 0) {
//           return res.status(404).send({ message: 'Status not changed' })
//         }

//         res.send({ success: true, status })
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to update status' })
//       }
//     })

//     app.get('/books/librarian/:email', async (req, res) => {
//       try {
//         const email = req.params.email
//         const books = await booksCollection.find({ email }).toArray()
//         res.send(books)
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to fetch librarian books' })
//       }
//     })

//     app.post('/orders', async (req, res) => {
//       const { customer, bookId, name, price, customerInfo } = req.body

//       if (!customer || !bookId || !name || !price) {
//         return res.status(400).send({ message: 'Missing required fields' })
//       }

//       const order = {
//         bookId,
//         name,
//         price,
//         customer,
//         customerInfo,
//         status: 'pending',
//         paymentStatus: 'unpaid',
//         orderDate: new Date().toISOString(),
//       }

//       const result = await ordersCollection.insertOne(order)
//       res.send({ ...order, _id: result.insertedId })
//     })

//     app.patch('/orders/cancel/:id', async (req, res) => {
//       const { id } = req.params
//       const result = await ordersCollection.updateOne(
//         { _id: new ObjectId(id), status: 'pending' },
//         { $set: { status: 'cancelled' } }
//       )

//       if (result.modifiedCount === 0) {
//         return res
//           .status(400)
//           .send({ message: 'Order not found or already processed' })
//       }

//       res.send({ success: true })
//     })

//     app.patch('/orders/status/:id', async (req, res) => {
//       const { id } = req.params
//       const { status } = req.body

//       if (!status)
//         return res.status(400).send({ message: 'Status is required' })

//       try {
//         const result = await ordersCollection.updateOne(
//           { _id: new ObjectId(id) },
//           { $set: { status } }
//         )

//         if (result.modifiedCount === 0) {
//           return res
//             .status(404)
//             .send({ message: 'Order not found or already has this status' })
//         }

//         res.send({ success: true, status })
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to update status' })
//       }
//     })

//     app.get('/librarian/orders', verifyLIBRARIAN, async (req, res) => {
//       try {
//         const orders = await ordersCollection
//           .find()
//           .sort({ orderDate: -1 })
//           .toArray()
//         res.send(orders)
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to fetch orders' })
//       }
//     })

//     app.get('/my-orders/:email', async (req, res) => {
//       try {
//         const email = req.params.email
//         const orders = await ordersCollection
//           .find({ customer: email })
//           .sort({ orderDate: -1 })
//           .toArray()
//         res.send(orders)
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to fetch your orders' })
//       }
//     })

//     app.post('/create-book-checkout-session', async (req, res) => {
//       const paymentInfo = req.body

//       const session = await stripe.checkout.sessions.create({
//         line_items: [
//           {
//             price_data: {
//               currency: 'bdt',
//               product_data: {
//                 name: paymentInfo.name,
//                 description: paymentInfo.description,
//                 images: [paymentInfo.image],
//               },
//               unit_amount: paymentInfo.price * 100,
//             },
//             quantity: 1,
//           },
//         ],
//         customer_email: paymentInfo.customer.email,
//         mode: 'payment',
//         metadata: {
//           orderId: paymentInfo.orderId,
//         },
//         success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/my-orders`,
//       })

//       res.send({ url: session.url })
//     })

//     app.post('/payment-success', async (req, res) => {
//       const { sessionId } = req.body
//       const session = await stripe.checkout.sessions.retrieve(sessionId)

//       if (session.status === 'complete') {
//         await ordersCollection.updateOne(
//           { _id: new ObjectId(session.metadata.orderId) },
//           {
//             $set: {
//               paymentStatus: 'paid',
//               transactionId: session.payment_intent,
//               paidAt: new Date().toISOString(),
//             },
//           }
//         )

//         return res.send({ success: true })
//       }

//       res.send({ success: false })
//     })

//     app.get('/invoices/:email', async (req, res) => {
//       const email = req.params.email
//       const invoices = await ordersCollection
//         .find({ customer: email, paymentStatus: 'paid' })
//         .toArray()
//       res.send(invoices)
//     })

//     app.post('/user', async (req, res) => {
//       const { email, name, uid, photoURL } = req.body
//       const now = new Date().toISOString()

//       const exists = await usersCollection.findOne({ email })

//       if (exists) {
//         const updatedData = {
//           last_loggedIn: now,
//           name: name || exists.name,
//           photoURL: photoURL || exists.photoURL,
//           uid: uid || exists.uid,
//         }

//         const result = await usersCollection.updateOne(
//           { email },
//           { $set: updatedData }
//         )
//         return res.send(result)
//       }

//       const newUser = {
//         email,
//         name,
//         uid,
//         photoURL,
//         role: 'user',
//         created_at: now,
//         last_loggedIn: now,
//       }

//       const result = await usersCollection.insertOne(newUser)
//       res.send(result)
//     })

//     app.get('/user/role/:email', async (req, res) => {
//       const user = await usersCollection.findOne({ email: req.params.email })
//       res.send({ role: user?.role })
//     })

//     app.get('/users', async (req, res) => {
//       res.send(await usersCollection.find().toArray())
//     })

//     app.patch('/update-role', async (req, res) => {
//       try {
//         const { adminEmail, email, role } = req.body

//         if (!adminEmail || !email || !role) {
//           return res.status(400).send({ message: 'Missing required fields' })
//         }

//         const adminUser = await usersCollection.findOne({ email: adminEmail })
//         if (!adminUser) {
//           return res.status(403).send({ message: 'Admin not found' })
//         }

//         if (adminUser.role !== 'admin') {
//           return res.status(403).send({ message: 'Admin only' })
//         }

//         const result = await usersCollection.updateOne(
//           { email },
//           { $set: { role } }
//         )

//         if (result.modifiedCount === 0) {
//           return res
//             .status(404)
//             .send({ message: 'User not found or role unchanged' })
//         }

//         res.send({ success: true })
//       } catch (err) {
//         console.error(err)
//         res.status(500).send({ message: 'Failed to update role' })
//       }
//     })

//     app.post('/wishlist/add', async (req, res) => {
//       const { email, bookId } = req.body
//       const book = await booksCollection.findOne({ _id: new ObjectId(bookId) })
//       res.send(
//         await usersCollection.updateOne(
//           { email },
//           { $addToSet: { wishlist: book } }
//         )
//       )
//     })

//     app.post('/wishlist/remove', async (req, res) => {
//       const { email, bookId } = req.body
//       res.send(
//         await usersCollection.updateOne(
//           { email },
//           { $pull: { wishlist: { _id: new ObjectId(bookId) } } }
//         )
//       )
//     })

//     app.get('/wishlist/:email', async (req, res) => {
//       const user = await usersCollection.findOne({ email: req.params.email })
//       res.send(user?.wishlist || [])
//     })

//     app.post('/review', async (req, res) => {
//       const { email, bookId, rating, review } = req.body

//       const order = await ordersCollection.findOne({
//         bookId,
//         customer: email,
//         paymentStatus: 'paid',
//       })

//       if (!order) return res.status(403).send({ message: 'Order required' })

//       res.send(
//         await reviewsCollection.insertOne({
//           bookId,
//           user: email,
//           rating,
//           review,
//           createdAt: new Date(),
//         })
//       )
//     })

//     app.get('/reviews/:bookId', async (req, res) => {
//       res.send(
//         await reviewsCollection
//           .find({ bookId: req.params.bookId })
//           .sort({ createdAt: -1 })
//           .toArray()
//       )
//     })

//     await client.db('admin').command({ ping: 1 })
//     console.log('MongoDB connected')
//   } finally {
//   }
// }

// run().catch(console.dir)

// app.get('/', (req, res) => {
//   res.send('Hello from BookHive Server')
// })

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`)
// })

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

// --- NEW: Middleware to verify Firebase token ---
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).send({ message: 'Unauthorized' })
    }
    const token = authHeader.split(' ')[1]
    const decodedToken = await admin.auth().verifyIdToken(token)
    req.user = decodedToken
    next()
  } catch (err) {
    console.error(err)
    res.status(401).send({ message: 'Invalid or expired token' })
  }
}

// --- UPDATED: Use req.user.email for role verification ---
async function run() {
  try {
    const db = client.db('booksDB')
    const booksCollection = db.collection('books')
    const ordersCollection = db.collection('orders')
    const usersCollection = db.collection('users')
    const reviewsCollection = db.collection('reviews')

    const verifyADMIN = async (req, res, next) => {
      const user = await usersCollection.findOne({ email: req.user.email })
      if (user?.role !== 'admin')
        return res.status(403).send({ message: 'Admin only' })
      next()
    }

    const verifyLIBRARIAN = async (req, res, next) => {
      const user = await usersCollection.findOne({ email: req.user.email })
      if (user?.role !== 'librarian')
        return res.status(403).send({ message: 'Librarian only' })
      next()
    }

    app.post('/books', verifyToken, verifyLIBRARIAN, async (req, res) => {
      const book = req.body
      book.createdAt = new Date()
      const result = await booksCollection.insertOne(book)
      res.send(result)
    })

    app.get('/books', async (req, res) => {
      res.send(await booksCollection.find().toArray())
    })

    app.delete('/books/:id', verifyToken, verifyADMIN, async (req, res) => {
      try {
        const { id } = req.params

        await ordersCollection.deleteMany({ bookId: id })
        const result = await booksCollection.deleteOne({
          _id: new ObjectId(id),
        })

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Book not found' })
        }

        res.send({ success: true })
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to delete book' })
      }
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

    app.patch('/books/update/:id', verifyToken, verifyLIBRARIAN, async (req, res) => {
      const { id } = req.params
      const updateData = req.body

      try {
        const result = await booksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        )

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: 'Book not updated' })
        }

        res.send({ success: true })
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to update book' })
      }
    })

    app.patch('/books/status/:id', verifyToken, verifyLIBRARIAN, async (req, res) => {
      const { id } = req.params
      const { status } = req.body

      if (!status) {
        return res.status(400).send({ message: 'Status required' })
      }

      try {
        const result = await booksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        )

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: 'Status not changed' })
        }

        res.send({ success: true, status })
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to update status' })
      }
    })

    app.get('/books/librarian/:email', async (req, res) => {
      try {
        const email = req.params.email
        const books = await booksCollection.find({ email }).toArray()
        res.send(books)
      } catch (err) {
        console.error(err)
        res.status(500).send({ message: 'Failed to fetch librarian books' })
      }
    })

    app.post('/orders', verifyToken, async (req, res) => {
      const { bookId, name, price, customerInfo } = req.body
      const customer = req.user.email

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

    app.patch('/orders/cancel/:id', verifyToken, async (req, res) => {
      const { id } = req.params
      const customer = req.user.email

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id), status: 'pending', customer },
        { $set: { status: 'cancelled' } }
      )

      if (result.modifiedCount === 0) {
        return res
          .status(400)
          .send({ message: 'Order not found or already processed' })
      }

      res.send({ success: true })
    })

    app.patch('/orders/status/:id', verifyToken, verifyADMIN, async (req, res) => {
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

    app.get('/librarian/orders', verifyToken, verifyLIBRARIAN, async (req, res) => {
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

    app.get('/my-orders/:email', verifyToken, async (req, res) => {
      try {
        const email = req.user.email
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

    app.post('/create-book-checkout-session', verifyToken, async (req, res) => {
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
        customer_email: req.user.email,
        mode: 'payment',
        metadata: {
          orderId: paymentInfo.orderId,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/my-orders`,
      })

      res.send({ url: session.url })
    })

    app.post('/payment-success', verifyToken, async (req, res) => {
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

    app.get('/invoices/:email', verifyToken, async (req, res) => {
      const email = req.user.email
      const invoices = await ordersCollection
        .find({ customer: email, paymentStatus: 'paid' })
        .toArray()
      res.send(invoices)
    })

    app.post('/user', verifyToken, async (req, res) => {
      const { email, name, uid, photoURL } = req.body
      const now = new Date().toISOString()

      const exists = await usersCollection.findOne({ email })

      if (exists) {
        const updatedData = {
          last_loggedIn: now,
          name: name || exists.name,
          photoURL: photoURL || exists.photoURL,
          uid: uid || exists.uid,
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: updatedData }
        )
        return res.send(result)
      }

      const newUser = {
        email,
        name,
        uid,
        photoURL,
        role: 'user',
        created_at: now,
        last_loggedIn: now,
      }

      const result = await usersCollection.insertOne(newUser)
      res.send(result)
    })

    app.get('/user/role/:email', verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.params.email })
      res.send({ role: user?.role })
    })

    app.get('/users', verifyToken, async (req, res) => {
      res.send(await usersCollection.find().toArray())
    })

    app.patch('/update-role', verifyToken, verifyADMIN, async (req, res) => {
      try {
        const { email, role } = req.body

        if (!email || !role) {
          return res.status(400).send({ message: 'Missing required fields' })
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

    app.post('/wishlist/add', verifyToken, async (req, res) => {
      const { bookId } = req.body
      const email = req.user.email
      const book = await booksCollection.findOne({ _id: new ObjectId(bookId) })
      res.send(
        await usersCollection.updateOne(
          { email },
          { $addToSet: { wishlist: book } }
        )
      )
    })

    app.post('/wishlist/remove', verifyToken, async (req, res) => {
      const { bookId } = req.body
      const email = req.user.email
      res.send(
        await usersCollection.updateOne(
          { email },
          { $pull: { wishlist: { _id: new ObjectId(bookId) } } }
        )
      )
    })

    app.get('/wishlist/:email', verifyToken, async (req, res) => {
      const email = req.user.email
      const user = await usersCollection.findOne({ email })
      res.send(user?.wishlist || [])
    })

    app.post('/review', verifyToken, async (req, res) => {
      const { bookId, rating, review } = req.body
      const email = req.user.email

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
