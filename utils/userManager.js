const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

function saveUser(userData) {
    try {
        let users = { users: [] };
        if (fs.existsSync(usersFilePath)) {
            users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        }
        
        const existingUserIndex = users.users.findIndex(u => u.id === userData.id);
        if (existingUserIndex >= 0) {
            users.users[existingUserIndex] = userData;
        } else {
            users.users.push(userData);
        }

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}

function updatePost(userId, postId, updatedPost) {
    try {
        let users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = users.users.find(u => u.id === userId);
        if (!user) return;

        if (!user.posts) {
            user.posts = [];
        }

        const postIndex = user.posts.findIndex(p => p.id === postId);
        if (postIndex >= 0) {
            user.posts[postIndex] = updatedPost;
        } else {
            user.posts.push(updatedPost);
        }

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error updating post:', error);
    }
}

module.exports = { saveUser, updatePost };
