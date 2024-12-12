const express = require("express");
const app = express();
const cors = require("cors");
// const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

//Middleware
app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://stock-management:ph6YdTxdXuD4h3EV@cluster0.gk0tgqc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const dbCollection = client.db("stockManagementDB");
    // const userCollection = dbCollection.collection("users");
    const productCollection = dbCollection.collection("products");

    // Write crud operation
    app.post("/product/add", async (req, res) => {
      const productData = req.body;
      const result = await productCollection.insertOne(productData);
      const query = { _id: new ObjectId(result.insertedId) };
      const product = await productCollection.findOne(query);
      res.status(200).send({ success: result.acknowledged, product: product });
    });

    app.get("/products", async (req, res) => {
      let query = {};
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/product/update/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateProduct = req.body;
      const updateDoc = {
        $set: {
          ...updateProduct,
        },
      };
      const result = await productCollection.updateOne(query, updateDoc);
      const product = await productCollection.findOne(query);
      res.status(200).send({ success: result.acknowledged, product: product });
    });

    app.delete("/product/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      res.status(200).send({ success: result.acknowledged });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//check connect with mongodb
app.get("/", (req, res) => {
  res.send("Stock management server is running");
});
//
app.listen(port, (req, res) => {
  console.log(`Stock management server is running on PORT:${port}`);
});
