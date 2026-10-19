
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';

const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    }
  );
};

const userPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email, and password are required',
      });
    }

    // 2. Validate name
    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        message: 'Name must be at least 2 characters',
      });
    }

    // 3. Validate email
    if (typeof email !== 'string') {
      return res.status(400).json({
        message: 'Please provide a valid email',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^\S+@\S+\.\S+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Please provide a valid email',
      });
    }

    // 4. Validate password
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters',
      });
    }

    // 5. Check existing user
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    // 6. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7. Create user
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    // 8. Send response
    return res.status(201).json({
      message: 'Registration successful',
      token: signToken(user._id),
      user: userPayload(user),
    });
  } catch (error) {
    // Handle duplicate email database errors
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    console.error('Register error:', error);

    return res.status(500).json({
      message: 'Registration failed',
    });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    if (typeof email !== 'string' ||
        typeof password !== 'string') {
      return res.status(400).json({
        message: 'Invalid email or password',
      });
    }

    // 2. Validate email format
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^\S+@\S+\.\S+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Please provide a valid email',
      });
    }

    // 3. Find user and include password
    const user = await User.findOne({
      email: normalizedEmail,
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // 4. Compare entered password with hashed password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // 5. Send response
    return res.status(200).json({
      message: 'Login successful',
      token: signToken(user._id),
      user: userPayload(user),
    });
  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      message: 'Login failed',
    });
  }
};

// POST /api/auth/me
export const me = (req, res) => {
  return res.json({
    user: userPayload(req.user),
  });
};
