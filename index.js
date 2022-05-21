const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send(`Intertools server is running on port ${port}`)
})

app.listen(port, (req, res) => {
    console.log('Intertools Server is running on port', port);
})