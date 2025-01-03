const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5001;

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gk0tgqc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const dbCollection = client.db("stockManagementDB");
    const userCollection = dbCollection.collection("users");
    const productCollection = dbCollection.collection("products");
    const historyCollection = dbCollection.collection("history");

    // GET /user: Fetch user data (without password)

    app.post("/create-user", async (req, res) => {
      try {
        const { fullName, email, password } = req.body;

        console.log("/create-user", fullName);

        // Input Validation
        if (!email || !password || !fullName) {
          return res.status(400).json({
            success: false,
            message: "Full Name, Email, and password are required.",
          });
        }

        // Check if user already exists
        const existingUser = await userCollection.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "A user with this email already exists.",
          });
        }

        // Create the user object with role "user"
        const newUser = {
          fullName,
          email: email.toLowerCase(),
          password,
          role: "user",
          createdAt: new Date(),
        };

        // Insert the new user into the database
        const result = await userCollection.insertOne(newUser);

        // Respond with success (you might want to exclude the password in the response)
        return res.status(201).json({
          success: true,
          message: "User created successfully.",
          user: {
            id: result.insertedId,
            fullName: newUser.fullName,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
          },
        });
      } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({
          success: false,
          message: "An error occurred while creating the user.",
        });
      }
    });

    app.post("/user", async (req, res) => {
      try {
        const { email, password } = req.body; // Get email and password from the request body
        console.log("/user", email);

        if (!email || !password) {
          return res.status(400).json({
            success: false,
            message: "Email and password are required.",
          });
        }

        const projection = { password: 0 };
        const query = { email, password };
        const user = await userCollection.findOne(query, { projection });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found or invalid credentials.",
          });
        }

        res.status(200).json({
          success: true,
          user,
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error.",
        });
      }
    });

    // POST /product/add: Add new product
    app.post("/product/add", async (req, res) => {
      const { name, stockQuantity, image } = req.body;
      console.log("/product/add", name);
      if (!name) {
        return res.status(400).json({ success: false, message: "Name and stock quantity are required." });
      }
      try {
        const result = await productCollection.insertOne({
          name,
          date: new Date(),
          stockQuantity: parseInt(stockQuantity) || 0,
          image: image || null,
        });
        const product = await productCollection.findOne({ _id: result.insertedId });
        res.status(200).json({ success: true, product });
      } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });

    // GET /products: Get all products
    app.get("/products", async (req, res) => {
      try {
        const products = await productCollection.find({}).sort({ date: -1 }).toArray();
        res.status(200).json({ success: true, products });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });

    // GET /histories: Get all history records
    app.get("/histories", async (req, res) => {
      try {
        const stockIn = await historyCollection
          .find({ type: { $ne: "out" } })
          .sort({ date: -1 })
          .toArray();
        const stockOut = await historyCollection
          .find({ type: { $ne: "in" } })
          .sort({ date: -1 })
          .toArray();
        res.status(200).json({ success: true, stockIn, stockOut });
      } catch (error) {
        console.error("Error fetching histories:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      }
    });

    // PATCH /product/update/:id: Update product stock
    app.patch("/product/update/:id", async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
      }

      const query = { _id: new ObjectId(id) };
      let { type, stockQuantity, date, name, userEmail } = req.body;

      const user = await userCollection.findOne({ email: userEmail.toLowerCase() });

      stockQuantity = Number(stockQuantity);

      if (!["in", "out"].includes(type) || isNaN(stockQuantity) || !date) {
        return res.status(400).json({ success: false, message: "Invalid update data." });
      }

      const increment = type === "in" ? stockQuantity : -stockQuantity;

      try {
        const updateDoc = {
          $inc: { stockQuantity: increment },
          $set: { date: new Date(date) },
        };

        const result = await productCollection.updateOne(query, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Product not found." });
        }

        const updatedProduct = await productCollection.findOne(query);

        const historyResult = await historyCollection.insertOne({
          name,
          date,
          type,
          stockQuantity: parseInt(stockQuantity),
          productId: id,
          user: {
            fullName: user.fullName,
          },
        });
        const historyQuery = { _id: new ObjectId(historyResult.insertedId) };
        const history = await historyCollection.findOne(historyQuery);

        return res.status(200).json({ success: result.acknowledged, product: updatedProduct, history });
      } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
      }
    });

    app.delete("/product/delete/:id", async (req, res) => {
      const id = req.params.id;

      console.log(id);

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid product ID." });
      }

      const filter = { _id: new ObjectId(id) };

      const session = client.startSession(); // Assuming 'client' is your MongoDB client

      try {
        await session.withTransaction(async () => {
          // Delete the product
          const deleteResult = await productCollection.deleteOne(filter, { session });
          if (deleteResult.deletedCount === 0) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Product not found." });
          }

          // Update historyCollection: Set productId to null where it matches the deleted product's ID
          const updateResult = await historyCollection.updateMany(
            { productId: id }, // Assuming productId is stored as a string
            { $set: { productId: null } },
            { session }
          );

          // Optionally, you can log how many documents were updated
          console.log(`Updated ${updateResult.modifiedCount} history records.`);
        });

        res.status(200).json({ success: true, message: "Product deleted and history updated successfully." });
      } catch (error) {
        console.error("Error deleting product and updating history:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
      } finally {
        await session.endSession();
      }
    });

    // DELETE /history/delete/:id: Delete history and update product stock
    app.delete("/history/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      try {
        const history = await historyCollection.findOne(filter);
        if (!history) {
          return res.status(404).json({ success: false, message: "History not found" });
        }

        const increment = history.type === "in" ? -history.stockQuantity : history.stockQuantity;

        console.log(`Adjusting stock by: ${increment}`);

        const updateDoc = {
          $inc: { stockQuantity: increment },
          $set: { date: new Date() },
        };

        const productUpdateResult = await productCollection.updateOne({ _id: new ObjectId(history.productId) }, updateDoc);

        if (productUpdateResult.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Product not found or stock update failed" });
        }

        const result = await historyCollection.deleteOne(filter);
        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: "Failed to delete history" });
        }

        res.status(200).json({ success: true, message: "History record deleted and product stock updated" });
      } catch (error) {
        console.error("Error deleting history or updating product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
      }
    });

    app.get("/*", (req, res) => {
      res.send("Stock management server is running");
    });
  } catch (error) {
    console.error("Error during MongoDB connection:", error);
    process.exit(1);
  } finally {
    // Optionally, you can close the connection when the app shuts down
    // await client.close();
  }
}

run().catch((error) => {
  console.error("MongoDB connection failed:", error);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Stock management server is running on PORT: ${port}`);
});
