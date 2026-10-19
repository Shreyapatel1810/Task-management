import User from '../models/user.js';

// GET /api/users  -> shared user list used for assigning and filtering
export const listUsers = async (req, res) => {
  const users = await User.find().select('name email').sort({ name: 1 });
  res.json({ users: users.map((u) => ({ id: u._id, name: u.name, email: u.email })) });
};