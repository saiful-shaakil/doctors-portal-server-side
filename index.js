const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

//to verify the user
function verifyUser(req, res, next) {
  const authorization = req.headers.authorization;
  const userToken = authorization.split(" ")[1];
  if (!userToken) {
    return res.status(403).send({ message: "Access Denied" });
  }
  jwt.verify(userToken, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      res.status(403).send({ message: "Invalid Token" });
    }
    req.decoded = decoded;
  });

  next();
}

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@redonion.uipb9.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctorsPortal").collection("services");
    const bookingCollection = client.db("doctorsPortal").collection("booking");
    const userCollection = client.db("doctorsPortal").collection("users");

    //to get all services
    app.get("/treatment", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //to post a booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatmentName: booking.treatmentName,
        date: booking.date,
        patientName: booking.patientName,
      };
      const exist = await bookingCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, booking: exist });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
    //to get booking
    app.get("/booking/:email", verifyUser, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const verifedEmail = req.decoded?.email;
      if (verifedEmail === email) {
        const query = { patientEmail: email };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "Access Denied" });
      }
    });
    //to get admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const admin = user.role === "admin";
      res.send({ admin: admin });
    });
    //for admin
    app.put("/user/admin/:email", verifyUser, async (req, res) => {
      const emailOfUser = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role == "admin") {
        const filter = { email: emailOfUser };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        return res.status(403).send({ message: "Access Denied" });
      }
    });

    //for user
    app.put("/user/:email", async (req, res) => {
      const emailOfUser = req.params.email;
      const filter = { email: emailOfUser };
      const user = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: emailOfUser }, process.env.ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ result, token });
    });

    //to get all user
    app.get("/user", async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });
  } finally {
    //
  }
}
run();

app.get("/", (req, res) => {
  res.send("Doctors Portal server side is running");
});

app.listen(port, () => {
  console.log("running port is", port);
});
