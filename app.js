const express = require('express');
const app = express();
const CookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const debugRoutes = require('./routes/debug');
const { saveUser } = require('./utils/userManager');

// In-memory storage
const users = [];
const posts = [];
const relationships = [];
const onlineUsers = new Set();

// Make them global right after declaration
global.users = users;
global.posts = posts;
global.relationships = relationships;
global.onlineUsers = onlineUsers;

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(CookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Add isLoggedIn middleware definition here
function isLoggedIn(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }
    try {
        const decoded = jwt.verify(token, "pankh");
        // Find the full user object from our in-memory users array
        const user = users.find(u => u.id === decoded.userid); // Changed from email to userid
        if (!user) {
            res.cookie('token', '');
            return res.redirect('/login');
        }
        req.user = user;
        next();
    } catch (err) {
        console.error('JWT verification failed:', err);
        res.cookie('token', ''); // Clear invalid token
        return res.redirect('/login');
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images/uploads');
    },
    filename: function (req, file, cb) {
        crypto.randomBytes(12, function (err, bytes) {
            if (err) return cb(err);
            const fn = bytes.toString('hex') + path.extname(file.originalname);
            cb(null, fn);
        });
    }
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/profile/upload', (req, res) => {
    res.render('profileupload');
});

app.post('/upload', isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }
        const user = users.find(u => u.email === req.user.email);
        user.profilePic = req.file.filename;
        res.redirect('/profile');

    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

function loadUsersFromJSON() {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data/users.json'), 'utf8');
        const parsed = JSON.parse(data);
        users.length = 0; // Clear existing array
        users.push(...parsed.users);
    } catch (error) {
        console.error('Error loading users from JSON:', error);
    }
}

// Call this after setting up middleware
loadUsersFromJSON();

app.post('/post', isLoggedIn, async (req, res) => {
    try {
        loadUsersFromJSON(); // Refresh users from JSON
        const user = users.find(u => u.id === req.user.id);
        
        if (!user) {
            console.error('User not found:', req.user.id);
            return res.redirect('/profile');
        }

        const newPost = {
            id: crypto.randomUUID(),
            userId: user.id,
            content: req.body.content,
            likes: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        posts.push(newPost);
        
        if (!user.posts) {
            user.posts = [];
        }
        user.posts.push(newPost);
        
        saveUser(user);
        return res.redirect('/profile');
    } catch (error) {
        console.error('Post creation error:', error);
        return res.redirect('/profile');
    }
});

app.get('/profile', isLoggedIn, async (req, res) => {
    try {
        loadUsersFromJSON(); // Refresh data
        let user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.redirect('/login');
        }
        
        // Ensure user.posts exists
        if (!user.posts) {
            user.posts = [];
        }

        // Use the posts from user object directly
        res.render('profile', { 
            user: { 
                ...user,
                posts: user.posts // Use posts directly from user object
            } 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

// Update the like route
app.get('/like/:id', isLoggedIn, (req, res) => {
    try {
        loadUsersFromJSON(); // Refresh users data
        const postId = req.params.id;
        const currentUser = req.user;
        
        // Find the user who owns the post and their post
        const postOwner = users.find(u => u.posts && u.posts.some(p => p.id === postId));
        if (!postOwner) {
            return res.status(404).send("Post not found");
        }

        const post = postOwner.posts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).send("Post not found");
        }

        // Initialize likes array if it doesn't exist
        if (!post.likes) {
            post.likes = [];
        }

        const likeIndex = post.likes.indexOf(currentUser.id);
        if (likeIndex === -1) {
            post.likes.push(currentUser.id);
        } else {
            post.likes.splice(likeIndex, 1);
        }

        // Update both the in-memory posts array and the file storage
        const { updatePost } = require('./utils/userManager');
        updatePost(postOwner.id, post.id, post);
        
        // Update the posts array
        const postIndex = posts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
            posts[postIndex] = post;
        } else {
            posts.push(post);
        }

        return res.redirect('/profile');
    } catch (error) {
        console.error('Error in like route:', error);
        return res.redirect('/profile');
    }
});

app.get('/edit/:id', isLoggedIn, (req, res) => {
    try {
        loadUsersFromJSON(); // Refresh users data
        const postId = req.params.id;
        const user = users.find(u => u.id === req.user.id);
        
        // Find post in user's posts
        const post = user.posts.find(p => p.id === postId);
        
        if (!post) {
            return res.status(404).send("Post not found");
        }

        res.render('edit', { post, user });
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

app.post('/update/:id', isLoggedIn, async (req, res) => {
    try {
        loadUsersFromJSON();
        const postId = req.params.id;
        const user = users.find(u => u.id === req.user.id);
        const post = user.posts.find(p => p.id === postId);
        
        if (!post) {
            return res.status(404).send("Post not found");
        }
        
        // Update post content
        post.content = req.body.content;
        post.updatedAt = new Date();
        
        // Save updated user data
        const { updatePost } = require('./utils/userManager');
        updatePost(user.id, post.id, post);
        
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

// Add new delete route
app.post('/delete/:id', isLoggedIn, async (req, res) => {
    try {
        loadUsersFromJSON(); // Refresh users data
        const postId = req.params.id;
        const user = users.find(u => u.id === req.user.id);
        
        if (!user || !user.posts) {
            return res.status(404).send("User or posts not found");
        }

        // Find the post in user's posts array
        const postIndex = user.posts.findIndex(p => p.id === postId);
        if (postIndex === -1) {
            return res.status(404).send("Post not found");
        }

        // Remove post from user's posts array
        user.posts.splice(postIndex, 1);

        // Save updated user data
        saveUser(user);

        // Also remove from in-memory posts array if it exists
        const globalPostIndex = posts.findIndex(p => p.id === postId);
        if (globalPostIndex !== -1) {
            posts.splice(globalPostIndex, 1);
        }

        res.redirect('/profile');
    } catch (error) {
        console.error('Error deleting post:', error);
        res.redirect('/profile');
    }
});

app.post('/register', async (req, res) => {
    try {
        let { email, name, username, password, age } = req.body;
        let userExists = users.find(u => u.email === email);
        if (userExists) return res.status(500).send("User already exists");

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        const newUser = {
            id: crypto.randomUUID(),
            username,
            email,
            age,
            name,
            password: hash,
            posts: [],
            profilePic: null
        };
        
        users.push(newUser);
        saveUser(newUser);

        let token = jwt.sign({ email: email, userid: newUser.id }, 'pankh');
        res.cookie('token', token);
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

// Add this route BEFORE the error handler and app.listen
app.get('/debug', (req, res) => {
    console.log('Debug endpoint accessed');  // Add logging
    console.log('Current users:', users);    // Add logging
    return res.status(200).json({
        usersCount: users.length,
        users: users,
        postsCount: posts.length,
        posts: posts,
        relationshipsCount: relationships.length,
        relationships: relationships
    });
});

app.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        let user = users.find(u => u.email === email);
        if (!user) return res.status(500).send("User not found");

        const result = await bcrypt.compare(password, user.password);
        if (result) {
            let token = jwt.sign({ email: email, userid: user.id }, 'pankh');
            res.cookie('token', token);
            onlineUsers.add(user.id); // Add user to online users
            return res.redirect('/profile');
        } else {
            res.redirect('/login');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

app.get('/logout', (req, res) => {
    if (req.cookies.token) {
        const user = jwt.verify(req.cookies.token, 'pankh');
        onlineUsers.delete(user.userid);
    }
    res.cookie('token', '');
    res.redirect('/login');
});

app.get('/online-users', isLoggedIn, (req, res) => {
    const currentUser = users.find(u => u.email === req.user.email);
    const onlineUsersList = users
        .filter(u => onlineUsers.has(u.id) && u.id !== currentUser.id)
        .map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            profilePic: u.profilePic,
            isFollowing: relationships.some(r => r.userId === currentUser.id && r.resourceId === u.id),
            followersCount: relationships.filter(r => r.resourceId === u.id).length
        }));
    res.render('online-users', { users: onlineUsersList });
});

app.post('/relationships', isLoggedIn, (req, res) => {
    const { resourceId } = req.query;
    const userId = users.find(u => u.email === req.user.email).id;
    
    const newRelationship = {
        id: crypto.randomUUID(),
        userId,
        resourceId,
        createdAt: new Date()
    };
    
    relationships.push(newRelationship);
    res.json(newRelationship);
});

app.get('/relationships', (req, res) => {
    res.json(relationships);
});

app.get('/relationships/user/:userId', (req, res) => {
    const userRelationships = relationships.filter(r => r.userId === req.params.userId);
    res.json(userRelationships);
});

app.delete('/relationships/:id', isLoggedIn, (req, res) => {
    const index = relationships.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).send("Relationship not found");
    
    relationships.splice(index, 1);
    res.send("Relationship removed");
});

// Add users route here, before error handler
app.get('/users', isLoggedIn, (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser) {
            return res.redirect('/login');
        }

        const otherUsers = users
            .filter(u => u.id !== currentUser.id)
            .map(u => {
                const latestPost = posts
                    .filter(post => post.userId === u.id)
                    .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
                    
                return {
                    id: u.id,
                    username: u.username,
                    name: u.name,
                    profilePic: u.profilePic || 'default.jpg',
                    isFollowing: relationships.some(r => 
                        r.userId === currentUser.id && r.resourceId === u.id
                    ),
                    followersCount: relationships.filter(r => 
                        r.resourceId === u.id
                    ).length,
                    isOnline: onlineUsers.has(u.id),
                    latestPost: latestPost
                };
            });

        res.render('users', { 
            users: otherUsers,
            currentUser: currentUser
        });
    } catch (error) {
        console.error('Error in users route:', error);
        res.status(500).send('Error loading users page');
    }
});

// Move this BEFORE the isLoggedIn middleware
global.users = users;
global.posts = posts;
global.relationships = relationships;
global.onlineUsers = onlineUsers;

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

app.use(debugRoutes);

// Error handler should be after all routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Debug endpoint available at: http://localhost:' + PORT + '/debug');
});