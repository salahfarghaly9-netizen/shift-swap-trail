const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌  MONGODB_URI environment variable is missing.');
    console.error('    On Render: go to Environment tab and add MONGODB_URI');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('✅  MongoDB Atlas connected');
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err.message);
    console.error('    Check: 1) MONGODB_URI is correct  2) Atlas IP whitelist has 0.0.0.0/0');
    process.exit(1);
  }
};

module.exports = connectDB;
