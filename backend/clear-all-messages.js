const { MongoClient } = require('mongodb');
require('dotenv').config();

async function clearAllMessages() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017/cross-lingo-chat');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    
    // Try different possible collection names
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Clear messages from all possible collections
    const possibleCollections = ['messages', 'Messages', 'message'];
    
    for (const collectionName of possibleCollections) {
      try {
        const collection = db.collection(collectionName);
        const messageCount = await collection.countDocuments();
        
        if (messageCount > 0) {
          console.log(`Found ${messageCount} messages in collection: ${collectionName}`);
          const result = await collection.deleteMany({});
          console.log(`Successfully deleted ${result.deletedCount} messages from ${collectionName}`);
        } else {
          console.log(`No messages found in collection: ${collectionName}`);
        }
      } catch (error) {
        console.log(`Collection ${collectionName} doesn't exist or error:`, error.message);
      }
    }
    
    // Also clear conversations if they exist
    try {
      const conversationsCollection = db.collection('conversations');
      const convCount = await conversationsCollection.countDocuments();
      if (convCount > 0) {
        console.log(`Found ${convCount} conversations to clear`);
        await conversationsCollection.deleteMany({});
        console.log('Cleared all conversations');
      }
    } catch (error) {
      console.log('No conversations collection or error:', error.message);
    }
    
  } catch (error) {
    console.error('Error clearing messages:', error);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

clearAllMessages();
