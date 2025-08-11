import { NextResponse, NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const client = await clientPromise;
const db = client.db('platform_db');
const clientsCollection = db.collection('clients');
const usersCollection = db.collection('users');

export async function GET(request: NextRequest) {
    try {
        // Ensure MongoDB connection
        await client.connect();
        
        // Get id from URL search params
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
        }
        
        // Validate ObjectId format
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        
        const objectId = new ObjectId(id);
        
        // First, search in clients collection
        const clientUser = await clientsCollection.findOne({ _id: objectId });
        
        if (clientUser) {
            return NextResponse.json({
                ...clientUser,
                source: 'clients' // Optional: to know which collection the user came from
            });
        }
        
        // If not found in clients, search in users collection
        const regularUser = await usersCollection.findOne({ _id: objectId });
        
        if (regularUser) {
            return NextResponse.json({
                ...regularUser,
                source: 'users' // Optional: to know which collection the user came from
            });
        }
        
        // If not found in both collections, return error
        return NextResponse.json({ 
            error: 'User not found in clients or users collections' 
        }, { status: 404 });
        
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch user',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}