const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    try {
        console.log('Users route accessed');
        console.log('Current user:', req.user);
        console.log('Total users in system:', global.users.length);

        const currentUser = req.user;
        if (!currentUser) {
            console.log('No current user found');
            return res.redirect('/login');
        }

        const otherUsers = global.users
            .filter(u => u.id !== currentUser.id)
            .map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                profilePic: u.profilePic || 'default.jpg',
                isFollowing: global.relationships.some(r => 
                    r.userId === currentUser.id && r.resourceId === u.id
                ),
                followersCount: global.relationships.filter(r => 
                    r.resourceId === u.id
                ).length,
                isOnline: global.onlineUsers.has(u.id),
                latestPost: global.posts
                    .filter(post => post.userId === u.id)
                    .sort((a, b) => b.createdAt - a.createdAt)[0] || null
            }));

        console.log('Users being displayed:', otherUsers.length);
        console.log('First user in list:', otherUsers[0]);
        
        res.render('users', { 
            users: otherUsers,
            currentUser: currentUser
        });
    } catch (error) {
        console.error('Error in users route:', error);
        res.status(500).json({ 
            error: 'Error loading users page',
            details: error.message
        });
    }
});

module.exports = router;
