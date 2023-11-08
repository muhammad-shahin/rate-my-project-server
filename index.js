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
    origin: 'https://ratemy-project.web.app',
    credentials: true,
    methods: ['GET', 'POST', 'UPDATE', 'PUT', 'DELETE'],
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

// verify token middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log('Verify token found : ', token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    console.log('decoded token : ', decoded);
    req.user = decoded;
    next();
  });
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
    app.post('/projects', logger, verifyToken, async (req, res) => {
      if (req.query.userId !== req.user.userId) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const newProjectData = req.body;
      console.log(newProjectData);
      const result = await projectCollection.insertOne(newProjectData);
      res.send(result);
    });

    // get all  project data
    app.get('/projects', logger, async (req, res) => {
      const page = req.query.page;
      const pageNumber = parseInt(page);
      const itemPerPage = 6;
      const skip = pageNumber * itemPerPage;
      const cursor = projectCollection.find().skip(skip).limit(itemPerPage);
      const result = await cursor.toArray();
      const totalCount = await projectCollection.countDocuments();
      res.json({ result, totalCount });
    });

    // get  project data by id
    app.get('/project/:projectId', async (req, res) => {
      const projectId = req.params.projectId;
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(projectId);
      if (!isValidObjectId) {
        res.status(400).send('Invalid ObjectId');
        return;
      }
      if (req.query.userId !== req.user.userId) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = {
        _id: new ObjectId(projectId),
      };
      const result = await projectCollection.findOne(query);
      res.send(result);
    });

    // get created project data by specific user email
    app.get(
      '/my-created-project/:userEmail',
      logger,
      verifyToken,
      async (req, res) => {
        const email = req.params.userEmail;
        if (req.query.userId !== req.user.userId) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        const query = { creatorEmail: email };
        const cursor = projectCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    );

    // filter data
    app.get('/projects/filter', logger, verifyToken, async (req, res) => {
      if (req.query.userId !== req.user.userId) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const difficultyFilter = req.query.difficulty;
      const categoryFilter = req.query.category;

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
    app.post('/submitted-projects', logger, verifyToken, async (req, res) => {
      if (req.query.userId !== req.user.userId) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const newSubmittedProjectData = req.body;
      console.log(newSubmittedProjectData);
      const result = await submittedProjectCollection.insertOne(
        newSubmittedProjectData
      );
      console.log(result);
      res.send(result);
    });
    // get all submitted project data
    app.get('/submitted-projects', logger, verifyToken, async (req, res) => {
      const cursor = submittedProjectCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    // get submitted project data by user email
    app.get(
      '/my-submitted-projects/:userEmail',
      logger,
      verifyToken,
      async (req, res) => {
        if (req.query.userId !== req.user.userId) {
          return res.status(403).send({ message: 'forbidden access' });
        }

        const email = req.params.userEmail;
        const query = { examineeEmail: email };
        const cursor = submittedProjectCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    );
    // get submitted project data by user email and pending status
    app.get(
      '/pending-submit/:userEmail',
      logger,
      verifyToken,
      async (req, res) => {
        if (req.query.userId !== req.user.userId) {
          return res.status(403).send({ message: 'forbidden access' });
        }

        const email = req.params.userEmail;
        const query = { creatorEmail: email, approveStatus: 'Pending' };
        try {
          const cursor = submittedProjectCollection.find(query);
          const result = await cursor.toArray();
          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send('Internal Server Error');
        }
      }
    );

    // update marks for submitted projects
    app.put('/projects/:projectId', logger, verifyToken, async (req, res) => {
      if (req.query.userId !== req.user.userId) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const id = req.params.projectId;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedProject = req.body;
      const project = {
        $set: {
          category: updatedProject.category,
          creatorEmail: updatedProject.creatorEmail,
          creatorName: updatedProject.creatorName,
          creatorPhotoUrl: updatedProject.creatorPhotoUrl,
          difficultyLevel: updatedProject.difficultyLevel,
          dueDate: updatedProject.dueDate,
          projectDescription: updatedProject.projectDescription,
          projectThumbnail: updatedProject.projectThumbnail,
          projectTitle: updatedProject.projectTitle,
          requirements: updatedProject.requirements,
          totalMarks: updatedProject.totalMarks,
        },
      };

      try {
        const result = await projectCollection.updateOne(
          filter,
          project,
          options
        );
        if (result.matchedCount === 1) {
          // Update project successfully
          res.json(result);
        } else {
          res.status(404).send('Project not found');
        }
      } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error');
      }
    });
    // update marks for submitted projects
    app.put(
      '/pending-submit/:submittedId',
      logger,
      verifyToken,
      async (req, res) => {
        if (req.query.userId !== req.user.userId) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        const id = req.params.submittedId;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedSubmittedProject = req.body;
        const project = {
          $set: {
            givenMarks: updatedSubmittedProject.givenMarks,
            feedback: updatedSubmittedProject.feedback,
            approveStatus: 'Approved',
          },
        };

        try {
          const result = await submittedProjectCollection.updateOne(
            filter,
            project,
            options
          );
          if (result.matchedCount === 1) {
            // Update project successfully
            res.json(result);
          } else {
            res.status(404).send('Project not found');
          }
        } catch (error) {
          console.error(error);
          res.status(500).send('Internal server error');
        }
      }
    );
    // DELETE
    app.delete(
      '/projects/:projectId',
      logger,
      verifyToken,
      async (req, res) => {
        if (req.query.userId !== req.user.userId) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        const id = req.params.projectId;
        const query = { _id: new ObjectId(id) };
        const result = await projectCollection.deleteOne(query);
        res.send(result);
      }
    );

    // generate token on authentication
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log('User email : ', user);
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
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
