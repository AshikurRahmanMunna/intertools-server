const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.send(`Intertools server is running on port ${port}`);
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uokvn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const accessToken = req.headers.authorization;
  if (!accessToken) {
    res.status(401).send({ message: "Unauthorized Access" });
  } else {
    const token = accessToken.split(" ")[0];
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
    const toolsCollection = client.db("InterTools").collection("products");
    const usersCollection = client.db("InterTools").collection("products");

    // routes
    app.get("/tools", async (req, res) => {
      const products = await toolsCollection.find({}).toArray();
      res.send(products);
    });

    app.get("/toolsByLimit", async (req, res) => {
      const limit = req.query.limit;
      const products = await toolsCollection
        .find({})
        .limit(parseInt(limit))
        .toArray();
      res.send(products);
    });

    app.post("/tools", async (req, res) => {
      const tool = req.body;
      const result = await toolsCollection.insertOne(tool);
      res.send(result);
    });

    app.put("/user/email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email};
      const options = {upsert: true};
      const updateDoc = {
        $set: user
      }
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ result, token });
    });
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, (req, res) => {
  console.log("Intertools Server is running on port", port);
});
