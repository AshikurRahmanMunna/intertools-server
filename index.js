const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send(`Intertools server is running on port ${port}`)
})



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uokvn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        console.log('Database Connected');
        const toolsCollection = client.db('InterTools').collection('products');

        // routes
        app.get('/tools', async(req, res) => {
            const products = await toolsCollection.find({}).toString();
            res.send(products);
        })

        app.post('/tools', async(req, res) => {
            const tool = req.body;
            const result = await toolsCollection.insertOne(tool);
            res.send(result);
        })
    }
    finally {

    }
}
run().catch(console.dir);


app.listen(port, (req, res) => {
    console.log('Intertools Server is running on port', port);
})