import { NextResponse, NextRequest } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

const url = process.env.MONGODB_URI || "mongodb+srv://novazure:novazure@cluster0.swbkk5m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(url);
const db = client.db('platform_db');
const collection = db.collection('technologies');

export async function GET(request: NextRequest) {
    try {
        await client.connect();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
        }
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const technology = await collection.findOne({_id: new ObjectId(id)});
        if (!technology) {
            return NextResponse.json({ error: 'Technology not found' }, { status: 404 });
        }
        return NextResponse.json({ technology });
    } catch (error) {
        console.error('Error fetching technology:', error);
        return NextResponse.json({ error: 'Failed to fetch technology' }, { status: 500 });
    }
}