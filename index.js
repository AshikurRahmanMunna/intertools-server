const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send(`Intertools server is running on port ${port}`);
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uokvn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ message: "Unauthorized Access" });
  } else {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
      if (error) {
        res.status(403).send({ message: "Forbidden Access" });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("Database Connected");
    const toolsCollection = client.db("InterTools").collection("tools");
    const usersCollection = client.db("InterTools").collection("users");
    const ordersCollection = client.db("InterTools").collection("orders");
    const reviewsCollection = client.db("InterTools").collection("reviews");
    const paymentCollection = client.db("InterTools").collection("payments");

    // verify that user an admin middleware
    const verifyAdmin = async (req, res, next) => {
      const requesterEmail = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({
        email: requesterEmail,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    };
    // routes

    app.post('/create-payment-intent', verifyJWT, async(req, res) => {
      const tool = req.body;
      const price = tool.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency: 'usd',
        payment_method_types:['card']
      });
      res.send({clientSecret: paymentIntent.client_secret})
    });


    app.get("/tools", async (req, res) => {
      const tools = await toolsCollection.find({}).toArray();
      res.send(tools);
    });

    app.get("/toolsByLimit", async (req, res) => {
      const limit = req.query.limit;
      const tools = await toolsCollection
        .find({})
        .limit(parseInt(limit))
        .toArray();
      res.send(tools);
    });

    app.get("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const tool = await toolsCollection.findOne({ _id: ObjectId(id) });
      res.send(tool);
    });

    app.post("/tools", verifyJWT, async (req, res) => {
      const tool = req.body;
      const result = await toolsCollection.insertOne(tool);
      res.send(result);
    });
    
    app.delete('/tools/:id', async(req, res) => {
      const id = req.params.id;
      const result = await toolsCollection.deleteOne({_id: ObjectId(id)});
      res.send(result);
    })

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, token });
    });

    app.get("/user", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requesterEmail = req.decoded.email;
      if (email === requesterEmail) {
        const user = await usersCollection.findOne({ email: email });
        res.send(user);
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    });

    app.put("/updateUser/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const requesterEmail = req.decoded.email;
      if (email === requesterEmail) {
        const filter = { email: email };
        const updateDoc = {
          $set: req.body,
        };
        const options = { upsert: true };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    });

    app.put("/makeAdmin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: req.body,
      };
      const options = { upsert: true };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email: email });
      const isAdmin = result?.role === "admin";
      res.send({ isAdmin });
    });
    
    app.get('/order', verifyJWT, verifyAdmin, async(req, res) => {
      const orders = await ordersCollection.find({}).toArray();
      res.send(orders);
    })

    app.get("/orderById/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const order = await ordersCollection.findOne({ _id: ObjectId(id) });
      res.send(order);
    });

    app.post("/order", verifyJWT, async (req, res) => {
      const order = req.body;
      const toolId = req.query.toolId;
      const newQuantity = req.query.newQuantity;
      const filter = {_id: ObjectId(toolId)};
      const updateDoc = {
        $set: {
          availableQuantity: newQuantity
        }
      }
      const updated = await toolsCollection.updateOne(filter, updateDoc);
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.delete("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const toolId = req.query.toolId;
      const newQuantity = req.query.newQuantity;
      const filter = {_id: ObjectId(toolId)};
      const updateDoc = {
        $set: {
          availableQuantity: parseInt(newQuantity)
        }
      }
      const updated = await toolsCollection.updateOne(filter, updateDoc);
      const result = await ordersCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    app.get("/order/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodeEmail = req.decoded.email;
      if (email === decodeEmail) {
        const orders = await ordersCollection.find({ email: email }).toArray();
        res.send(orders);
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    });

    app.patch('/order/:id', verifyJWT, async(req, res) =>{
      const id  = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          isPaid: true,
          transactionId: payment.transactionId
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(updatedBooking);
      console.log(payment.availableQuantity - payment.quantity)
    })

    app.put('/order/:id', verifyJWT, async(req, res) => {
      const id = req.params.id;
      const filter = {_id: ObjectId(id)};
      const updateDoc = {
        $set: req.body
      }
      const options = {upsert: true};
      const result = await ordersCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })

    app.get("/reviews", async (req, res) => {
      const reviews = await reviewsCollection.find({}).toArray();
      res.send(reviews);
    });

    app.post("/reviews", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, (req, res) => {
  console.log("Intertools Server is running on port", port);
});
