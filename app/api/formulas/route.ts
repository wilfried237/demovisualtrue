import { MongoClient } from 'mongodb';
import { NextResponse } from 'next/server';

const url = process.env.MONGODB_URI || "mongodb+srv://novazure:novazure@cluster0.swbkk5m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(url);
const db = client.db('platform_db');
const collection = db.collection('clients_solutions');

export async function GET() {
  const formulas = await collection.find({}).toArray();
  return NextResponse.json({ formulas });
}
