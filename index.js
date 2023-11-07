const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.port || 5000;

// middleware
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// custom middleware to check logs
const logger = async (req, res, next) => {
  const start = Date.now();
  console.log(
    'Request from : ',
    req.hostname,
    req.url,
    'IP Address: ',
    req.ip,
    'Timestamp: ',
    new Date(),
    'Method: ',
    req.method
  );
  res.on('finish', () => {
    const end = Date.now();
    console.log('Request took: ', end - start, 'ms');
  });

  next();
};

app.get('/', (req, res) => {
  res.send('Assignment Data Will Add Soon');
});
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ko1sj04.mongodb.net/?retryWrites=true&w=majority`;

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

    const database = client.db('RateMyProjectDB');
    const projectCollection = database.collection('projectCollection');
    const submittedProjectCollection = database.collection(
      'submittedProjectCollection'
    );

    // post project data
    app.post('/projects', async (req, res) => {
      const newProjectData = req.body;
      console.log(newProjectData);
      const result = await projectCollection.insertOne(newProjectData);
      res.send(result);
    });

    // get all  project data
    app.get('/projects', async (req, res) => {
      const cursor = projectCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // get  project data by id
    app.get('/project/:projectId', async (req, res) => {
      const projectId = req.params.projectId;
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(projectId);
      if (!isValidObjectId) {
        res.status(400).send('Invalid ObjectId');
        return;
      }
      const query = {
        _id: new ObjectId(projectId),
      };
      const result = await projectCollection.findOne(query);
      res.send(result);
    });

    // filter data
    app.get('/projects/filter', async (req, res) => {
      const difficultyFilter = req.query.difficulty;
      const categoryFilter = req.query.category;
      console.log(difficultyFilter, categoryFilter);

      // Build the query object
      const query = {};

      if (difficultyFilter) {
        query.difficultyLevel = { $in: difficultyFilter.split('&') };
      }

      if (categoryFilter) {
        query.category = { $in: categoryFilter.split('&') };
      }

      try {
        const result = await projectCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
      }
    });

    // post submitted project data
    app.post('/submitted-projects', async (req, res) => {
      const newSubmittedProjectData = req.body;
      console.log(newSubmittedProjectData);
      const result = await submittedProjectCollection.insertOne(
        newSubmittedProjectData
      );
      res.send(result);
    });
    // get all submitted project data
    app.get('/submitted-projects', async (req, res) => {
      const cursor = submittedProjectCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // get submitted project data by user email
    app.get('/submitted-projects/:userEmail', async (req, res) => {
      const email = req.params.userEmail;
      const query = { examineeEmail: email };
      const cursor = submittedProjectCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // generate token on authentication
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log('User uid : ', user);
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: '1h',
      });
      console.log('New Token Generated: ', token);
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
        })
        .send({ success: true });
    });

    // clear cookie on logout
    app.post('/logout', async (req, res) => {
      const user = req.body;
      res.clearCookie('token', { maxAge: 0 }).send({ success: true });
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

app.listen(port, () => {
  console.log('Server is Running On Port ', port);
});
