const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql');
const http = require('http');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8001;
const app = express();
require('dotenv').config();

const {Server} = require('ws');
const server = http.createServer(app);
const wsS = new Server({ server });


app.use(cors());
app.use(express.json())

const db = mysql.createConnection({
  host: `${process.env.HOSTLOCAL}`,
  user: `${process.env.USERLOCAL}`,
  // password: `${process.env.PASSWORDLOCAL}`,
  database: `${process.env.DBNAMELOCAL}`,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to the database');
  }
});

db.on('error', (err) => {
  console.error('MySQL connection error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    db.connect((err) => {
      if (err) {
        console.error('Error reconnecting to the database:', err);
      } else {
        console.log('Reconnected to the database');
      }
    });
  } else {
    throw err;
  }
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/weather/:region', async (req, res) => {
  try {
    const weather = await axios.get(
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${req.params.region}/next7days?unitGroup=metric&key=${process.env.WEATHER_KEY}&contentType=json`
    );
    res.json(weather.data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

app.post('/signup', async (req, res) => {
  const { email, password, name, surname } = req.body;
  const id_uniq = uuidv4().substring(0, 20)

  const hashedPassword = await bcrypt.hash(password, 10);

  const query = 'INSERT INTO users (id_uniq, email, password, name, surname) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [id_uniq, email, hashedPassword, name, surname], (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Failed to create user' });
    } else {
      res.status(200).json({ message: 'User created successfully', id_uniq });
    }
  });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Failed to fetch user data' });
    } else {
      if (results.length === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
      } else {
        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
      
          res.status(200).json({
            name: user.name,
            surname: user.surname,
            email: user.email,
            id: user.id_user,
            id_uniq: user.id_uniq,
            img: user.img,
          });
        } else {
          res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    }
  });
});

app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName } = req.body;

  const query = 'UPDATE users SET name = ?, surname = ? WHERE id_user = ?';
  db.query(query, [firstName, lastName, id], (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Failed to update user' });
    } else {
      res.status(200).json({ message: 'User updated successfully' });
    }
  });
});

app.get('/user/:id', async (req, res) => {
  const { id } = req.params;

  const query = 'SELECT * FROM users WHERE id_user = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Failed to fetch user data' });
    } else {
      res.status(200).json(result);
    }
  });
})


app.post('/upload/:id', upload.single('file'), (req, res) => {
  const file = req.file;
  const { id } = req.params;
  if (!file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const randomName = Math.random().toString(36).substring(7);
  const fileExtension = path.extname(file.originalname);
  const fileName = `${randomName}${fileExtension}`;
  
  const destinationPath = path.join(__dirname, 'uploads', fileName);

  fs.rename(file.path, destinationPath, (err) => {
    if (err) {
      console.error('Error moving file:', err);
      res.status(500).json({ error: 'Failed to move the file' });
    } else {
      const query = 'UPDATE users SET img = ? WHERE id_user = ?';
      db.query(query, [fileName, id], (err, result) => {
        if (err) {
          console.error('Error executing MySQL query:', err);
          res.status(500).json({ error: 'Failed to update the file name in the SQL table' });
        } else {
          res.status(200).json({ message: 'File uploaded and updated in the SQL table successfully', fileName});
        }
      });
    }
  });
});

app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', filename);
  res.sendFile(filePath);
});



app.post('/addfriend/:userId', async (req, res) => {
  const { userId } = req.params;
  const { friendId } = req.body;

  const userQuery = 'SELECT * FROM users WHERE id_user = ?';
  db.query(userQuery, [userId], (userErr, userResult) => {
    if (userErr) {
      console.error('Error executing MySQL query:', userErr);
      res.status(500).json({ error: 'Failed to fetch user data' });
    } else {
      if (userResult.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const friendQuery = 'SELECT * FROM users WHERE id_user = ?';
      db.query(friendQuery, [friendId], (friendErr, friendResult) => {
        if (friendErr) {
          console.error('Error executing MySQL query:', friendErr);
          res.status(500).json({ error: 'Failed to fetch friend data' });
        } else {
          if (friendResult.length === 0) {
            res.status(404).json({ error: 'Friend not found' });
            return;
          }

          const friendshipQuery = 'SELECT * FROM userFriends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)';
          db.query(friendshipQuery, [userId, friendId, friendId, userId], (friendshipErr, friendshipResult) => {
            if (friendshipErr) {
              console.error('Error executing MySQL query:', friendshipErr);
              res.status(500).json({ error: 'Failed to check friendship' });
            } else {
              if (friendshipResult.length > 0) {
                res.status(400).json({ error: 'Users are already friends' });
                return;
              }
              const addFriendshipQuery = 'INSERT INTO userFriends (user_id, friend_id) VALUES (?, ?)';
              db.query(addFriendshipQuery, [userId, friendId], (addErr, addResult) => {
                if (addErr) {
                  console.error('Error executing MySQL query:', addErr);
                  res.status(500).json({ error: 'Failed to add friend' });
                } else {
                  res.status(200).json({ message: 'Friend added successfully' });
                }
              });
            }
          });
        }
      });
    }
  });
});

app.get('/friendlist/:userId', async (req, res) => {
  const { userId } = req.params;

  const userQuery = 'SELECT * FROM users WHERE id_user = ?';
  db.query(userQuery, [userId], (userErr, userResult) => {
    if (userErr) {
      console.error('Error executing MySQL query:', userErr);
      res.status(500).json({ error: 'Failed to fetch user data' });
    } else {
      if (userResult.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const friendListQuery = 'SELECT users.id_user, users.name FROM userFriends INNER JOIN users ON userFriends.friend_id = users.id_user WHERE userFriends.user_id = ?';
      db.query(friendListQuery, [userId], (friendListErr, friendListResult) => {
        if (friendListErr) {
          console.error('Error executing MySQL query:', friendListErr);
          res.status(500).json({ error: 'Failed to fetch friend list' });
        } else {
          const friendList = friendListResult.map((friend) => ({
            id: friend.id_user,
            name: friend.name,
          }));

          const reverseFriendListQuery = 'SELECT users.id_user, users.name FROM userFriends INNER JOIN users ON userFriends.user_id = users.id_user WHERE userFriends.friend_id = ?';
          db.query(reverseFriendListQuery, [userId], (reverseFriendListErr, reverseFriendListResult) => {
            if (reverseFriendListErr) {
              console.error('Error executing MySQL query:', reverseFriendListErr);
              res.status(500).json({ error: 'Failed to fetch friend list' });
            } else {
              const reverseFriendList = reverseFriendListResult.map((friend) => ({
                id: friend.id_user,
                name: friend.name,
              }));

              const mergedFriendList = [...friendList, ...reverseFriendList];

              res.status(200).json({ friendList: mergedFriendList });
            }
          });
        }
      });
    }
  });
});

app.post('/messages', async (req, res) => {
  const { sender_id, recipient_id, message_content, timestamp } = req.body;

  const query = 'INSERT INTO messages (sender_id, recipient_id, message_content, timestamp) VALUES (?, ?, ?, ?)';
  db.query(query, [sender_id, recipient_id, message_content, timestamp], (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Failed to create message' });
    } else {
      console.log('Received message:', message_content);
      wsS.clients.forEach(client => {
        console.log('Sending message:', message_content);
        client.send(JSON.stringify(message_content));
      });
    }
  });
});

app.get('/messages', async (req, res) => {
  const { sender_id, recipient_id } = req.query;

  const query = 'SELECT * FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)';
  db.query(query, [sender_id, recipient_id, recipient_id, sender_id], (err, result) => {
    if (err) {
      console.error('Error executing MySQL query:', err);
      res.status(500).json({ error: 'Failed to fetch messages' });
    } else {
      res.status(200).json(result);
    }
  });
});


  server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

wsS.on('connection', () => {
  console.log('WebSocket client connected');
});


