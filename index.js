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
    origin: ["https://restaurant-app-6cba8.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middlewares
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
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
    // db and collections
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
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/api/v1/logout", async (req, res) => {
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
    });

    // get data
    app.get("/api/v1/all-foods", async (req, res) => {
      const page = parseInt(req.query?.page) || 0;
      const size = parseInt(req.query?.size) || 9;
      const query = {};
      const cursor = foodCollection.find(query);

      const allFoods = await cursor
        .skip(page * size)
        .limit(size)
        .toArray();
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

    app.get("/api/v1/single-food/:id", verifyToken, async (req, res) => {
      // verify token apply
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const singleFood = await foodCollection.findOne(query);
      res.send(singleFood);
    });

    app.get("/api/v1/user/added-foods", verifyToken, async (req, res) => {
      // verify token apply
      const tokenInfo = req.user?.email;
      if (tokenInfo !== req.query?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const page = parseInt(req.query?.page) || 0;
      const size = parseInt(req.query?.size) || 9;
      const Email = req.query.email;
      const query = { userEmail: Email };
      const foodUserAdd = await foodCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      const addedFoodsCount = await foodCollection.find(query).toArray();
      res.send({ foodUserAdd, count: addedFoodsCount.length });
    });

    app.get("/api/v1/cart", verifyToken, async (req, res) => {
      // verify token apply
      const token = req.user.email;
      if (token !== req.query?.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const userEmail = req.query?.email;
      const allOrderInCart = await cartCollection.find().toArray();
      const orderUserMake = allOrderInCart.filter(
        (order) => order?.email === userEmail
      );
      const orderIds = orderUserMake.map(
        (order) => new ObjectId(order?.orderId)
      );
      const orderQuantity = orderUserMake.map((order) => order?.addedQuantity);
      const orderDate = orderUserMake.map((order) => order?.addedTime);
      const query = { _id: { $in: orderIds } };
      const orders = await foodCollection.find(query).toArray();
      res.send({ orders, extra: { quantity: orderQuantity, date: orderDate } });
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

    // update data
    app.patch("/api/v1/update-all-food/:id", async (req, res) => {
      const id = req.params?.id;
      const doc = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          quantity: doc.quantity,
          orderCount: doc.orderCount,
        },
      };
      const result = await foodCollection.updateOne(query, update);
      res.send(result);
    });

    app.put("/api/v1/user/update-added-food/:id", async (req, res) => {
      const id = req.params?.id;
      const { name, category, origin, price, quantity, photo, description } =
        req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updates = {
        $set: {
          name: name,
          category: category,
          origin: origin,
          price: price,
          quantity: quantity,
          img: photo,
          description: description,
        },
      };
      const result = await foodCollection.updateOne(query, updates, options);
      res.send(result);
    });

    // delete data
    app.delete("/api/v1/user/delete-a-added-food/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const cartQuery = { orderId: id };
      const result = await foodCollection.deleteOne(query);
      const cartResult = await cartCollection.deleteOne(cartQuery);
      res.send({ result, cartResult });
    });

    app.delete("/api/v1/user/delete-a-cart-food/:id", async (req, res) => {
      const id = req.params?.id;
      const query = { orderId: id };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("restaurant server is running");
});

// listener
app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
