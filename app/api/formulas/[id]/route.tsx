import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";


const client = await clientPromise;
const db = client.db('platform_db');
const solutionCollection = db.collection('clients_solutions');

export async function GET(request: NextRequest){
    try{
        // Ensure that mongo db is connected
        await client.connect();

        //Get id from the url parameter

        const solutionId = (request as any).params.id as string

        if(!solutionId){
            return NextResponse.json("id not given", {status: 400});
        }

        if(!ObjectId.isValid(solutionId)){
            return NextResponse.json("invalid Id format", {status: 400});
        }

        const objectId = new ObjectId(solutionId);

        const solutionInfo = await solutionCollection.findOne({_id: objectId});

        if(!solutionInfo){
            return NextResponse.json("solutionId doesnot exist", {status: 404});
        }

        return NextResponse.json(solutionInfo);
    }
    catch(error){
        console.error('Error fetching solution:', error);
        return NextResponse.json({
            error: 'Failed to fetch user',
            details: error instanceof Error ? error.message: 'unknown'
        }, {status: 500});
    }
}
