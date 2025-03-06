const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

router.get('/debug', (req, res) => {
    try {
        const userData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        res.json(userData);
    } catch (error) {
        res.status(500).json({ error: 'Error reading user data' });
    }
});

// Get user by ID
router.get('/api/users/:id', (req, res) => {
    try {
        const userData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = userData.users.find(u => u.id === req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error reading user data' });
    }
});

// Get user by email
router.get('/api/users/email/:email', (req, res) => {
    try {
        const userData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = userData.users.find(u => u.email === req.params.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error reading user data' });
    }
});

// Get user posts
router.get('/api/users/:id/posts', (req, res) => {
    try {
        const userData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = userData.users.find(u => u.id === req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.posts || []);
    } catch (error) {
        res.status(500).json({ error: 'Error reading user data' });
    }
});

module.exports = router;
