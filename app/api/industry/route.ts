import { NextResponse, NextRequest } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

const url = process.env.MONGODB_URI || "mongodb+srv://novazure:novazure@cluster0.swbkk5m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(url);
const db = client.db('platform_db');
const collection = db.collection('industry');

export async function GET(request: NextRequest) {
    try {
        // Ensure MongoDB connection
        await client.connect();
        
        // Get id from URL search params instead of request body
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
        }
        
        // Validate ObjectId format
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        
        // Use ObjectId for efficient querying instead of $where
        const industry = await collection.findOne({ _id: new ObjectId(id) });
        
        if (!industry) {
            return NextResponse.json({ error: 'Industry not found' }, { status: 404 });
        }
        
        return NextResponse.json({ industry });
        
    } catch (error) {
        console.error('Error fetching industry:', error);
        return NextResponse.json({ error: 'Failed to fetch industry' }, { status: 500 });
    } finally {
        // Close the connection
        await client.close();
    }
}