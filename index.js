const express = require("express");
const app = express();
const cors = require("cors");
// const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;

//Middleware
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gk0tgqc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    const dbCollection = client.db("stockManagementDB");
    const userCollection = dbCollection.collection("users");
    const productCollection = dbCollection.collection("products");

    // Write crud operation

    // app.get("/user", async (req, res) => {
    //   const { email, password } = req.body;
    //   const query = { email: email, password: password };
    //   const user = await userCollection.findOne(query);
    //   res.status(200).send({
    //     success: true,
    //     user: {
    //       email: user.email,
    //       name: user.name,
    //       image: user.image,
    //       role: user.role,
    //     },
    //   });
    // });

    app.get("/user", async (req, res) => {
      try {
        const { email, password } = req.body;

        // Validate request data
        if (!email || !password) {
          return res.status(400).send({
            success: false,
            message: "Email and password are required.",
          });
        }

        // Query database with projection to exclude password
        const projection = { password: 0 }; // Exclude the password field
        const query = { email, password };
        const user = await userCollection.findOne(query, { projection });

        // Handle cases where no user is found
        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found or invalid credentials.",
          });
        }

        // Send user data without password
        res.status(200).send({
          success: true,
          user,
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({
          success: false,
          message: "Internal server error.",
        });
      }
    });

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
      res.status(200).send({ success: true, products: result });
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
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
