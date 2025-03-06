const express = require('express');
const router = express.Router();

// RESTful endpoints for resources
router.get('/resources', (req, res) => {
    res.json(global.posts);
});

router.post('/resources', (req, res) => {
    const { content } = req.query;
    // Add resource using query params
});

router.put('/resources/:id', (req, res) => {
    const { content } = req.query;
    // Update resource using query params
});

// RESTful endpoints for users
router.get('/users', (req, res) => {
    res.json(global.users);
});

router.post('/users', (req, res) => {
    const { name, email } = req.query;
    // Add user using query params
});

module.exports = router;
