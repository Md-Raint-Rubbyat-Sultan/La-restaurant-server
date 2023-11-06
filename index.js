const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middlewares
const verifyToken = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

// MongoDb uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m81o4rz.mongodb.net/?retryWrites=true&w=majority`;

// MongoDB Clint
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("restaurantDb");
    const foodCollection = db.collection("allFoods");
    const userCollection = db.collection("allUsers");
    const cartCollection = db.collection("allCartOrders");

    // auth apis
    app.post("/api/v1/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          // sameSite have to apply
        })
        .send({ success: true });
    });

    app.post("/api/v1/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // get data
    app.get("/api/v1/all-foods", async (req, res) => {
      const query = {};
      const allFoods = await foodCollection.find(query).toArray();
      const foodsCount = await foodCollection.estimatedDocumentCount();
      res.send({ allFoods, count: foodsCount });
    });

    app.get("/api/v1/popular-foods", async (req, res) => {
      const query = {};
      const popularFoods = await foodCollection
        .find(query)
        .sort({ orderCount: -1 })
        .toArray();
      res.send(popularFoods.slice(0, 6));
    });

    app.get("/api/v1/single-food/:id", async (req, res) => {
      // verify token apply
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const singleFood = await foodCollection.findOne(query);
      res.send(singleFood);
    });

    app.get("/api/v1/user/added-foods", async (req, res) => {
      // verify token apply
      const Email = req.query.email;
      const query = { userEmail: Email };
      const foodUserAdd = await foodCollection.find(query).toArray();
      res.send(foodUserAdd);
    });

    // post data
    app.post("/api/v1/add-a-food", async (req, res) => {
      const foodInfo = req.body;
      const addFood = await foodCollection.insertOne(foodInfo);
      res.send(addFood);
    });

    app.post("/api/v1/add-a-user", async (req, res) => {
      const userInfo = req.body;
      const addUser = await userCollection.insertOne(userInfo);
      res.send(addUser);
    });

    app.post("/api/v1/food-orders", async (req, res) => {
      const order = req.body;
      const orderedFood = await cartCollection.insertOne(order);
      res.send(orderedFood);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
};
run().catch(console.dir);

app.get("/api/v1", (req, res) => {
  res.send("restaurant server is running");
});

// listener
app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
